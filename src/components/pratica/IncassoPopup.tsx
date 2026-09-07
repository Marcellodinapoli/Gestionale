"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addIncassoAction } from "@/actions/core";
import { METODI_INCASSO } from "@/lib/metodoIncasso";
import {
  MODI_INCASSO_PROVV,
  MODO_INCASSO_NON_PROVV,
  MODO_INCASSO_VERIFICATO,
} from "@/lib/incassoFattura";
import { fetchPraticaExtra } from "@/lib/praticaExtraClient";
import { euro, ripartiIncasso, roundMoney } from "@/lib/domainFormat";

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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
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

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-3 py-3 text-sm">
      <input type="hidden" name="praticaId" value={praticaId} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">Importo totale pagato</span>
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
            Copertura automatica: rata → spese → spese recupero → eccesso a capitale. Puoi
            modificare le voci sotto.
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
          <span className="font-semibold text-[var(--muted)]">Fattura insoluta</span>
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
            <li
              key={v.key}
              className="flex items-center gap-2 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[var(--navy)]">{v.label}</div>
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
  );
}
