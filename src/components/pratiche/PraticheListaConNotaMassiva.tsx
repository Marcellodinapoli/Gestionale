"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { addAttivitaMassivaAction } from "@/actions/core";
import { StatoBadge } from "@/components/ui";
import {
  CheckboxSelezione,
  useSelezionePratiche,
} from "@/components/affidi/affidoSelezione";
import { CODICI_SCARICO } from "@/lib/scarico";
import type { AltriFiltri } from "@/lib/praticheAltriFiltri";

export type PraticaListaRow = {
  id: string;
  numero: string;
  stato: string;
  residuoLabel: string;
  esitoLabel: string;
  ultimaLavorazioneLabel: string;
  debitoreNome: string;
  debitoreTelefono: string | null;
  debitoreCap: string | null;
  debitoreCitta: string | null;
  debitoreProv: string | null;
  debitoreCf: string | null;
  mandanteCodice: string;
  assegnatarioNome: string | null;
  lotto: string | null;
  dataAffidoLabel: string;
  scadenzaLabel: string;
  codScarico: string | null;
  affidoProvvisorio: boolean;
  importoRataLabel: string;
  totIncassatoLabel: string;
  importoTotaleLabel: string;
  garanteLabel: string;
  href: string;
};

type SortCol = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  arrow: string;
};

const inp =
  "h-7 w-[7.25rem] shrink-0 rounded border border-[var(--line)] bg-white px-1 text-[11px] text-[var(--navy)]";
const inpSm =
  "h-7 w-[5.5rem] shrink-0 rounded border border-[var(--line)] bg-white px-1 text-[11px] text-[var(--navy)]";

/** Colonne lista: intestazione ordinabile + filtro sulla riga sotto (una sola riga, scroll X). */
const LIST_COLS = [
  { key: "numero", label: "Numero", sortKey: "numero" },
  { key: "debitore", label: "Debitore", sortKey: "debitore" },
  { key: "cap", label: "CAP", sortKey: "cap" },
  { key: "citta", label: "Città", sortKey: "citta" },
  { key: "prov", label: "Prov.", sortKey: "prov" },
  { key: "telefono", label: "Telefono", sortKey: "telefono" },
  { key: "dataAffido", label: "Data affido", sortKey: "dataAffido" },
  { key: "scadenza", label: "Scad. mandato", sortKey: "scadenza" },
  { key: "mandante", label: "Mandante", sortKey: "mandante" },
  { key: "lotto", label: "Perimetro", sortKey: "lotto" },
  { key: "assegnatario", label: "Assegnatario", sortKey: "assegnatario" },
  { key: "codScarico", label: "Cod. scarico", sortKey: "codScarico" },
  { key: "affidoProvv", label: "Aff. provv.", sortKey: "affidoProvv" },
  { key: "stato", label: "Stato", sortKey: "stato" },
  { key: "esito", label: "Esito contatto", sortKey: "esito" },
  { key: "ultimaLavorazione", label: "Ultima lavorazione", sortKey: "ultimaLavorazione" },
  { key: "residuo", label: "Residuo", sortKey: "residuo" },
  { key: "importoRata", label: "Imp. rata", sortKey: "importoRata" },
  { key: "totIncassato", label: "Tot. inc.", sortKey: "totIncassato" },
  { key: "importoTot", label: "Imp. tot.", sortKey: "importoTot" },
  { key: "cfPiva", label: "C.F. / P.IVA", sortKey: "cfPiva" },
  { key: "garante", label: "Garante", sortKey: "garante" },
] as const;

type ColKey = (typeof LIST_COLS)[number]["key"];

function cellData(p: PraticaListaRow, key: ColKey): ReactNode {
  switch (key) {
    case "numero":
      return (
        <Link className="text-[var(--accent)] underline" href={p.href}>
          {p.numero}
        </Link>
      );
    case "debitore":
      return p.debitoreNome;
    case "cap":
      return p.debitoreCap || "—";
    case "citta":
      return p.debitoreCitta || "—";
    case "prov":
      return p.debitoreProv || "—";
    case "telefono":
      return p.debitoreTelefono || "—";
    case "dataAffido":
      return p.dataAffidoLabel;
    case "scadenza":
      return p.scadenzaLabel;
    case "mandante":
      return p.mandanteCodice;
    case "lotto":
      return p.lotto || "—";
    case "assegnatario":
      return p.assegnatarioNome || "—";
    case "codScarico":
      return p.codScarico || "—";
    case "affidoProvv":
      return p.affidoProvvisorio ? "Sì" : "—";
    case "stato":
      return <StatoBadge stato={p.stato} />;
    case "esito":
      return p.esitoLabel;
    case "ultimaLavorazione":
      return (
        <span className="whitespace-nowrap tabular-nums">{p.ultimaLavorazioneLabel}</span>
      );
    case "residuo":
      return p.residuoLabel;
    case "importoRata":
      return p.importoRataLabel;
    case "totIncassato":
      return p.totIncassatoLabel;
    case "importoTot":
      return p.importoTotaleLabel;
    case "cfPiva":
      return p.debitoreCf || "—";
    case "garante":
      return p.garanteLabel;
    default:
      return "—";
  }
}

