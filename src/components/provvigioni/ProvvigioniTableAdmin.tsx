"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Check, X } from "lucide-react";
import {
  liquidaProvvigioneAction,
  liquidaMassivaAction,
  updateImportoProvvigioneAction,
} from "@/actions/provvigioniAdmin";
import { isImportoFissoProvvigioneId } from "@/lib/provvigioniImportoFisso";
import type { SezioneProvvigioni } from "@/lib/provvigioniDisplay";
import { ProvvigioniPannelloEconomico } from "@/components/provvigioni/ProvvigioniListaPerimetro";

type Riga = {
  id: string;
  praticaId: string;
  praticaNumero: string;
  debitoreNome: string;
  operatoreNome: string;
  data: string;
  baseImporto: number;
  percentuale: number;
  importo: number;
  stato: string;
  statoLabel: string;
  perimetro: string;
  codiceScarico: string;
};

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function ProvvigioniTableAdmin({
  sezioni,
}: {
  sezioni: SezioneProvvigioni<Riga>[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [liquidando, setLiquidando] = useState(false);

  const righe = sezioni.flatMap((s) => s.righe);
  const maturate = righe.filter((r) => r.stato === "MATURATA" && !isImportoFissoProvvigioneId(r.id));
  const allSelected = maturate.length > 0 && maturate.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(maturate.map((r) => r.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function liquidaMassiva() {
    if (!selected.size) return;
    setLiquidando(true);
    try {
      const fd = new FormData();
      fd.set("ids", JSON.stringify([...selected]));
      await liquidaMassivaAction(fd);
      setSelected(new Set());
      router.refresh();
    } finally {
      setLiquidando(false);
    }
  }

  if (!sezioni.length) {
    return (
      <p className="rounded-xl border border-[var(--line)] bg-white p-8 text-center text-[var(--muted)]">
        Nessuna provvigione nel mese selezionato.
      </p>
    );
  }

  return (
    <div>
      {maturate.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-3.5 w-3.5"
            />
            Seleziona tutte le maturate ({maturate.length})
          </label>
          {selected.size > 0 && (
            <button
              onClick={liquidaMassiva}
              disabled={liquidando}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {liquidando
                ? "Liquidazione..."
                : `Liquida ${selected.size} selezionat${selected.size === 1 ? "a" : "e"}`}
            </button>
          )}
        </div>
      )}
      <div className="space-y-5">
        {sezioni.map((sez) => (
          <section
            key={sez.perimetro}
            className="overflow-hidden rounded-xl border-2 border-[#1a4f7a]/25 bg-white shadow-sm"
          >
            <header className="border-b border-[#1a4f7a]/20 bg-[#1a4f7a] px-4 py-2.5 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90">
                Perimetro
              </p>
              <h3 className="text-base font-bold tracking-tight">
                {sez.perimetro}
                <span className="ml-2 text-sm font-normal opacity-90">
                  · Mandato {sez.mandanteCodice}
                </span>
              </h3>
            </header>

            <ProvvigioniPannelloEconomico sez={sez} />

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[var(--muted)]">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-3 py-2">Perimetro</th>
                    <th className="px-3 py-2">Data</th>
                    <th>Operatore</th>
                    <th>Codice scarico</th>
                    <th>Pratica</th>
                    <th>Debitore</th>
                    <th>Incasso</th>
                    <th>%</th>
                    <th>Provvigione</th>
                    <th>Stato</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {sez.righe.map((r) => (
                    <RigaProvvigione
                      key={r.id}
                      r={r}
                      checked={selected.has(r.id)}
                      onToggle={() => toggle(r.id)}
                    />
                  ))}
                  {!sez.righe.length ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-4 text-center text-[var(--muted)]">
                        Nessun movimento in questo perimetro nel mese selezionato.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function RigaProvvigione({
  r,
  checked,
  onToggle,
}: {
  r: Riga;
  checked: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const fisso = isImportoFissoProvvigioneId(r.id);
  const [editing, setEditing] = useState(false);
  const [importo, setImporto] = useState(String(r.importo));
  const [perc, setPerc] = useState(String(r.percentuale));
  const [saving, setSaving] = useState(false);

  async function salva() {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", r.id);
      fd.set("importo", importo);
      fd.set("percentuale", perc);
      await updateImportoProvvigioneAction(fd);
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStato() {
    const nuovoStato = r.stato === "MATURATA" ? "LIQUIDATA" : "MATURATA";
    const fd = new FormData();
    fd.set("id", r.id);
    fd.set("stato", nuovoStato);
    await liquidaProvvigioneAction(fd);
    router.refresh();
  }

  return (
    <tr className="border-t border-[var(--line)]">
      <td className="px-2 py-2">
        {r.stato === "MATURATA" && !fisso && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="h-3.5 w-3.5"
          />
        )}
      </td>
      <td className="px-3 py-2">{r.perimetro}</td>
      <td className="px-3 py-2 whitespace-nowrap">{r.data}</td>
      <td>{r.operatoreNome}</td>
      <td className="font-mono text-xs">{r.codiceScarico}</td>
      <td>
        {fisso || !r.praticaId ? (
          <span className="text-[var(--muted)]">{r.praticaNumero}</span>
        ) : (
          <Link className="text-[var(--accent)] underline" href={`/pratiche/${r.praticaId}`}>
            {r.praticaNumero}
          </Link>
        )}
      </td>
      <td>{r.debitoreNome}</td>
      <td>{euro(r.baseImporto)}</td>
      <td>
        {editing ? (
          <input
            value={perc}
            onChange={(e) => setPerc(e.target.value)}
            className="h-6 w-14 rounded border border-[var(--line)] px-1 text-xs"
          />
        ) : (
          `${r.percentuale.toFixed(1)}%`
        )}
      </td>
      <td className="font-semibold">
        {editing ? (
          <input
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className="h-6 w-20 rounded border border-[var(--line)] px-1 text-xs"
          />
        ) : (
          euro(r.importo)
        )}
      </td>
      <td>
        {fisso ? (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
              r.stato === "LIQUIDATA"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {r.statoLabel}
          </span>
        ) : (
          <button onClick={toggleStato} title="Cambia stato">
            <span
              className={`inline-flex cursor-pointer rounded-full px-2 py-0.5 text-xs font-semibold ${
                r.stato === "LIQUIDATA"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {r.statoLabel}
            </span>
          </button>
        )}
      </td>
      <td>
        {fisso ? null : editing ? (
          <span className="flex items-center gap-1">
            <button onClick={salva} disabled={saving} className="text-emerald-600">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setImporto(String(r.importo));
                setPerc(String(r.percentuale));
              }}
              className="text-[var(--muted)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-[var(--muted)] hover:text-[var(--accent)]"
            title="Modifica importo"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
