"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addIncassoAction,
  addIncassiPianoEffettiAction,
} from "@/actions/core";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import {
  MODI_INCASSO_PROVV,
  MODO_INCASSO_NON_PROVV,
  MODO_INCASSO_VERIFICATO,
} from "@/lib/incassoFattura";
import { fetchPraticaExtra } from "@/lib/praticaExtraClient";
import { euro, ripartiIncasso, roundMoney, dataIt } from "@/lib/domainFormat";
import {
  buildPianoEffettiSchedule,
  splitImportiPianoEffetti,
  type DistribuzionePianoEffetti,
} from "@/lib/incassoPianoEffetti";

type FatturaOpt = {
  id: string;
  numero: string;
  importo: number;
  pagato: number;
};

export type IncassoRipartoPratica = {
  capitale: number;
  interessi: number;
  spese: number;
  speseRecupero: number;
  importoRata: number | null;
};

type VociRiparto = {
  capitale: number;
  interessi: number;
  spese: number;
  speseRec: number;
};

type VociTesto = Record<keyof VociRiparto, string>;

const VOCI: Array<{
  key: keyof VociRiparto;
  label: string;
  residuoKey: "capitale" | "interessi" | "spese" | "speseRecupero";
}> = [
  { key: "capitale", label: "Capitale", residuoKey: "capitale" },
  { key: "interessi", label: "Mora", residuoKey: "interessi" },
  { key: "spese", label: "Spese", residuoKey: "spese" },
  { key: "speseRec", label: "Spese di recupero", residuoKey: "speseRecupero" },
];

const METODI_EFFETTI = METODI_INCASSO.filter(
  (m) => m.value === "pdr_cambiali" || m.value === "assegni"
);

function emptyVoci(): VociRiparto {
  return { capitale: 0, interessi: 0, spese: 0, speseRec: 0 };
}

function vociToTesto(v: VociRiparto): VociTesto {
  return {
    capitale: v.capitale ? String(v.capitale) : "",
    interessi: v.interessi ? String(v.interessi) : "",
    spese: v.spese ? String(v.spese) : "",
    speseRec: v.speseRec ? String(v.speseRec) : "",
  };
}

function parseMoney(raw: string) {
  return roundMoney(Number(String(raw).replace(",", ".")) || 0);
}

function sumVoci(v: VociRiparto) {
  return roundMoney(v.capitale + v.interessi + v.spese + v.speseRec);
}

function todayInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function IncassoPopup({
  praticaId,
  riparto,
  onDone,
}: {
  praticaId: string;
  riparto: IncassoRipartoPratica;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"singolo" | "piano">("singolo");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modo, setModo] = useState(MODO_INCASSO_VERIFICATO);
  const [fatture, setFatture] = useState<FatturaOpt[]>([]);
  const [fattureLoading, setFattureLoading] = useState(true);
  const [importo, setImporto] = useState("");
  const [voci, setVoci] = useState<VociRiparto>(emptyVoci);
  const [vociTesto, setVociTesto] = useState<VociTesto>(vociToTesto(emptyVoci()));
  const [giaPagato, setGiaPagato] = useState({
    capitale: 0,
    interessi: 0,
    spese: 0,
    speseRec: 0,
  });
  const [giaReady, setGiaReady] = useState(false);

  const [numeroEffetti, setNumeroEffetti] = useState("12");
  const [importoPiano, setImportoPiano] = useState("");
  const [metodoEffetti, setMetodoEffetti] = useState<"pdr_cambiali" | "assegni">(
    "pdr_cambiali"
  );
  const [distribuzione, setDistribuzione] =
    useState<DistribuzionePianoEffetti>("mensile");
  const [dataInizio, setDataInizio] = useState(todayInput());
  const [causalePiano, setCausalePiano] = useState("");

  useEffect(() => {
    let cancelled = false;
    setFattureLoading(true);
    fetchPraticaExtra(praticaId, { force: true }).then((data) => {
      if (cancelled) return;
      const list = (data?.fatture || [])
        .map((f) => ({
          id: f.id,
          numero: f.numero,
          importo: f.importo,
          pagato: f.pagato,
        }))
        .filter((f) => f.importo - f.pagato > 0.009);
      setFatture(list);
      const gia = (data?.incassi || []).reduce(
        (acc, i) => ({
          capitale: acc.capitale + (i.capitale || 0),
          interessi: acc.interessi + (i.interessi || 0),
          spese: acc.spese + (i.spese || 0),
          speseRec: acc.speseRec + (i.speseRec || 0),
        }),
        { capitale: 0, interessi: 0, spese: 0, speseRec: 0 }
      );
      setGiaPagato(gia);
      setGiaReady(true);
      setFattureLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [praticaId]);

  useEffect(() => {
    if (!giaReady) return;
    const n = parseMoney(importo);
    if (n > 0) applicaRipartoAuto(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al carico residui già pagati
  }, [giaReady]);

  const residui = useMemo(
    () => ({
      capitale: Math.max(0, riparto.capitale - giaPagato.capitale),
      interessi: Math.max(0, riparto.interessi - giaPagato.interessi),
      spese: Math.max(0, riparto.spese - giaPagato.spese),
      speseRecupero: Math.max(0, riparto.speseRecupero - giaPagato.speseRec),
    }),
    [riparto, giaPagato]
  );

  const insolite = useMemo(() => fatture, [fatture]);
  const totaleRiparto = sumVoci(voci);
  const importoNum = parseMoney(importo);
  const differenza = roundMoney(importoNum - totaleRiparto);

  const nEffetti = Math.floor(Number(numeroEffetti) || 0);
  const totalePiano = parseMoney(importoPiano);
  const anteprimaPiano = useMemo(() => {
    if (nEffetti < 2 || totalePiano <= 0 || !dataInizio) return null;
    const importi = splitImportiPianoEffetti(totalePiano, nEffetti);
    const start = new Date(`${dataInizio}T12:00:00`);
    if (Number.isNaN(start.getTime())) return null;
    const lines = buildPianoEffettiSchedule({
      dataInizio: start,
      n: nEffetti,
      importi,
      distribuzione,
    });
    if (!lines.length) return null;
    return {
      count: lines.length,
      unit: lines[0]!.importo,
      last: lines[lines.length - 1]!.importo,
      from: lines[0]!.dataScadenza,
      to: lines[lines.length - 1]!.dataScadenza,
    };
  }, [nEffetti, totalePiano, dataInizio, distribuzione]);

  function applicaRipartoAuto(totale: number) {
    const split = ripartiIncasso(
      Math.max(0, totale),
      {
        capitale: riparto.capitale,
        interessi: riparto.interessi,
        spese: riparto.spese,
        speseRecupero: riparto.speseRecupero,
        importoRata: riparto.importoRata,
      },
      giaPagato
    );
    const next = {
      capitale: roundMoney(split.capitale),
      interessi: roundMoney(split.interessi),
      spese: roundMoney(split.spese),
      speseRec: roundMoney(split.speseRec),
    };
    setVoci(next);
    setVociTesto(vociToTesto(next));
  }

  function onImportoChange(raw: string) {
    setImporto(raw);
    applicaRipartoAuto(parseMoney(raw));
  }

  function onVoceChange(key: keyof VociRiparto, raw: string) {
    setVociTesto((prev) => ({ ...prev, [key]: raw }));
    setVoci((prev) => ({ ...prev, [key]: Math.max(0, parseMoney(raw)) }));
  }

  async function onSubmitSingolo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (importoNum <= 0) {
      setError("Importo non valido");
      return;
    }
    if (Math.abs(differenza) > 0.02) {
      setError(
        `Il riparto (${euro(totaleRiparto)}) non coincide con l'importo totale (${euro(importoNum)})`
      );
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set("importo", String(importoNum));
      fd.set("capitale", String(voci.capitale));
      fd.set("interessi", String(voci.interessi));
      fd.set("spese", String(voci.spese));
      fd.set("speseRec", String(voci.speseRec));
      await addIncassoAction(fd);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrazione non riuscita");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitPiano(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (nEffetti < 2 || nEffetti > 360) {
      setError("Indica da 2 a 360 effetti");
      return;
    }
    if (totalePiano <= 0) {
      setError("Importo totale piano non valido");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("numeroEffetti", String(nEffetti));
      fd.set("importoTotale", String(totalePiano));
      fd.set("metodo", metodoEffetti);
      fd.set("distribuzione", distribuzione);
      fd.set("dataInizio", dataInizio);
      fd.set("modo", modo);
      fd.set("causale", causalePiano);
      await addIncassiPianoEffettiAction(fd);
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registrazione piano non riuscita"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 px-3 py-3 text-sm">
      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--line)] bg-[#eef2f6] p-1">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
            mode === "singolo"
              ? "bg-[var(--navy)] text-white"
              : "text-[var(--navy)] hover:bg-white"
          }`}
          onClick={() => {
            setMode("singolo");
            setError(null);
          }}
        >
          Incasso singolo
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
            mode === "piano"
              ? "bg-[var(--navy)] text-white"
              : "text-[var(--navy)] hover:bg-white"
          }`}
          onClick={() => {
            setMode("piano");
            setError(null);
          }}
        >
          Piano cambiali / assegni
        </button>
      </div>

      {mode === "singolo" ? (
        <form onSubmit={onSubmitSingolo} className="space-y-3">
          <input type="hidden" name="praticaId" value={praticaId} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">
                Importo totale pagato
              </span>
              <input
                name="importo"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={importo}
                onChange={(e) => onImportoChange(e.target.value)}
                placeholder="0,00"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
              <span className="mt-0.5 block text-[10px] leading-snug text-[var(--muted)]">
                Copertura automatica: rata → spese → spese recupero → eccesso a
                capitale. Puoi modificare le voci sotto.
              </span>
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">Metodo</span>
              <select
                name="metodo"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              >
                {METODI_INCASSO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">Data</span>
              <input
                type="date"
                name="data"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">Esito</span>
              <select
                name="modo"
                value={modo}
                onChange={(e) => setModo(e.target.value)}
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              >
                {MODI_INCASSO_PROVV.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {modo === MODO_INCASSO_NON_PROVV ? (
                <span className="mt-0.5 block text-[10px] text-amber-800">
                  Non conteggiato nelle provvigioni
                </span>
              ) : null}
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold text-[var(--muted)]">
                Fattura insoluta
              </span>
              <select
                name="fattura"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
                disabled={fattureLoading}
                defaultValue=""
              >
                <option value="">
                  {fattureLoading
                    ? "Caricamento…"
                    : insolite.length
                      ? "— Seleziona fattura —"
                      : "Nessuna fattura insoluta"}
                </option>
                {insolite.map((f) => {
                  const saldo = Math.max(0, f.importo - f.pagato);
                  return (
                    <option key={f.id} value={f.numero}>
                      {f.numero} · saldo {euro(saldo)}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold text-[var(--muted)]">Causale</span>
              <input
                name="causale"
                placeholder="Causale"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
            </label>
          </div>

          <div className="rounded border border-[var(--line)] bg-[#f8fafc]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-2.5 py-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--navy)]">
                Riparto incasso
              </span>
              <button
                type="button"
                className="text-[10px] font-semibold text-[var(--navy)] underline-offset-2 hover:underline disabled:opacity-40"
                disabled={importoNum <= 0}
                onClick={() => applicaRipartoAuto(importoNum)}
              >
                Ricalcola automatico
              </button>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {VOCI.map((v) => (
                <li key={v.key} className="flex items-center gap-2 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--navy)]">
                      {v.label}
                    </div>
                    <div className="text-[10px] text-[var(--muted)]">
                      Residuo {euro(residui[v.residuoKey])}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name={v.key}
                    value={vociTesto[v.key]}
                    onChange={(e) => onVoceChange(v.key, e.target.value)}
                    className="h-8 w-28 shrink-0 rounded border border-[var(--line)] bg-white px-2 text-right text-sm"
                  />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-2.5 py-1.5 text-[11px]">
              <span className="text-[var(--muted)]">
                Totale ripartito {euro(totaleRiparto)}
              </span>
              {Math.abs(differenza) > 0.009 ? (
                <span className="font-semibold text-amber-800">
                  Differenza {euro(differenza)}
                </span>
              ) : (
                <span className="font-semibold text-emerald-800">Allineato</span>
              )}
            </div>
          </div>

          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="h-9 rounded border border-[var(--line)] bg-white px-3 text-sm"
              onClick={onDone}
              disabled={saving}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Registrazione…" : "Registra"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSubmitPiano} className="space-y-3">
          <p className="text-[11px] leading-snug text-[var(--muted)]">
            Registra un intero piano di rientro con cambiali o assegni come serie
            di incassi (come CreditCalc): tutte nel mese corrente oppure una al
            mese. Il riparto residuo viene applicato automaticamente a ogni
            effetto.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">
                Numero effetti
              </span>
              <input
                type="number"
                min={2}
                max={360}
                step={1}
                required
                value={numeroEffetti}
                onChange={(e) => setNumeroEffetti(e.target.value)}
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">
                Importo totale piano
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={importoPiano}
                onChange={(e) => setImportoPiano(e.target.value)}
                placeholder="0,00"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">Tipo effetto</span>
              <select
                value={metodoEffetti}
                onChange={(e) =>
                  setMetodoEffetti(e.target.value as "pdr_cambiali" | "assegni")
                }
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              >
                {METODI_EFFETTI.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">
                Data inizio / mese
              </span>
              <input
                type="date"
                required
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-semibold text-[var(--muted)]">
                Distribuzione
              </legend>
              <div className="mt-1 flex flex-col gap-1.5 sm:flex-row sm:gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-[var(--navy)]">
                  <input
                    type="radio"
                    name="distribuzione"
                    checked={distribuzione === "mese_corrente"}
                    onChange={() => setDistribuzione("mese_corrente")}
                  />
                  Tutte nel mese corrente
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-[var(--navy)]">
                  <input
                    type="radio"
                    name="distribuzione"
                    checked={distribuzione === "mensile"}
                    onChange={() => setDistribuzione("mensile")}
                  />
                  Una al mese
                </label>
              </div>
            </fieldset>
            <label className="block text-xs">
              <span className="font-semibold text-[var(--muted)]">Esito</span>
              <select
                value={modo}
                onChange={(e) => setModo(e.target.value)}
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              >
                {MODI_INCASSO_PROVV.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs sm:col-span-2">
              <span className="font-semibold text-[var(--muted)]">
                Causale (opzionale)
              </span>
              <input
                value={causalePiano}
                onChange={(e) => setCausalePiano(e.target.value)}
                placeholder="Es. PDR cambiali pratica"
                className="mt-0.5 block h-9 w-full rounded border border-[var(--line)] bg-white px-2"
              />
            </label>
          </div>

          {anteprimaPiano ? (
            <div className="rounded border border-[var(--line)] bg-[#f8fafc] px-2.5 py-2 text-[11px] text-[var(--navy)]">
              <p className="font-semibold">
                Anteprima: {anteprimaPiano.count} effetti
              </p>
              <p>
                Importo unitario ≈ {euro(anteprimaPiano.unit)}
                {Math.abs(anteprimaPiano.last - anteprimaPiano.unit) > 0.009
                  ? ` (ultima ${euro(anteprimaPiano.last)})`
                  : ""}
              </p>
              <p>
                {distribuzione === "mese_corrente"
                  ? `Tutte in data ${dataIt(anteprimaPiano.from)}`
                  : `Da ${dataIt(anteprimaPiano.from)} a ${dataIt(anteprimaPiano.to)}`}
              </p>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="h-9 rounded border border-[var(--line)] bg-white px-3 text-sm"
              onClick={onDone}
              disabled={saving}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving || !anteprimaPiano}
            >
              {saving
                ? "Registrazione piano…"
                : `Registra ${nEffetti > 0 ? nEffetti : ""} effetti`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
