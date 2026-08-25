"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { saveLavorazioneSuggeritaAction } from "@/actions/lavorazioneSuggerita";
import { LavorazioneVoceFiltriModal } from "@/components/lavorazione/LavorazioneVoceFiltriModal";
import { useLavorazioneRefreshRegister } from "@/components/lavorazione/LavorazioneRefresh";
import { describeAltriFiltri, hasAltriFiltri } from "@/lib/praticheAltriFiltri";
import {
  CODICI_SCARICO_VOCE,
  emptyVoce,
  applyPerimetroRiga,
  clearPerimetroRiga,
  codiciScaricoPerRiga,
  labelPerimetroVoce,
  matchPerimetroRiga,
  type PerimetroRigaLavorazione,
  type VoceLavorazioneConConteggi,
  type VoceLavorazioneSuggerita,
} from "@/lib/lavorazioneSuggerita";

function ConteggioCell({
  totale,
  lavorate,
  hrefTotale,
  hrefLavorate,
  loading,
}: {
  totale: number;
  lavorate: number;
  hrefTotale: string;
  hrefLavorate: string;
  loading?: boolean;
}) {
  if (loading) {
    return <span className="text-[var(--muted)]">…</span>;
  }
  return (
    <span className="tabular-nums">
      <Link
        href={hrefTotale}
        className="font-medium text-[var(--navy)] hover:underline"
        title="Pratiche assegnate nella lavorazione"
      >
        {totale}
      </Link>
      <span className="text-[var(--muted)]">/</span>
      <Link
        href={hrefLavorate}
        className="font-semibold text-emerald-600 hover:underline"
        title="Pratiche lavorate nel periodo"
      >
        {lavorate}
      </Link>
    </span>
  );
}