function DaAInputs({
  nameDa,
  nameA,
  type = "text",
  defaultDa,
  defaultA,
  step,
}: {
  nameDa: string;
  nameA: string;
  type?: "text" | "date" | "number";
  defaultDa?: string;
  defaultA?: string;
  step?: string;
}) {
  const cls = type === "date" ? inp : inpSm;
  return (
    <span className="inline-flex flex-nowrap items-center gap-0.5">
      <input
        type={type}
        name={nameDa}
        defaultValue={defaultDa || ""}
        placeholder="Da"
        step={step}
        className={cls}
        title="Da"
      />
      <input
        type={type}
        name={nameA}
        defaultValue={defaultA || ""}
        placeholder="A"
        step={step}
        className={cls}
        title="A"
      />
    </span>
  );
}

function FilterCell({
  colKey,
  a,
  operatori,
  mandanti,
  lotti,
}: {
  colKey: ColKey;
  a: AltriFiltri;
  operatori?: Array<{ id: string; name: string }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
}) {
  switch (colKey) {
    case "numero":
      return (
        <DaAInputs
          nameDa="nPraticaDa"
          nameA="nPraticaA"
          defaultDa={a.nPraticaDa}
          defaultA={a.nPraticaA}
        />
      );
    case "debitore":
      return (
        <input
          name="debitore"
          defaultValue={a.debitore || ""}
          placeholder="Debitore"
          className={inp}
        />
      );
    case "cap":
      return (
        <DaAInputs nameDa="capDa" nameA="capA" defaultDa={a.capDa} defaultA={a.capA} />
      );
    case "citta":
      return (
        <input name="citta" defaultValue={a.citta || ""} placeholder="Città" className={inp} />
      );
    case "prov":
      return (
        <input name="prov" defaultValue={a.prov || ""} placeholder="Prov." className={inp} />
      );
    case "telefono":
      return (
        <input
          name="telefono"
          defaultValue={a.telefono || ""}
          placeholder="Telefono"
          className={inp}
        />
      );
    case "dataAffido":
      return (
        <DaAInputs
          type="date"
          nameDa="affidoDa"
          nameA="affidoA"
          defaultDa={a.affidoDa}
          defaultA={a.affidoA}
        />
      );
    case "scadenza":
      return (
        <DaAInputs
          type="date"
          nameDa="scadenzaDa"
          nameA="scadenzaA"
          defaultDa={a.scadenzaDa}
          defaultA={a.scadenzaA}
        />
      );
    case "mandante":
      return (
        <select name="mandato" defaultValue={a.mandato || ""} className={inp}>
          <option value="">Tutti</option>
          {(mandanti || []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.codice}
            </option>
          ))}
        </select>
      );
    case "lotto":
      return (
        <select name="lotto" defaultValue={a.lotto || ""} className={inp}>
          <option value="">Tutti</option>
          {(lotti || []).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      );
    case "assegnatario":
      return (
        <select name="operatore" defaultValue={a.operatore || ""} className={inp}>
          <option value="">Tutti</option>
          {(operatori || []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      );
    case "codScarico":
      return (
        <select name="codScarico" defaultValue={a.codScarico || ""} className={inp}>
          <option value="">Tutti</option>
          {CODICI_SCARICO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      );
    case "affidoProvv":
      return (
        <select
          name="affidoProvvisorio"
          defaultValue={a.affidoProvvisorio || ""}
          className={inp}
        >
          <option value="">—</option>
          <option value="1">Sì</option>
        </select>
      );
    case "residuo":
      return (
        <DaAInputs
          type="number"
          step="0.01"
          nameDa="residuoDa"
          nameA="residuoA"
          defaultDa={a.residuoDa}
          defaultA={a.residuoA}
        />
      );
    case "importoRata":
      return (
        <DaAInputs
          type="number"
          step="0.01"
          nameDa="importoRataDa"
          nameA="importoRataA"
          defaultDa={a.importoRataDa}
          defaultA={a.importoRataA}
        />
      );
    case "totIncassato":
      return (
        <DaAInputs
          type="number"
          step="0.01"
          nameDa="totIncassatoDa"
          nameA="totIncassatoA"
          defaultDa={a.totIncassatoDa}
          defaultA={a.totIncassatoA}
        />
      );
    case "importoTot":
      return (
        <DaAInputs
          type="number"
          step="0.01"
          nameDa="importoTotDa"
          nameA="importoTotA"
          defaultDa={a.importoTotDa}
          defaultA={a.importoTotA}
        />
      );
    case "cfPiva":
      return (
        <input
          name="cfPiva"
          defaultValue={a.cfPiva || ""}
          placeholder="C.F."
          className={inp}
        />
      );
    case "garante":
      return (
        <input
          name="garante"
          defaultValue={a.garante || ""}
          placeholder="Garante"
          className={inp}
        />
      );
    default:
      return <span className="inline-block h-7" />;
  }
}

export function PraticheListaConNotaMassiva({
  pratiche,
  sortColumns,
  canNotaMassiva,
  altri,
  operatori,
  mandanti,
  lotti,
  navHidden,
}: {
  pratiche: PraticaListaRow[];
  sortColumns: SortCol[];
  canNotaMassiva: boolean;
  altri?: AltriFiltri;
  operatori?: Array<{ id: string; name: string }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
  navHidden?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const { selected, allRef, allChecked, toggleAll, toggleOne } =
    useSelezionePratiche(pratiche.map((p) => p.id));
  const [nota, setNota] = useState("");
  const [importante, setImportante] = useState(false);
  const [fissa, setFissa] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedIds = [...selected];
  const a = altri || {};
  const colSpan = LIST_COLS.length + (canNotaMassiva ? 1 : 0);
  const sortByKey = new Map(sortColumns.map((c) => [c.key, c]));

  function inviaNotaMassiva() {
    const testo = nota.trim();
    if (!selectedIds.length || !testo) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("nota", testo);
        if (importante) fd.set("importante", "1");
        if (fissa) fd.set("fissa", "1");
        for (const id of selectedIds) fd.append("praticaId", id);
        const result = await addAttivitaMassivaAction(fd);
        setNota("");
        setImportante(false);
        setFissa(false);
        const flags = [
          result.importante ? "importante" : null,
          result.fissata ? "fissa" : null,
        ]
          .filter(Boolean)
          .join(", ");
        setMsg(
          result.saltate
            ? `Nota scritta su ${result.scritte} pratiche (${result.saltate} saltate: non accessibili o in uso)${
                flags ? ` · ${flags}` : ""
              }`
            : `Nota scritta su ${result.scritte} pratiche${flags ? ` · ${flags}` : ""}`
        );
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  const hiddenNav = (
    <>
      <input type="hidden" name="page" value="1" />
      {navHidden?.q ? <input type="hidden" name="q" value={navHidden.q} /> : null}
      {navHidden?.stato ? <input type="hidden" name="stato" value={navHidden.stato} /> : null}
      {navHidden?.esito ? <input type="hidden" name="esito" value={navHidden.esito} /> : null}
      {navHidden?.lavorateData ? (
        <input type="hidden" name="lavorateData" value={navHidden.lavorateData} />
      ) : null}
      {navHidden?.lavorateFascia ? (
        <input type="hidden" name="lavorateFascia" value={navHidden.lavorateFascia} />
      ) : null}
      {navHidden?.sort ? <input type="hidden" name="sort" value={navHidden.sort} /> : null}
      {navHidden?.dir ? <input type="hidden" name="dir" value={navHidden.dir} /> : null}
      {a.note ? <input type="hidden" name="note" value={a.note} /> : null}
      {a.sitAffido ? <input type="hidden" name="sitAffido" value={a.sitAffido} /> : null}
      {a.promPagDa ? <input type="hidden" name="promPagDa" value={a.promPagDa} /> : null}
      {a.promPagA ? <input type="hidden" name="promPagA" value={a.promPagA} /> : null}
      {a.incassatoDa ? <input type="hidden" name="incassatoDa" value={a.incassatoDa} /> : null}
      {a.incassatoA ? <input type="hidden" name="incassatoA" value={a.incassatoA} /> : null}
      {a.memoDa ? <input type="hidden" name="memoDa" value={a.memoDa} /> : null}
      {a.memoA ? <input type="hidden" name="memoA" value={a.memoA} /> : null}
      {a.aggiuntivo ? <input type="hidden" name="aggiuntivo" value={a.aggiuntivo} /> : null}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {canNotaMassiva ? (
        <div
          className={`rounded-xl border p-3 transition-colors ${
            importante
              ? "border-amber-400 bg-[#ffe08a]"
              : fissa
                ? "border-sky-300 bg-sky-50"
                : "border-[var(--line)] bg-white"
          }`}
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1 text-sm">
              <span
                className={`mb-1 block text-[10px] font-semibold uppercase ${
                  importante ? "text-[#5a3e00]" : "text-[var(--muted)]"
                }`}
              >
                Nota massiva
                {importante && fissa
                  ? " · importante + fissa"
                  : importante
                    ? " · messaggio importante"
                    : fissa
                      ? " · fissa"
                      : ""}
              </span>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                placeholder="Testo della nota da scrivere su tutte le pratiche selezionate…"
                className={`w-full rounded-lg border px-2 py-1.5 text-sm ${
                  importante
                    ? "border-amber-500 bg-white text-[#5a3e00]"
                    : "border-[var(--line)] bg-white"
                }`}
                disabled={pending}
              />
            </label>
            <div className="flex shrink-0 flex-col gap-1.5 pb-0.5 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={importante}
                  disabled={pending}
                  onChange={(e) => setImportante(e.target.checked)}
                  className="h-3.5 w-3.5 accent-amber-600"
                />
                <span
                  className={`font-semibold ${
                    importante ? "text-[#5a3e00]" : "text-[var(--navy)]"
                  }`}
                >
                  Messaggio importante
                </span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={fissa}
                  disabled={pending}
                  onChange={(e) => setFissa(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--navy)]"
                />
                <span className="font-semibold text-[var(--navy)]">Fissa</span>
              </label>
            </div>
            <button
              type="button"
              onClick={inviaNotaMassiva}
              disabled={pending || !selectedIds.length || !nota.trim()}
              className={`h-9 shrink-0 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 ${
                importante ? "bg-amber-700" : "bg-[var(--navy)]"
              }`}
            >
              {pending
                ? "Scrittura…"
                : selectedIds.length
                  ? `Scrivi su ${selectedIds.length} pratiche`
                  : "Seleziona pratiche"}
            </button>
          </div>
          <p
            className={`mt-1.5 text-[11px] ${
              importante ? "text-[#5a3e00]/80" : "text-[var(--muted)]"
            }`}
          >
            <strong>Importante</strong> = sfondo giallo. <strong>Fissa</strong> = pin in alto
            nella pratica (come Togli/Fissa in scheda).
          </p>
          {msg ? (
            <p
              className={`mt-1.5 text-xs font-semibold ${
                msg.startsWith("Nota scritta") ? "text-emerald-700" : "text-amber-800"
              }`}
            >
              {msg}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-white">
        <div
          className="min-h-0 flex-1 overflow-x-scroll overflow-y-auto"
          style={{ scrollbarGutter: "stable" }}
        >
          <form method="get" action="/pratiche" className="min-w-max">
            {hiddenNav}
            <table
              className="border-collapse text-sm"
              style={{ minWidth: `${Math.max(1600, LIST_COLS.length * 150 + 160)}px` }}
            >
              <thead className="bg-[#e8eef4] text-left text-[var(--muted)]">
                {/* Una sola riga: titolo ordinabile + filtro sotto, nella stessa cella */}
                <tr>
                  {canNotaMassiva ? (
                    <th className="sticky left-0 z-[1] w-10 bg-[#e8eef4] px-3 py-2 align-middle">
                      <CheckboxSelezione
                        inputRef={allRef}
                        checked={allChecked}
                        onChange={toggleAll}
                        label="Seleziona tutte"
                      />
                    </th>
                  ) : null}
                  {LIST_COLS.map((col) => {
                    const sort = sortByKey.get(col.sortKey);
                    return (
                      <th
                        key={col.key}
                        className="whitespace-nowrap px-1.5 py-1.5 align-bottom"
                      >
                        <div className="inline-flex flex-col items-stretch gap-1">
                          {sort ? (
                            <Link
                              href={sort.href}
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold hover:text-[var(--navy)] ${
                                sort.active ? "font-bold text-[var(--navy)]" : ""
                              }`}
                              title="Ordina crescente / decrescente"
                            >
                              {col.label}
                              <span className="text-[10px] text-[var(--navy)]">
                                {sort.arrow?.trim() || "⇅"}
                              </span>
                            </Link>
                          ) : (
                            <span className="text-[11px] font-semibold">{col.label}</span>
                          )}
                          <FilterCell
                            colKey={col.key}
                            a={a}
                            operatori={operatori}
                            mandanti={mandanti}
                            lotti={lotti}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pratiche.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-t border-[var(--line)] ${
                      canNotaMassiva && selected.has(p.id) ? "bg-[#eef4f8]/60" : ""
                    }`}
                  >
                    {canNotaMassiva ? (
                      <td className="sticky left-0 z-[1] bg-white px-3 py-2">
                        <CheckboxSelezione
                          checked={selected.has(p.id)}
                          onChange={() => toggleOne(p.id)}
                          label={`Seleziona ${p.numero}`}
                        />
                      </td>
                    ) : null}
                    {LIST_COLS.map((col) => (
                      <td key={col.key} className="px-2 py-2 text-xs whitespace-nowrap">
                        {cellData(p, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!pratiche.length ? (
                  <tr>
                    <td
                      colSpan={colSpan}
                      className="px-3 py-8 text-center text-[var(--muted)]"
                    >
                      Nessuna pratica trovata con i filtri selezionati.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </form>
        </div>
      </div>
    </div>
  );
}
