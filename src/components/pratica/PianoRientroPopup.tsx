"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addAttivitaAction } from "@/actions/core";
import { annoNascitaDaCodiceFiscale } from "@/lib/codiceFiscale";
import { dataIt, euro, importoIt } from "@/lib/domainFormat";
import {
  emptyPdrConfig,
  type PdrConfigPerimetro,
} from "@/lib/mandantePerimetri";
import {
  bandForAmount,
  buildManualByAmount,
  buildManualByCount,
  cadenzaLabel,
  cadenzaMonthStep,
  effectiveMaxInstallments,
  mesiDisponibiliPdr,
  practiceNetsFromGross,
  resolveAutoInstallmentCount,
  splitAccontoAcrossPractices,
  tryBuildMultiPracticePlan,
  tryBuildModulatedPlan,
  type PdrCadenza,
  type PdrMultiPracticeResult,
  type PdrModulatedPlanResult,
  type PdrPlanLine,
  type PdrPlanMode,
  round2,
} from "@/lib/pdrPiano";
import { fetchPraticheStessoDebitore } from "@/lib/praticheStessoDebitoreClient";

function parseEuroInput(text: string): number | null {
  const s = text.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatEuroInput(n: number) {
  return importoIt(n);
}

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function metodiDaPdr(pdr: PdrConfigPerimetro) {
  const opts: { value: string; label: string }[] = [
    { value: "contanti", label: "Contanti" },
  ];
  if (pdr.effettiCambiari) {
    opts.push({ value: "pdr_cambiali", label: "Effetti cambiari / Cambiali" });
  }
  if (pdr.bollettiniPostali) {
    opts.push({ value: "bollettino", label: "Bollettini postali" });
  }
  return opts;
}

const PRACTICE_LETTERS = ["A", "B", "C"] as const;

export function PianoRientroPopup({
  praticaId,
  residuo,
  importoIniziale,
  pdr = emptyPdrConfig(),
  codiceFiscale,
  mandanteLabel,
  onDone,
}: {
  praticaId: string;
  residuo: number;
  /** Preferisci netto da pagare se disponibile. */
  importoIniziale?: number;
  pdr?: PdrConfigPerimetro;
  codiceFiscale?: string | null;
  mandanteLabel?: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const baseImporto =
    importoIniziale != null && importoIniziale > 0 ? importoIniziale : residuo;

  const [importoAText, setImportoAText] = useState(
    baseImporto > 0 ? formatEuroInput(baseImporto) : ""
  );
  const [importoBText, setImportoBText] = useState("");
  const [importoCText, setImportoCText] = useState("");
  const [accontoText, setAccontoText] = useState(formatEuroInput(0));
  const derivedYear = annoNascitaDaCodiceFiscale(codiceFiscale);
  const [annoNascita, setAnnoNascita] = useState(
    derivedYear != null ? String(derivedYear) : ""
  );
  const [dataInizio, setDataInizio] = useState(todayInput());
  const [cadenza, setCadenza] = useState<PdrCadenza>("mensile");
  const [pianiCount, setPianiCount] = useState<1 | 2 | 3>(1);
  const [importoMensileText, setImportoMensileText] = useState("");
  const [mode, setMode] = useState<PdrPlanMode>("lastAdjustment");
  const [sizing, setSizing] = useState<"auto" | "manual">("auto");
  const [manualTarget, setManualTarget] = useState<"count" | "amount">("count");
  const [manualCount, setManualCount] = useState("6");
  const [manualAmount, setManualAmount] = useState("");
  const metodi = useMemo(() => metodiDaPdr(pdr), [pdr]);
  const [metodo, setMetodo] = useState(metodi[0]?.value ?? "contanti");
  const [calcolato, setCalcolato] = useState(false);
  const [rate, setRate] = useState<PdrPlanLine[]>([]);
  const [multiResult, setMultiResult] = useState<PdrMultiPracticeResult | null>(
    null
  );
  const [shortfall, setShortfall] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkedHints, setLinkedHints] = useState<string[]>([]);
  const [modPhases, setModPhases] = useState<
    Array<{ months: string; amount: string }>
  >([{ months: "", amount: "" }]);
  const [modulatedResult, setModulatedResult] =
    useState<PdrModulatedPlanResult | null>(null);

  const isModulato = cadenza === "modulato";
  const nPianiEffettivi = isModulato
    ? 1
    : cadenza === "bimestrale"
      ? 2
      : cadenza === "trimestrale"
        ? 3
        : pianiCount;
  const multiPiano = nPianiEffettivi > 1;
  const monthlyParallel = cadenza === "mensile" && pianiCount > 1;
  const monthStep = cadenzaMonthStep(cadenza);

  const importiGross = useMemo(() => {
    const texts = [importoAText, importoBText, importoCText].slice(
      0,
      nPianiEffettivi
    );
    return texts.map((t) => parseEuroInput(t) ?? 0);
  }, [importoAText, importoBText, importoCText, nPianiEffettivi]);

  const acconto = parseEuroInput(accontoText) ?? 0;
  const nets = multiPiano
    ? practiceNetsFromGross(importiGross, Math.max(0, acconto))
    : [
        round2(
          Math.max(0, (parseEuroInput(importoAText) ?? 0) - Math.max(0, acconto))
        ),
      ];
  const nettoSingolo = nets[0] ?? 0;
  const nettoTotale = round2(nets.reduce((s, n) => s + n, 0));
  const accontoShares = multiPiano
    ? splitAccontoAcrossPractices(Math.max(0, acconto), nPianiEffettivi)
    : [Math.max(0, acconto)];

  const annoNum = (() => {
    const n = Number(annoNascita);
    return Number.isFinite(n) && n >= 1900 && n <= new Date().getFullYear()
      ? n
      : null;
  })();
  const band = bandForAmount(pdr.bands, multiPiano ? nettoTotale : nettoSingolo);
  const mesiDisp = mesiDisponibiliPdr(annoNum, pdr.maxAgePdr);
  const maxRate = band
    ? effectiveMaxInstallments(band.installments, mesiDisp, monthStep)
    : 0;
  const minRata = pdr.minInstallmentAmount;
  const importoMensile = parseEuroInput(importoMensileText);

  /** Prefill B/C da pratiche collegate stesso debitore. */
  useEffect(() => {
    if (!multiPiano) return;
    let cancelled = false;
    fetchPraticheStessoDebitore(praticaId).then((data) => {
      if (cancelled || !data) return;
      const altre = data.altre
        .map((p) =>
          p.importoDaIncassare != null && p.importoDaIncassare > 0
            ? p.importoDaIncassare
            : p.residuo
        )
        .filter((n) => n > 0)
        .slice(0, nPianiEffettivi - 1);
      setLinkedHints(
        data.altre.slice(0, nPianiEffettivi - 1).map((p) => {
          const amt =
            p.importoDaIncassare != null && p.importoDaIncassare > 0
              ? p.importoDaIncassare
              : p.residuo;
          return `${p.numero} · ${p.mandante} · ${euro(amt)}`;
        })
      );
      setImportoBText((prev) => {
        if (prev.trim()) return prev;
        return altre[0] != null ? formatEuroInput(altre[0]) : prev;
      });
      setImportoCText((prev) => {
        if (prev.trim()) return prev;
        return altre[1] != null ? formatEuroInput(altre[1]) : prev;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [multiPiano, nPianiEffettivi, praticaId]);

  function touch() {
    setCalcolato(false);
    setRate([]);
    setMultiResult(null);
    setModulatedResult(null);
    setShortfall(0);
    setError(null);
  }

  function updateModPhase(
    index: number,
    patch: Partial<{ months: string; amount: string }>,
    resetCalc = true
  ) {
    setModPhases((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
    if (resetCalc) touch();
  }

  function canAddModPhase() {
    if (modPhases.length >= 3) return false;
    const last = modPhases[modPhases.length - 1];
    if (!last) return false;
    // Solo dopo una fase a rata fissa (mesi + importo) si può aggiungere.
    return Boolean(last.months.trim() && last.amount.trim());
  }

  function addModPhase() {
    if (!canAddModPhase()) return;
    setModPhases((prev) => [...prev, { months: "", amount: "" }]);
    touch();
  }

  function removeModPhase(index: number) {
    if (index <= 0 || modPhases.length <= 1) return;
    setModPhases((prev) => prev.filter((_, i) => i !== index));
    touch();
  }

  function setImportoAt(index: number, value: string, resetCalc = true) {
    if (index === 0) setImportoAText(value);
    else if (index === 1) setImportoBText(value);
    else setImportoCText(value);
    if (resetCalc) touch();
  }

  function importoAt(index: number) {
    return index === 0 ? importoAText : index === 1 ? importoBText : importoCText;
  }

  const pdrFeedback = (() => {
    if (multiPiano) {
      if (nettoTotale <= 0) return null;
      return {
        ok: true as const,
        text: `Netto totale da dilazionare: ${euro(nettoTotale)} (su ${nPianiEffettivi} pratiche). L'età e le fasce PDR non bloccano il multi-piano come in CreditCalc.`,
      };
    }
    if (nettoSingolo <= 0) return null;
    if (!pdr.bands.length) {
      return {
        ok: false,
        text: "Nessuna fascia PDR configurata sul perimetro mandante.",
      };
    }
    if (!band) {
      return {
        ok: false,
        text: "Importo netto non rientra in una fascia PDR valida.",
      };
    }
    const minTxt = minRata != null ? ` · min rata ${euro(minRata)}` : "";
    const ageTxt = mesiDisp != null ? ` · mesi disponibili ${mesiDisp}` : "";
    return {
      ok: true,
      text: `Fascia ${band.from}–${band.to} · max ${band.installments} rate → effettive ${maxRate}${minTxt}${ageTxt}`,
    };
  })();

  function sviluppa() {
    setError(null);
    if (!dataInizio) {
      setError("Indica la data inizio piano.");
      return;
    }
    if (!metodo || metodi.length === 0) {
      setError("Seleziona la modalità di pagamento.");
      return;
    }
    const start = new Date(`${dataInizio}T12:00:00`);
    if (Number.isNaN(start.getTime())) {
      setError("Data inizio piano non valida.");
      return;
    }

    if (multiPiano) {
      for (let i = 0; i < nPianiEffettivi; i++) {
        const g = importiGross[i] ?? 0;
        if (g <= 0) {
          setError(
            `Compila l'importo da recuperare (pratica ${PRACTICE_LETTERS[i]}).`
          );
          return;
        }
      }
      if (nets.some((n) => n <= 0)) {
        setError(
          "Dopo l'acconto almeno una pratica ha netto zero. Riduci l'acconto o aumenta gli importi."
        );
        return;
      }
      if (importoMensile == null || importoMensile <= 0) {
        setError(
          monthlyParallel
            ? "Inserisci l'importo mensile disponibile."
            : "Inserisci l'importo rata mensile (tutte le pratiche)."
        );
        return;
      }

      const outcome = tryBuildMultiPracticePlan({
        practiceDebts: nets.map((netAmount, i) => ({
          netAmount,
          accontoAmount: accontoShares[i] ?? 0,
        })),
        monthlyPayment: importoMensile,
        startDate: start,
        minInstallmentAmount: minRata,
        monthlyParallel,
      });
      if (!outcome.result) {
        setError(
          outcome.errorMessage ??
            "Impossibile strutturare i piani. Verifica importi e rata minima."
        );
        return;
      }
      setMultiResult(outcome.result);
      setModulatedResult(null);
      setRate([]);
      setShortfall(
        round2(
          outcome.result.practices.reduce((s, p) => s + p.shortfall, 0)
        )
      );
      setCalcolato(true);
      return;
    }

    if (isModulato) {
      if (nettoSingolo <= 0) {
        setError("Inserisci un importo da rateizzare valido.");
        return;
      }
      if (!band) {
        setError("Importo netto non rientra in una fascia PDR valida.");
        return;
      }
      if (maxRate < 1) {
        setError(
          "Non ci sono mesi/rate disponibili sufficienti (età / fascia PDR)."
        );
        return;
      }
      if (!annoNum && pdr.maxAgePdr != null) {
        setError("Inserisci l'anno di nascita del debitore (4 cifre).");
        return;
      }
      const outcome = tryBuildModulatedPlan({
        netto: nettoSingolo,
        phaseInputs: modPhases.map((p) => ({
          monthsText: p.months,
          amountText: p.amount,
        })),
        startDate: start,
        mode,
        maxInstallments: maxRate,
        minInstallmentAmount: minRata,
        mesiDisponibili: mesiDisp,
      });
      if (!outcome.result) {
        setError(
          outcome.errorMessage ?? "Correggi le fasi del piano modulato."
        );
        return;
      }
      setModulatedResult(outcome.result);
      setMultiResult(null);
      setRate(outcome.result.lines);
      setShortfall(outcome.result.shortfall);
      setCalcolato(true);
      return;
    }

    if (nettoSingolo <= 0) {
      setError("Inserisci un importo da rateizzare valido.");
      return;
    }
    if (!band) {
      setError("Importo netto non rientra in una fascia PDR valida.");
      return;
    }
    if (maxRate < 1) {
      setError("Non ci sono mesi/rate disponibili sufficienti (età / fascia PDR).");
      return;
    }
    if (!annoNum && pdr.maxAgePdr != null) {
      setError("Inserisci l'anno di nascita del debitore (4 cifre).");
      return;
    }

    let built: { lines: PdrPlanLine[]; recovered: number; shortfall: number } | null =
      null;

    if (sizing === "auto") {
      const n = resolveAutoInstallmentCount(nettoSingolo, maxRate, minRata);
      if (n == null) {
        setError(
          `Impossibile costruire il piano: verifica importo minimo rata${
            minRata != null ? ` (${euro(minRata)})` : ""
          }.`
        );
        return;
      }
      built = buildManualByCount(
        nettoSingolo,
        n,
        start,
        mode,
        minRata,
        monthStep
      );
    } else if (manualTarget === "count") {
      const n = Math.floor(Number(manualCount) || 0);
      if (n < 1 || n > maxRate) {
        setError(`Numero dilazioni tra 1 e ${maxRate}.`);
        return;
      }
      built = buildManualByCount(
        nettoSingolo,
        n,
        start,
        mode,
        minRata,
        monthStep
      );
    } else {
      const amt = parseEuroInput(manualAmount);
      if (amt == null || amt <= 0) {
        setError("Inserisci l'importo rata desiderato.");
        return;
      }
      built = buildManualByAmount(
        nettoSingolo,
        amt,
        maxRate,
        start,
        mode,
        minRata,
        monthStep
      );
      if (!built) {
        setError(
          "Parametri manuali non validi (rata sotto il minimo, troppo alta o troppe dilazioni)."
        );
        return;
      }
    }

    if (!built || !built.lines.length) {
      setError("Impossibile sviluppare il piano con i parametri indicati.");
      return;
    }

    setMultiResult(null);
    setModulatedResult(null);
    setRate(built.lines);
    setShortfall(built.shortfall);
    setCalcolato(true);
  }

  async function salva(e: FormEvent) {
    e.preventDefault();
    if (!calcolato) {
      setError("Sviluppa il piano prima di salvarlo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let nota: string;
      if (multiResult) {
        const pianiTxt = multiResult.practices
          .map(
            (p) =>
              `${p.label}: netto ${euro(p.netAmount)} · ${p.lines.length} rate · recuperato ${euro(p.recovered)}${
                p.shortfall > 0.009 ? ` · decurtazione ${euro(p.shortfall)}` : ""
              } · ${dataIt(p.lines[0]!.scadenza)}→${dataIt(p.lines[p.lines.length - 1]!.scadenza)}`
          )
          .join(" | ");
        const calTxt = multiResult.calendar
          .slice(0, 36)
          .map(
            (c) =>
              `${dataIt(c.date)} ${c.practiceLabel.replace("Piano di rientro ", "P")}: ${euro(c.amount)}`
          )
          .join("; ");
        nota = [
          "Piano di rientro multi-pratica (come CreditCalc)",
          `Cadenza: ${cadenzaLabel(cadenza)}`,
          `Piani: ${nPianiEffettivi}`,
          monthlyParallel
            ? `Importo mensile disponibile: ${euro(multiResult.monthlyClientPayment)}`
            : `Rata mensile cliente: ${euro(multiResult.monthlyClientPayment)}`,
          `Acconto: ${acconto > 0.009 ? euro(acconto) : "nessuno"}`,
          `Netto totale: ${euro(nettoTotale)}`,
          ...multiResult.phaseDescriptions.map((p) => `Fase: ${p}`),
          pianiTxt,
          `Fine complessiva: ${dataIt(multiResult.overallEndDate)}`,
          calTxt
            ? `Calendario${multiResult.calendar.length > 36 ? " (prime 36)" : ""}: ${calTxt}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
      } else if (modulatedResult) {
        const fasiTxt = modulatedResult.phases
          .map(
            (p, i) =>
              `Fase ${i + 1}: ${p.months}×${euro(p.monthlyAmount)}`
          )
          .join(" | ");
        nota = [
          "Piano di rientro modulato",
          `Cadenza: ${cadenzaLabel(cadenza)}`,
          `Importo da rateizzare: ${euro(modulatedResult.netAmountOriginal)}`,
          `Acconto: ${acconto > 0.009 ? euro(acconto) : "nessuno"}`,
          fasiTxt || null,
          `Mesi personalizzati: ${modulatedResult.modulatedMonths}`,
          `Recupero fasi: ${euro(modulatedResult.modulatedRecovered)}`,
          `Residuo dilazionato: ${euro(modulatedResult.residualDebt)} in ${modulatedResult.finalInstallmentCount} rate`,
          `Rate totali: ${modulatedResult.lines.length}`,
          `Recuperato: ${euro(modulatedResult.recovered)}`,
          modulatedResult.shortfall > 0.009
            ? `Decurtazione: ${euro(modulatedResult.shortfall)}`
            : null,
          `Data inizio: ${dataIt(modulatedResult.lines[0]!.scadenza)}`,
          `Data fine: ${dataIt(
            modulatedResult.lines[modulatedResult.lines.length - 1]!.scadenza
          )}`,
        ]
          .filter(Boolean)
          .join(" · ");
      } else {
        if (rate.length === 0) {
          setError("Sviluppa il piano prima di salvarlo.");
          setSaving(false);
          return;
        }
        const inizio = rate[0]!.scadenza;
        const fine = rate[rate.length - 1]!.scadenza;
        const nRate = rate.length;
        const prima = rate[0]!.importo;
        const ultima = rate[nRate - 1]!.importo;
        const hasConguaglio =
          nRate > 1 && Math.abs(ultima - prima) > 0.009;
        const importo = parseEuroInput(importoAText) ?? 0;
        const dettaglioRate = hasConguaglio
          ? `${nRate - 1} rate di ${euro(prima)} + 1 rata di ${euro(ultima)} (conguaglio)`
          : nRate === 1
            ? `1 rata di ${euro(prima)}`
            : `${nRate} rate di ${euro(prima)}`;
        nota = [
          "Piano di rientro sviluppato",
          `Cadenza: ${cadenzaLabel(cadenza)}`,
          `Importo totale: ${euro(importo)}`,
          `Acconto: ${acconto > 0.009 ? euro(acconto) : "nessuno"}`,
          `Importo da rateizzare: ${euro(nettoSingolo)}`,
          `Rate: ${nRate}`,
          dettaglioRate,
          `Data inizio: ${dataIt(inizio)}`,
          `Data fine: ${dataIt(fine)}`,
        ].join(" · ");
      }

      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("nota", nota);
      await addAttivitaAction(fd);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "mt-0.5 w-full rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2 text-sm tabular-nums";
  const segBtn = (active: boolean) =>
    `h-9 flex-1 rounded border px-2 text-xs font-semibold leading-tight ${
      active
        ? "border-[var(--navy)] bg-[var(--navy)] text-white"
        : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
    }`;
  const sectionCls =
    "space-y-2 rounded-lg border border-[var(--line)] bg-white p-3";
  const sectionTitle =
    "text-xs font-bold uppercase tracking-wide text-[#1a365d]";
  const hintCls = "text-[11px] leading-snug text-[var(--muted)]";

  const modoAttuale = isModulato
    ? "Modulato: definisci fino a 3 fasi personalizzate (mesi e/o importo), poi il residuo viene dilazionato sulle mensilità PDR rimaste."
    : multiPiano
      ? monthlyParallel
        ? `Mensile su ${nPianiEffettivi} pratiche: inserisci l'importo di ciascuna e quanto il cliente può pagare ogni mese in totale (ripartito sui piani aperti).`
        : cadenza === "bimestrale"
          ? "Bimestrale: inserisci gli importi delle pratiche A e B. Ogni mese il cliente paga l'intera rata su una pratica a rotazione."
          : "Trimestrale: inserisci gli importi A, B e C. Ogni mese il cliente paga l'intera rata su una pratica a rotazione."
      : "Una sola pratica: il sistema calcola le rate su questo debito (automatico o manuale).";

  const practiceLabels = Array.from({ length: nPianiEffettivi }, (_, i) => {
    const letter = PRACTICE_LETTERS[i]!;
    return multiPiano
      ? `Importo da recuperare (pratica ${letter})`
      : "Debito da rateizzare";
  });

  return (
    <form onSubmit={salva} className="space-y-3 px-3 py-3 text-sm">
      {mandanteLabel ? (
        <p className={hintCls}>
          Mandante:{" "}
          <span className="font-semibold text-[var(--navy)]">{mandanteLabel}</span>
        </p>
      ) : null}

      <div className={sectionCls}>
        <p className={sectionTitle}>1 · Frequenza e pratiche</p>
        <p className={hintCls}>
          Come in CreditCalc: con più pratiche inserisci un importo per ciascuna
          (A/B/C), non solo quello della pratica aperta.
        </p>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Frequenza delle rate
          </span>
          <select
            value={cadenza}
            onChange={(e) => {
              const next = e.target.value as PdrCadenza;
              setCadenza(next);
              if (next !== "mensile") setPianiCount(1);
              if (next === "modulato") {
                setModPhases([{ months: "", amount: "" }]);
                setSizing("auto");
              }
              touch();
            }}
            className={inputCls}
          >
            <option value="mensile">Mensile — una rata ogni mese</option>
            <option value="bimestrale">
              Bimestrale — due pratiche, rata a mesi alterni
            </option>
            <option value="trimestrale">
              Trimestrale — tre pratiche, una rata ogni tre mesi
            </option>
            <option value="modulato">
              Modulato — fasi personalizzate + residuo
            </option>
          </select>
        </label>

        {cadenza === "mensile" ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
              Quante pratiche stai chiudendo?
            </p>
            <div className="flex gap-1">
              {(
                [
                  { n: 1 as const, label: "1 pratica" },
                  { n: 2 as const, label: "2 pratiche" },
                  { n: 3 as const, label: "3 pratiche" },
                ] as const
              ).map(({ n, label }) => (
                <button
                  key={n}
                  type="button"
                  className={segBtn(pianiCount === n)}
                  onClick={() => {
                    setPianiCount(n);
                    touch();
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded border border-[#c5d4e4] bg-[#f0f5fa] px-2.5 py-2">
          <p className="text-[11px] leading-snug text-[#1a365d]">{modoAttuale}</p>
        </div>
      </div>

      <div className={sectionCls}>
        <p className={sectionTitle}>
          {multiPiano ? "2 · Importi delle pratiche" : "2 · Importi"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {practiceLabels.map((label, i) => (
            <label key={label} className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">{label}</span>
              <input
                type="text"
                inputMode="decimal"
                value={importoAt(i)}
                onChange={(e) => setImportoAt(i, e.target.value)}
                onBlur={() => {
                  const n = parseEuroInput(importoAt(i));
                  if (n != null) setImportoAt(i, formatEuroInput(n), false);
                }}
                className={inputCls}
                placeholder="es. 1.200,00"
              />
              {multiPiano && nets[i] != null && (importiGross[i] ?? 0) > 0 ? (
                <span className={`mt-0.5 block ${hintCls}`}>
                  Netto dopo acconto: {euro(nets[i]!)}
                </span>
              ) : null}
            </label>
          ))}
          <label className="block text-xs">
            <span className="font-semibold text-[var(--muted)]">
              Acconto (se già versato)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={accontoText}
              onChange={(e) => {
                setAccontoText(e.target.value);
                touch();
              }}
              onBlur={() => {
                const n = parseEuroInput(accontoText);
                if (n != null) setAccontoText(formatEuroInput(Math.max(0, n)));
              }}
              className={inputCls}
            />
            {multiPiano ? (
              <span className={`mt-0.5 block ${hintCls}`}>
                L&apos;acconto si ripartisce in quote uguali sulle {nPianiEffettivi}{" "}
                pratiche.
              </span>
            ) : null}
          </label>
        </div>

        {multiPiano && linkedHints.length > 0 ? (
          <p className={hintCls}>
            Suggeriti da pratiche collegate: {linkedHints.join(" · ")}
          </p>
        ) : null}

        <div className="rounded border border-[var(--line)] bg-[#f8fafc] px-3 py-2 text-xs">
          <p className="text-[var(--muted)]">
            {multiPiano ? "Netto totale da dilazionare: " : "Resto da dilazionare: "}
            <span className="font-bold tabular-nums text-[var(--navy)]">
              {euro(multiPiano ? nettoTotale : nettoSingolo)}
            </span>
          </p>
          {pdrFeedback ? (
            <p
              className={`mt-1 ${
                pdrFeedback.ok ? "text-emerald-700" : "text-[var(--danger)]"
              }`}
            >
              {pdrFeedback.text}
            </p>
          ) : null}
        </div>

        {multiPiano ? (
          <label className="block text-xs">
            <span className="font-semibold text-[var(--muted)]">
              {monthlyParallel
                ? "Importo mensile disponibile"
                : "Importo rata mensile (tutte le pratiche)"}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={importoMensileText}
              onChange={(e) => {
                setImportoMensileText(e.target.value);
                touch();
              }}
              onBlur={() => {
                const n = parseEuroInput(importoMensileText);
                if (n != null)
                  setImportoMensileText(formatEuroInput(Math.max(0, n)));
              }}
              className={inputCls}
              placeholder="es. 200,00"
            />
            <span className={`mt-1 block ${hintCls}`}>
              {monthlyParallel
                ? `Ogni mese il cliente versa questo importo, diviso in parti uguali tra i piani ancora aperti (con ${nPianiEffettivi} piani aperti: ~${
                    importoMensile != null && importoMensile > 0
                      ? euro(Math.floor(importoMensile / nPianiEffettivi))
                      : "—"
                  } ciascuno).`
                : "Ogni mese il cliente versa questa rata intera su una sola pratica, a rotazione tra quelle ancora aperte."}
            </span>
          </label>
        ) : null}
      </div>

      <div className={sectionCls}>
        <p className={sectionTitle}>3 · Debitore e inizio</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {!multiPiano ? (
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">
                Anno di nascita
              </span>
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                value={annoNascita}
                onChange={(e) => {
                  setAnnoNascita(e.target.value);
                  touch();
                }}
                className={inputCls}
                placeholder="es. 1981"
              />
              <span className={`mt-0.5 block ${hintCls}`}>
                Serve per il limite di età sul piano (mandante).
              </span>
            </label>
          ) : null}
          <label className="block text-xs">
            <span className="font-semibold text-[var(--muted)]">
              Prima scadenza
            </span>
            <input
              type="date"
              value={dataInizio}
              onChange={(e) => {
                setDataInizio(e.target.value);
                touch();
              }}
              className={inputCls}
            />
          </label>
        </div>
      </div>

      <div className={sectionCls}>
        <p className={sectionTitle}>4 · Come costruire le rate</p>
        {isModulato ? (
          <>
            <p className={hintCls}>
              Rate personalizzate (max 3 fasi). Solo mesi o solo importo:
              dilazione del residuo con conguaglio / rate uguali. Entrambi:
              fase a rata fissa; poi eventuale altra fase o residuo automatico.
            </p>
            {modPhases.map((phase, i) => (
              <div
                key={`mod-phase-${i}`}
                className="space-y-2 rounded border border-[var(--line)] bg-[#fafcfd] p-2"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[var(--navy)]">
                    Fase {i + 1}
                  </p>
                  {i > 0 ? (
                    <button
                      type="button"
                      className="text-[11px] text-[var(--danger)]"
                      onClick={() => removeModPhase(i)}
                    >
                      Rimuovi
                    </button>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="font-semibold text-[var(--muted)]">
                      Numero di mesi
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={phase.months}
                      onChange={(e) =>
                        updateModPhase(i, { months: e.target.value })
                      }
                      className={inputCls}
                      placeholder="es. 3"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="font-semibold text-[var(--muted)]">
                      Importo rata mensile
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={phase.amount}
                      onChange={(e) =>
                        updateModPhase(i, { amount: e.target.value })
                      }
                      onBlur={() => {
                        const n = parseEuroInput(phase.amount);
                        if (n != null)
                          updateModPhase(
                            i,
                            { amount: formatEuroInput(n) },
                            false
                          );
                      }}
                      className={inputCls}
                      placeholder="es. 150,00"
                    />
                  </label>
                </div>
              </div>
            ))}
            {modPhases.length < 3 ? (
              <button
                type="button"
                disabled={!canAddModPhase()}
                onClick={addModPhase}
                className="h-8 rounded border border-[var(--line)] px-3 text-xs font-semibold text-[var(--navy)] disabled:opacity-40"
              >
                + Aggiungi fase
              </button>
            ) : null}
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
                Conguaglio sul residuo?
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={segBtn(mode === "lastAdjustment")}
                  onClick={() => {
                    setMode("lastAdjustment");
                    touch();
                  }}
                >
                  Sì — ultima rata di conguaglio
                </button>
                <button
                  type="button"
                  className={segBtn(mode === "allEqual")}
                  onClick={() => {
                    setMode("allEqual");
                    touch();
                  }}
                >
                  No — tutte le rate uguali
                </button>
              </div>
              <p className={`mt-1 ${hintCls}`}>
                Si applica alla dilazione del debito residuo, dopo le fasi
                personalizzate.
              </p>
            </div>
          </>
        ) : !multiPiano ? (
          <>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
                Conguaglio sull&apos;ultima rata?
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={segBtn(mode === "lastAdjustment")}
                  onClick={() => {
                    setMode("lastAdjustment");
                    touch();
                  }}
                >
                  Sì — ultima rata di conguaglio
                </button>
                <button
                  type="button"
                  className={segBtn(mode === "allEqual")}
                  onClick={() => {
                    setMode("allEqual");
                    touch();
                  }}
                >
                  No — tutte le rate uguali
                </button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
                Numero di rate
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className={segBtn(sizing === "auto")}
                  onClick={() => {
                    setSizing("auto");
                    touch();
                  }}
                >
                  Calcolo automatico
                </button>
                <button
                  type="button"
                  className={segBtn(sizing === "manual")}
                  onClick={() => {
                    setSizing("manual");
                    touch();
                  }}
                >
                  Scelta manuale
                </button>
              </div>
            </div>
            {sizing === "manual" ? (
              <div className="space-y-2 rounded border border-[var(--line)] bg-[#fafcfd] p-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={segBtn(manualTarget === "count")}
                    onClick={() => {
                      setManualTarget("count");
                      touch();
                    }}
                  >
                    Quante rate
                  </button>
                  <button
                    type="button"
                    className={segBtn(manualTarget === "amount")}
                    onClick={() => {
                      setManualTarget("amount");
                      touch();
                    }}
                  >
                    Importo di ogni rata
                  </button>
                </div>
                {manualTarget === "count" ? (
                  <label className="block text-xs">
                    <span className="font-semibold text-[var(--muted)]">
                      Numero rate (massimo {maxRate || "—"})
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={maxRate || undefined}
                      value={manualCount}
                      onChange={(e) => {
                        setManualCount(e.target.value);
                        touch();
                      }}
                      className={inputCls}
                    />
                  </label>
                ) : (
                  <label className="block text-xs">
                    <span className="font-semibold text-[var(--muted)]">
                      Importo rata desiderato
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={manualAmount}
                      onChange={(e) => {
                        setManualAmount(e.target.value);
                        touch();
                      }}
                      className={inputCls}
                      placeholder="es. 150,00"
                    />
                  </label>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className={hintCls}>
            Con più pratiche le rate sono tutte uguali all&apos;importo mensile
            (o alla quota mensile), come in CreditCalc: niente conguaglio
            manuale.
          </p>
        )}

        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Come paga il cliente
          </span>
          <select
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value);
              touch();
            }}
            className={inputCls}
          >
            {metodi.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sviluppa}
          className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-medium text-white"
        >
          Calcola il piano
        </button>
        {calcolato ? (
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded border border-[var(--navy)] bg-white px-4 text-sm font-medium text-[var(--navy)] disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : "Salva in note"}
          </button>
        ) : null}
      </div>

      {calcolato && multiResult ? (
        <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2">
          <p className="text-xs font-semibold text-[var(--navy)]">
            {monthlyParallel
              ? "Importo mensile disponibile"
              : "Rata mensile cliente"}
            : {euro(multiResult.monthlyClientPayment)} · fine{" "}
            {dataIt(multiResult.overallEndDate)}
          </p>
          <ul className="space-y-0.5 text-[11px] text-[#1a365d]">
            {multiResult.phaseDescriptions.map((p) => (
              <li key={p}>• {p}</li>
            ))}
          </ul>
          {shortfall > 0.009 ? (
            <p className="text-[11px] text-amber-700">
              Decurtazione complessiva (rate intere): {euro(shortfall)}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {multiResult.practices.map((p) => (
              <div
                key={p.label}
                className="rounded border border-[var(--line)] bg-white px-2 py-1.5 text-xs"
              >
                <p className="font-semibold text-[var(--navy)]">{p.label}</p>
                <p className="text-[var(--muted)]">
                  Netto {euro(p.netAmount)} · {p.lines.length} rate · recuperato{" "}
                  {euro(p.recovered)}
                </p>
                <ul className="mt-1 max-h-28 space-y-0.5 overflow-auto tabular-nums text-[11px] text-[var(--muted)]">
                  {p.lines.map((r) => (
                    <li key={`${p.label}-${r.numero}`}>
                      Rata {r.numero} · {dataIt(r.scadenza)} ·{" "}
                      <span className="font-semibold text-[var(--navy)]">
                        {euro(r.importo)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-[var(--navy)]">
              Calendario pagamenti cliente
            </p>
            <ul className="max-h-40 space-y-0.5 overflow-auto text-[11px] tabular-nums text-[var(--muted)]">
              {multiResult.calendar.map((c, idx) => (
                <li key={`${c.date.toISOString()}-${c.practiceLabel}-${idx}`}>
                  {dataIt(c.date)} · {c.practiceLabel} ·{" "}
                  <span className="font-semibold text-[var(--navy)]">
                    {euro(c.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {calcolato && !multiResult && rate.length > 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2">
          {modulatedResult ? (
            <div className="mb-2 space-y-0.5 text-[11px] text-[#1a365d]">
              <p className="text-xs font-semibold text-[var(--navy)]">
                Piano modulato · {modulatedResult.modulatedMonths} mesi
                personalizzati · residuo {euro(modulatedResult.residualDebt)} in{" "}
                {modulatedResult.finalInstallmentCount} rate
              </p>
              <p>
                Recupero fasi {euro(modulatedResult.modulatedRecovered)} ·
                totale recuperato {euro(modulatedResult.recovered)}
              </p>
            </div>
          ) : (
            <p className="text-xs font-semibold text-[var(--navy)]">
              Piano calcolato · {cadenzaLabel(cadenza)} · {rate.length} rate ·
              totale {euro(rate.reduce((s, r) => s + r.importo, 0))}
            </p>
          )}
          {shortfall > 0.009 ? (
            <p className="mt-1 text-[11px] text-amber-700">
              Decurtazione (rate uguali intere): {euro(shortfall)}
            </p>
          ) : null}
          <ul className="mt-2 max-h-52 space-y-1 overflow-auto text-xs">
            {rate.map((r) => (
              <li key={r.numero} className="tabular-nums text-[var(--muted)]">
                Rata {r.numero} · {dataIt(r.scadenza)} ·{" "}
                <span className="font-semibold text-[var(--navy)]">
                  {euro(r.importo)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