function VoceRiga({
  voce,
  canEdit,
  operatoriGruppo,
  mostraOperatori,
  operatoreCorrenteId,
  onChange,
  onRemove,
  onOpenFiltri,
  loadingConteggi,
  perimetriRiga,
}: {
  voce: VoceLavorazioneConConteggi;
  canEdit: boolean;
  operatoriGruppo: Array<{ id: string; name: string }>;
  mostraOperatori?: boolean;
  operatoreCorrenteId?: string;
  onChange: (next: VoceLavorazioneSuggerita) => void;
  onRemove: () => void;
  onOpenFiltri?: () => void;
  loadingConteggi?: boolean;
  perimetriRiga?: PerimetroRigaLavorazione[];
}) {
  const colonneOperatori = mostraOperatori
    ? operatoriGruppo
    : operatoreCorrenteId
      ? operatoriGruppo.filter((o) => o.id === operatoreCorrenteId)
      : [];

  const filtroLabel = describeAltriFiltri(voce.filtri);
  const haFiltri = hasAltriFiltri(voce.filtri);
  const mostraPerimetro = Boolean(perimetriRiga?.length);
  const perimetroSelezionato = mostraPerimetro ? matchPerimetroRiga(voce, perimetriRiga!) : "";
  const perimetriAffido = perimetriRiga?.filter((p) => p.situazione === "affido") ?? [];
  const perimetriLavorazione = perimetriRiga?.filter((p) => p.situazione === "lavorazione") ?? [];
  const codiciScaricoVoce = mostraPerimetro
    ? perimetroSelezionato
      ? codiciScaricoPerRiga(voce, perimetriRiga!)
      : [{ value: "" as const, label: "—" }]
    : CODICI_SCARICO_VOCE;

  function conteggioOp(opId: string) {
    return voce.operatori.find((o) => o.id === opId) ?? {
      totale: 0,
      lavorate: 0,
      hrefTotale: voce.hrefTotale,
      hrefLavorate: voce.hrefLavorate,
    };
  }

  return (
    <tr className="border-t border-[var(--line)] hover:bg-[#fafbfc]">
      {mostraPerimetro ? (
        <td className="min-w-[11rem] px-2 py-1.5 align-top">
          {canEdit ? (
            <select
              value={perimetroSelezionato}
              onChange={(e) => {
                if (!e.target.value) {
                  onChange(clearPerimetroRiga(voce));
                  return;
                }
                const peri = perimetriRiga?.find((p) => p.key === e.target.value);
                if (peri) onChange(applyPerimetroRiga(voce, peri));
              }}
              className="h-7 w-full min-w-[10rem] rounded border border-[var(--line)] px-1 text-xs"
              title="Perimetro"
            >
              <option value="">— Perimetro —</option>
              {perimetriAffido.length ? (
                <optgroup label="In affido">
                  {perimetriAffido.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {perimetriLavorazione.length ? (
                <optgroup label="In lavorazione">
                  {perimetriLavorazione.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          ) : (
            <span className="text-xs text-[var(--navy)]">
              {labelPerimetroVoce(voce, perimetriRiga!)}
            </span>
          )}
        </td>
      ) : null}
      <td className="px-2 py-1.5 align-top">
        {canEdit ? (
          <input
            value={voce.descrizione}
            onChange={(e) => onChange({ ...voce, descrizione: e.target.value })}
            placeholder="Descrizione…"
            className="min-w-[8rem] w-full rounded border border-[var(--line)] px-1.5 py-1 text-xs"
          />
        ) : (
          <span className="text-xs font-medium text-[var(--navy)]">{voce.descrizione || "—"}</span>
        )}
      </td>
      <td className="px-2 py-1.5 align-top">
        {canEdit ? (
          <select
            value={voce.codiceScarico}
            onChange={(e) =>
              onChange({
                ...voce,
                codiceScarico: e.target.value as VoceLavorazioneSuggerita["codiceScarico"],
              })
            }
            className="h-7 min-w-[4.5rem] rounded border border-[var(--line)] px-1 text-xs uppercase"
            disabled={mostraPerimetro && !perimetroSelezionato}
          >
            {codiciScaricoVoce.map((o) => (
              <option key={o.value || "none"} value={o.value}>
                {o.value || "—"}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-semibold uppercase text-[var(--navy)]">
            {voce.codiceScarico || "—"}
          </span>
        )}
      </td>
      <td className="min-w-[10rem] px-2 py-1.5 align-top">
        {canEdit ? (
          <button
            type="button"
            onClick={onOpenFiltri}
            title={haFiltri ? filtroLabel : "Configura filtro pratiche"}
            className={`flex w-full items-start gap-1 rounded border px-1.5 py-1 text-left text-xs hover:bg-slate-50 ${
              haFiltri
                ? "border-[var(--navy)]/30 bg-[#eef4f8] text-[var(--navy)]"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            <SlidersHorizontal className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{haFiltri ? filtroLabel : "Aggiungi filtro"}</span>
          </button>
        ) : (
          <span className="text-xs text-[var(--navy)]">{filtroLabel || "—"}</span>
        )}
      </td>
      <td className="min-w-[6rem] px-2 py-1.5 align-top">
        {canEdit ? (
          <input
            value={voce.note}
            onChange={(e) => onChange({ ...voce, note: e.target.value })}
            placeholder="Note…"
            className="w-full min-w-[5rem] rounded border border-[var(--line)] px-1.5 py-1 text-xs"
          />
        ) : (
          <span className="text-xs text-[var(--muted)]">{voce.note || ""}</span>
        )}
      </td>
      <td className="min-w-[6rem] px-2 py-1.5 align-top">
        {canEdit ? (
          <input
            value={voce.noteAggiuntive}
            onChange={(e) => onChange({ ...voce, noteAggiuntive: e.target.value })}
            placeholder="Note aggiuntive…"
            className="w-full min-w-[5rem] rounded border border-[var(--line)] px-1.5 py-1 text-xs"
          />
        ) : (
          <span className="text-xs text-[var(--muted)]">{voce.noteAggiuntive || ""}</span>
        )}
      </td>
      {colonneOperatori.map((op) => {
        const c = conteggioOp(op.id);
        return (
          <td key={op.id} className="px-2 py-1.5 text-center align-top text-xs">
            <ConteggioCell
              totale={c.totale}
              lavorate={c.lavorate}
              hrefTotale={c.hrefTotale}
              hrefLavorate={c.hrefLavorate}
              loading={loadingConteggi}
            />
          </td>
        );
      })}
      <td className="px-2 py-1.5 text-center align-top text-xs font-medium">
        <ConteggioCell
          totale={voce.totale}
          lavorate={voce.lavorate}
          hrefTotale={voce.hrefTotale}
          hrefLavorate={voce.hrefLavorate}
          loading={loadingConteggi}
        />
      </td>
      {canEdit ? (
        <td className="px-1 py-1.5 align-top">
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-0.5 text-[var(--muted)] hover:bg-red-50 hover:text-red-600"
            title="Rimuovi riga"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </td>
      ) : null}
    </tr>
  );
}

export function LavorazioneSuggeritaBar({
  voci: initialVoci,
  operatoriGruppo,
  mostraOperatori,
  operatoreCorrenteId,
  canEdit,
  canModifica,
  modificaHref,
  annullaModificaHref,
  eliminaRedirectGiorno,
  gruppoId,
  supervisorId,
  dataPiano,
  pianoSalvato,
  supervisorName,
  gruppoNome,
  mandanti,
  lotti,
  perimetriRiga,
}: {
  voci: VoceLavorazioneConConteggi[];
  operatoriGruppo: Array<{ id: string; name: string; role: string }>;
  mostraOperatori?: boolean;
  operatoreCorrenteId?: string;
  canEdit: boolean;
  canModifica?: boolean;
  modificaHref?: string;
  annullaModificaHref?: string;
  eliminaRedirectGiorno?: string;
  gruppoId?: string;
  supervisorId: string;
  dataPiano: string;
  pianoSalvato?: boolean;
  supervisorName?: string | null;
  gruppoNome?: string | null;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
  lotti?: string[];
  perimetriRiga?: PerimetroRigaLavorazione[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [voci, setVoci] = useState<VoceLavorazioneConConteggi[]>(initialVoci);
  const [dirty, setDirty] = useState(false);
  const [conteggiOverride, setConteggiOverride] = useState<VoceLavorazioneConConteggi[] | null>(
    null
  );
  const [loadingRows, setLoadingRows] = useState<Set<number>>(new Set());
  const [filtriModalIndex, setFiltriModalIndex] = useState<number | null>(null);
  const refreshTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setVoci(initialVoci);
    setDirty(false);
    setConteggiOverride(null);
    setLoadingRows(new Set());
    refreshTimers.current.forEach((t) => clearTimeout(t));
    refreshTimers.current.clear();
  }, [dataPiano, initialVoci]);

  const displayVoci = dirty ? voci : (conteggiOverride ?? initialVoci);

  const colonneOperatori = mostraOperatori
    ? operatoriGruppo
    : operatoreCorrenteId
      ? operatoriGruppo.filter((o) => o.id === operatoreCorrenteId)
      : operatoriGruppo;

  const fetchConteggiVoce = useCallback(
    async (voce: VoceLavorazioneSuggerita) => {
      const res = await fetch("/api/lavorazione-conteggi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voce, supervisorId, dataPiano }),
      });
      if (!res.ok) return null;
      return (await res.json()) as {
        totale: number;
        lavorate: number;
        hrefTotale: string;
        hrefLavorate: string;
        operatori: VoceLavorazioneConConteggi["operatori"];
      };
    },
    [supervisorId, dataPiano]
  );

  const refreshConteggi = useCallback(
    async (index: number, voce: VoceLavorazioneSuggerita) => {
      setLoadingRows((prev) => new Set(prev).add(index));
      try {
        const data = await fetchConteggiVoce(voce);
        if (!data) return;
        const merge = (base: VoceLavorazioneConConteggi[]) =>
          base.map((v, i) => (i === index ? { ...v, ...voce, ...data } : v));

        if (dirty) {
          setVoci((prev) => merge(prev.length ? prev : initialVoci));
        } else {
          setConteggiOverride((prev) => merge(prev ?? initialVoci));
        }
      } finally {
        setLoadingRows((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [dirty, fetchConteggiVoce, initialVoci]
  );

  const refreshAllConteggi = useCallback(async () => {
    const base = dirty ? voci : (conteggiOverride ?? initialVoci);
    if (!base.length) return;
    setLoadingRows(new Set(base.map((_, i) => i)));
    try {
      const updated = await Promise.all(
        base.map(async (voce) => {
          const data = await fetchConteggiVoce(voce);
          return data ? { ...voce, ...data } : voce;
        })
      );
      if (dirty) {
        setVoci(updated);
      } else {
        setConteggiOverride(updated);
      }
    } finally {
      setLoadingRows(new Set());
    }
  }, [conteggiOverride, dirty, fetchConteggiVoce, initialVoci, voci]);

  useLavorazioneRefreshRegister(`bar-${supervisorId}-${dataPiano}`, refreshAllConteggi);

  const scheduleRefresh = useCallback(
    (index: number, voce: VoceLavorazioneSuggerita) => {
      const existing = refreshTimers.current.get(index);
      if (existing) clearTimeout(existing);
      refreshTimers.current.set(
        index,
        setTimeout(() => {
          void refreshConteggi(index, voce);
        }, 280)
      );
    },
    [refreshConteggi]
  );

  function updateVoce(index: number, next: VoceLavorazioneSuggerita) {
    setDirty(true);
    setVoci((prev) => {
      const base = dirty ? prev : initialVoci;
      const merged = base.map((v, i) => (i === index ? { ...v, ...next } : v));
      const voce = merged[index];
      if (voce) scheduleRefresh(index, voce);
      return merged;
    });
  }

  function addVoce() {
    setDirty(true);
    setVoci((prev) => {
      const base = dirty ? prev : initialVoci;
      const v = emptyVoce("", dataPiano);
      return [
        ...base,
        { ...v, totale: 0, lavorate: 0, hrefTotale: "/pratiche", hrefLavorate: "/pratiche", operatori: [] },
      ];
    });
  }

  function removeVoce(index: number) {
    setDirty(true);
    setVoci((prev) => {
      const base = dirty ? prev : initialVoci;
      return base.filter((_, i) => i !== index);
    });
  }

  function salva() {
    const payload = (dirty ? voci : initialVoci).map(
      ({
        id,
        descrizione,
        codiceScarico,
        filtri,
        note,
        noteAggiuntive,
        lavorateDa,
        lavorateA,
        contestoPerimetro,
      }) => ({
        id,
        descrizione,
        codiceScarico,
        filtri,
        note,
        noteAggiuntive,
        lavorateDa,
        lavorateA,
        contestoPerimetro,
      })
    );
    startTransition(async () => {
      const fd = new FormData();
      fd.set("supervisorId", supervisorId);
      fd.set("dataPiano", dataPiano);
      fd.set("voci", JSON.stringify(payload));
      await saveLavorazioneSuggeritaAction(fd);
      setDirty(false);
      setConteggiOverride(null);
      const sp = new URLSearchParams();
      sp.set("giorno", dataPiano);
      if (gruppoId) sp.set("gruppo", gruppoId);
      router.push(`/lavorazione?${sp.toString()}`);
      router.refresh();
    });
  }

  function eliminaBozza() {
    if (!eliminaRedirectGiorno) return;
    const ok = window.confirm(
      `Eliminare il piano non pubblicato del ${dataLabel}?\nLe modifiche non salvate andranno perse.`
    );
    if (!ok) return;
    setDirty(false);
    setConteggiOverride(null);
    if (eliminaRedirectGiorno === dataPiano) {
      router.refresh();
      return;
    }
    const sp = new URLSearchParams();
    sp.set("giorno", eliminaRedirectGiorno);
    if (gruppoId) sp.set("gruppo", gruppoId);
    router.push(`/lavorazione?${sp.toString()}`);
  }

  const dataLabel = dataPiano
    ? new Date(`${dataPiano}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const totaliPerOperatore = colonneOperatori.map((op) => {
    let totale = 0;
    let lavorate = 0;
    for (const voce of displayVoci) {
      const c = voce.operatori.find((o) => o.id === op.id);
      if (c) {
        totale += c.totale;
        lavorate += c.lavorate;
      }
    }
    return { id: op.id, totale, lavorate };
  });

  const totalePratiche = displayVoci.reduce((s, v) => s + v.totale, 0);
  const lavoratePratiche = displayVoci.reduce((s, v) => s + v.lavorate, 0);
  const mostraColonnaPerimetro = Boolean(perimetriRiga?.length);
  const colspanBase = 5 + (mostraColonnaPerimetro ? 1 : 0);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-[var(--navy)]">
          {canEdit ? "Modifica piano di " : "Monitoraggio lavorazione di "}
          {dataLabel}
          {!pianoSalvato && canEdit ? (
            <span className="ml-2 text-xs font-normal text-amber-700">(non salvato)</span>
          ) : pianoSalvato && !canEdit ? (
            <span className="ml-2 text-xs font-normal text-emerald-700">(pubblicato)</span>
          ) : null}
        </h2>
        {supervisorName || gruppoNome ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {gruppoNome ? `${gruppoNome}` : null}
            {gruppoNome && supervisorName ? " · " : null}
            {supervisorName ? `Supervisor ${supervisorName}` : null}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--muted)]">
          {canEdit
            ? "Clicca «Aggiungi filtro» per definire quali pratiche includere. Il verde indica le lavorate dal salvataggio del piano."
            : "Il verde indica le pratiche lavorate dal salvataggio del piano. Clicca un numero per aprire l'elenco."}
        </p>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-2">
            {annullaModificaHref ? (
              <Link
                href={annullaModificaHref}
                className="rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-slate-50"
              >
                Annulla
              </Link>
            ) : null}
            <button
              type="button"
              onClick={addVoce}
              className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Aggiungi riga
            </button>
            <button
              type="button"
              onClick={salva}
              disabled={pending}
              className="flex items-center gap-1 rounded-lg bg-[var(--navy)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {pending ? "Salvataggio…" : "Salva"}
            </button>
            {!pianoSalvato && eliminaRedirectGiorno ? (
              <button
                type="button"
                onClick={eliminaBozza}
                className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Elimina
              </button>
            ) : null}
          </div>
        ) : canModifica && modificaHref ? (
          <Link
            href={modificaHref}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--navy)] hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Modifica piano
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white shadow-sm">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead className="bg-[#eef2f6] text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            <tr>
              {mostraColonnaPerimetro ? (
                <th className="min-w-[11rem] px-2 py-2">Perimetro</th>
              ) : null}
              <th className="min-w-[9rem] px-2 py-2">Descrizione</th>
              <th className="w-16 px-2 py-2">Cod. scar.</th>
              <th className="min-w-[10rem] px-2 py-2">Filtro pratiche</th>
              <th className="min-w-[6rem] px-2 py-2">Note</th>
              <th className="min-w-[6rem] px-2 py-2">Note aggiuntive</th>
              {colonneOperatori.map((op) => (
                <th key={op.id} className="min-w-[4.5rem] px-2 py-2 text-center">
                  {op.name.split(" ")[0]}
                </th>
              ))}
              <th className="min-w-[4.5rem] px-2 py-2 text-center">Tot. pratiche</th>
              {canEdit ? <th className="w-12 px-1 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {displayVoci.map((voce, i) => (
              <VoceRiga
                key={voce.id}
                voce={voce}
                canEdit={canEdit}
                operatoriGruppo={operatoriGruppo}
                mostraOperatori={mostraOperatori}
                operatoreCorrenteId={operatoreCorrenteId}
                onChange={(next) => updateVoce(i, next)}
                onRemove={() => removeVoce(i)}
                onOpenFiltri={canEdit ? () => setFiltriModalIndex(i) : undefined}
                loadingConteggi={loadingRows.has(i)}
                perimetriRiga={perimetriRiga}
              />
            ))}
            {!displayVoci.length ? (
              <tr>
                <td
                  colSpan={colspanBase + colonneOperatori.length + (canEdit ? 1 : 0)}
                  className="px-3 py-8 text-center text-sm text-[var(--muted)]"
                >
                  Nessuna lavorazione configurata.
                  {canEdit ? " Usa «Aggiungi riga»." : null}
                </td>
              </tr>
            ) : null}
          </tbody>
          {displayVoci.length > 0 ? (
            <tfoot className="border-t-2 border-[var(--line)] bg-[#eef2f6] text-xs font-semibold">
              <tr>
                <td
                  colSpan={colspanBase}
                  className="px-2 py-2 text-right uppercase tracking-wide text-[var(--muted)]"
                >
                  Totali
                </td>
                {totaliPerOperatore.map((t) => (
                  <td key={t.id} className="px-2 py-2 text-center tabular-nums text-[var(--navy)]">
                    <span>{t.totale}</span>
                    <span className="text-[var(--muted)]">/</span>
                    <span className="text-emerald-600">{t.lavorate}</span>
                  </td>
                ))}
                <td className="px-2 py-2 text-center tabular-nums text-[var(--navy)]">
                  <span>{totalePratiche}</span>
                  <span className="text-[var(--muted)]">/</span>
                  <span className="text-emerald-600">{lavoratePratiche}</span>
                </td>
                {canEdit ? <td className="px-1 py-2" /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {filtriModalIndex != null && displayVoci[filtriModalIndex] ? (
        <LavorazioneVoceFiltriModal
          open
          onClose={() => setFiltriModalIndex(null)}
          value={displayVoci[filtriModalIndex]!.filtri}
          onApply={(filtri) => updateVoce(filtriModalIndex, { ...displayVoci[filtriModalIndex]!, filtri })}
          operatori={operatoriGruppo}
          mandanti={mandanti}
          lotti={lotti}
        />
      ) : null}
    </div>
  );
}
