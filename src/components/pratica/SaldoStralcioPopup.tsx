"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createStralcioPianoAction } from "@/actions/core";
import { dataIt, euro, importoIt } from "@/lib/domainFormat";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import {
  emptyPdrConfig,
  emptyStralcioConfig,
  hasStralcioVincoli,
  type PdrConfigPerimetro,
  type StralcioConfigPerimetro,
} from "@/lib/mandantePerimetri";

type AmountSource = "debito" | "percent" | "stralciato" | "residuo";

type RataLinea = { numero: number; scadenza: Date; importo: number };

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

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

function parsePercentInput(text: string): number | null {
  const s = text.trim().replace(/%/g, "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatPercentInput(n: number) {
  return `${n.toFixed(2).replace(".", ",")} %`;
}

function addMonthsSameCalendarDay(base: Date, months: number) {
  const day = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1, 12, 0, 0);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

function splitInstallmentAmounts(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  if (count <= 1) return [totalCents / 100];
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * (count - 1);
  return [
    ...Array.from({ length: count - 1 }, () => baseCents / 100),
    remainder / 100,
  ];
}

function metodiPagamentoStralcio(pdr: PdrConfigPerimetro) {
  const fromPdr: { value: string; label: string }[] = [
    { value: "contanti", label: "Contanti" },
  ];
  if (pdr.effettiCambiari) {
    fromPdr.push({ value: "pdr_cambiali", label: "Effetti cambiari" });
  }
  if (pdr.bollettiniPostali) {
    fromPdr.push({ value: "bollettino", label: "Bollettini postali" });
  }
  if (fromPdr.length > 1) return fromPdr;
  return METODI_INCASSO.map((m) => ({ value: m.value, label: m.label }));
}

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function SaldoStralcioPopup({
  praticaId,
  residuo,
  stralcio = emptyStralcioConfig(),
  pdr = emptyPdrConfig(),
  onDone,
}: {
  praticaId: string;
  residuo: number;
  stralcio?: StralcioConfigPerimetro;
  pdr?: PdrConfigPerimetro;
  onDone?: () => void;
}) {
  const router = useRouter();
  const vincoli = hasStralcioVincoli(stralcio);
  const percMin = stralcio.percMin ?? 0;
  const percMax = stralcio.percMax ?? 100;
  const rangeMin = Math.min(percMin, percMax);
  const rangeMax = Math.max(percMin, percMax);

  const initialPct =
    stralcio.percProposta != null
      ? clamp(stralcio.percProposta, rangeMin, rangeMax)
      : null;

  const initialDebito = residuo > 0 ? residuo : 0;
  const initialStralciato =
    initialPct != null && initialDebito > 0
      ? round2((initialDebito * initialPct) / 100)
      : null;
  const initialResiduoPagare =
    initialStralciato != null
      ? round2(initialDebito - initialStralciato)
      : initialDebito > 0
        ? initialDebito
        : null;

  const [debitoText, setDebitoText] = useState(
    initialDebito > 0 ? formatEuroInput(initialDebito) : ""
  );
  const [percentText, setPercentText] = useState(
    initialPct != null ? formatPercentInput(initialPct) : ""
  );
  const [stralciatoText, setStralciatoText] = useState(
    initialStralciato != null ? formatEuroInput(initialStralciato) : ""
  );
  const [residuoText, setResiduoText] = useState(
    initialResiduoPagare != null ? formatEuroInput(initialResiduoPagare) : ""
  );
  const [nRate, setNRate] = useState(1);
  const [primaScadenza, setPrimaScadenza] = useState(todayInput());
  const metodi = useMemo(() => metodiPagamentoStralcio(pdr), [pdr]);
  const [metodo, setMetodo] = useState(metodi[0]?.value ?? "contanti");
  const [calcolato, setCalcolato] = useState(false);
  const [rate, setRate] = useState<RataLinea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function touch() {
    setCalcolato(false);
    setRate([]);
    setError(null);
  }

  function applyFromPercent(debito: number, percent: number) {
    const pct = clamp(percent, 0, 100);
    const stralciato = round2((debito * pct) / 100);
    const res = round2(debito - stralciato);
    setPercentText(formatPercentInput(pct));
    setStralciatoText(formatEuroInput(stralciato));
    setResiduoText(formatEuroInput(res));
  }

  function applyFromStralciato(debito: number, stralciato: number) {
    const s = clamp(stralciato, 0, debito);
    const res = round2(debito - s);
    const pct = debito > 0 ? (s / debito) * 100 : 0;
    setStralciatoText(formatEuroInput(s));
    setResiduoText(formatEuroInput(res));
    setPercentText(formatPercentInput(pct));
  }

  function applyFromResiduo(debito: number, residuoPagare: number) {
    const r = clamp(residuoPagare, 0, debito);
    const s = round2(debito - r);
    const pct = debito > 0 ? (s / debito) * 100 : 0;
    setResiduoText(formatEuroInput(r));
    setStralciatoText(formatEuroInput(s));
    setPercentText(formatPercentInput(pct));
  }

  function syncFrom(source: AmountSource) {
    const debito = parseEuroInput(debitoText);
    if (debito == null || debito <= 0) return;

    if (source === "debito") {
      const pct = parsePercentInput(percentText);
      if (pct != null) applyFromPercent(debito, pct);
      else {
        const str = parseEuroInput(stralciatoText);
        if (str != null) applyFromStralciato(debito, str);
        else {
          const res = parseEuroInput(residuoText);
          if (res != null) applyFromResiduo(debito, res);
        }
      }
      setDebitoText(formatEuroInput(debito));
      return;
    }
    if (source === "percent") {
      const pct = parsePercentInput(percentText);
      if (pct == null) return;
      applyFromPercent(debito, pct);
      return;
    }
    if (source === "stralciato") {
      const str = parseEuroInput(stralciatoText);
      if (str == null) return;
      applyFromStralciato(debito, str);
      return;
    }
    const res = parseEuroInput(residuoText);
    if (res == null) return;
    applyFromResiduo(debito, res);
  }

  function validateDevelop(): string | null {
    const debito = parseEuroInput(debitoText);
    if (debito == null || debito <= 0) return "Inserisci il debito totale.";
    const residuoPagare = parseEuroInput(residuoText);
    if (residuoPagare == null || residuoPagare <= 0) {
      return "Inserisci il residuo da pagare.";
    }
    if (residuoPagare > debito + 0.001) {
      return "Il residuo non può superare il debito.";
    }
    const pct = parsePercentInput(percentText);
    if (vincoli && pct != null && (pct < rangeMin - 0.05 || pct > rangeMax + 0.05)) {
      return `La % di stralcio deve essere tra ${rangeMin}% e ${rangeMax}% (mandante).`;
    }
    if (!metodo) return "Seleziona la modalità di pagamento.";
    if (!primaScadenza) return "Indica la data della prima rata.";
    if (nRate < 1 || nRate > 10) return "Le dilazioni devono essere da 1 a 10.";
    return null;
  }

  function sviluppa() {
    const err = validateDevelop();
    if (err) {
      setError(err);
      setCalcolato(false);
      setRate([]);
      return;
    }
    const residuoPagare = parseEuroInput(residuoText)!;
    const start = new Date(`${primaScadenza}T12:00:00`);
    const amounts = splitInstallmentAmounts(residuoPagare, nRate);
    setRate(
      amounts.map((importo, i) => ({
        numero: i + 1,
        scadenza: addMonthsSameCalendarDay(start, i),
        importo,
      }))
    );
    setCalcolato(true);
    setError(null);
  }

  async function salvaPiano(e: FormEvent) {
    e.preventDefault();
    if (!calcolato || rate.length === 0) {
      setError("Sviluppa il piano prima di salvarlo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("nRate", String(nRate));
      fd.set("primaScadenza", primaScadenza);
      fd.set("importoResiduo", String(parseEuroInput(residuoText) ?? 0));
      fd.set("metodoPagamento", metodo);
      fd.set(
        "percentualeStralcio",
        String(parsePercentInput(percentText) ?? "")
      );
      await createStralcioPianoAction(fd);
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

  return (
    <form onSubmit={salvaPiano} className="space-y-3 px-3 py-3 text-sm">
      {vincoli ? (
        <div className="rounded border border-[#c5d4e4] bg-[#f0f5fa] px-3 py-2 text-[11px] text-[#1a365d]">
          <p className="font-semibold">Condizioni mandante (% stralcio)</p>
          <p className="mt-0.5 text-[var(--muted)]">
            {[
              stralcio.percMin != null ? `min ${stralcio.percMin}%` : null,
              stralcio.percMax != null ? `max ${stralcio.percMax}%` : null,
              stralcio.percProposta != null
                ? `proposta ${stralcio.percProposta}%`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </p>
          {stralcio.note.trim() ? (
            <p className="mt-1 text-[var(--muted)]">{stralcio.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--muted)]">
          Nessun vincolo sul perimetro: puoi negoziare liberamente (come
          CreditCalc).
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">Debito totale</span>
          <input
            type="text"
            inputMode="decimal"
            value={debitoText}
            onChange={(e) => {
              setDebitoText(e.target.value);
              touch();
            }}
            onBlur={() => {
              syncFrom("debito");
              touch();
            }}
            className={inputCls}
            placeholder="0,00"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Percentuale stralcio
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={percentText}
            onChange={(e) => {
              setPercentText(e.target.value);
              touch();
            }}
            onBlur={() => {
              syncFrom("percent");
              touch();
            }}
            className={inputCls}
            placeholder="es. 25"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Importo da stralciare
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={stralciatoText}
            onChange={(e) => {
              setStralciatoText(e.target.value);
              touch();
            }}
            onBlur={() => {
              syncFrom("stralciato");
              touch();
            }}
            className={inputCls}
            placeholder="0,00"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Residuo da pagare
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={residuoText}
            onChange={(e) => {
              setResiduoText(e.target.value);
              touch();
            }}
            onBlur={() => {
              syncFrom("residuo");
              touch();
            }}
            className={inputCls}
            placeholder="0,00"
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
          Dilazioni sul residuo (1–10)
        </p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setNRate(n);
                touch();
              }}
              className={`h-8 min-w-8 rounded border px-2 text-xs font-semibold ${
                nRate === n
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-[#eef4f8]"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Data prima rata
          </span>
          <input
            type="date"
            value={primaScadenza}
            onChange={(e) => {
              setPrimaScadenza(e.target.value);
              touch();
            }}
            className={inputCls}
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">
            Modalità di pagamento
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
          Sviluppa
        </button>
        {calcolato ? (
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded border border-[var(--navy)] bg-white px-4 text-sm font-medium text-[var(--navy)] disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : "Salva piano sul residuo"}
          </button>
        ) : null}
      </div>

      {calcolato && rate.length > 0 ? (
        <div className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2">
          <p className="text-xs font-semibold text-[var(--navy)]">
            Piano rate sul residuo ({euro(parseEuroInput(residuoText) ?? 0)})
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs">
            {rate.map((r) => (
              <li
                key={r.numero}
                className="flex justify-between gap-2 tabular-nums text-[var(--muted)]"
              >
                <span>
                  Rata {r.numero} · {dataIt(r.scadenza)}
                </span>
                <span className="font-semibold text-[var(--navy)]">
                  {euro(r.importo)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      <p className="text-[11px] text-[var(--muted)]">
        Come CreditCalc: i campi si aggiornano a vicenda. «Sviluppa» calcola le
        rate; «Salva» crea il piano sulla pratica con il residuo negoziato.
      </p>
    </form>
  );
}
