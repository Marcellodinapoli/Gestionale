"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { euro } from "@/lib/domainFormat";
import { buildAffidiHref, type AffidiNavParams } from "@/components/affidi/AffidiCaricoOperatori";
import { Modal } from "@/components/Modal";
import { loadIncassiGuadagnoAnnoOperatoreAction } from "@/actions/affidiCarico";
import type { RigaMeseIncassoGuadagno } from "@/lib/affidi/incassiGuadagnoAnnoOperatore";
import type { RigaIncassoOperatore } from "@/lib/affidi/righeIncassoOperatore";

function valoreCell(n: number) {
  return (
    <span className={n > 0 ? "font-semibold text-[var(--navy)]" : "text-[var(--muted)]"}>
      {euro(n)}
    </span>
  );
}

function AnnoOperatoreModal({
  open,
  operatore,
  anno,
  caricoMandato,
  caricoPerimetro,
  filtroLabel,
  onClose,
}: {
  open: boolean;
  operatore: RigaIncassoOperatore | null;
  anno: number;
  caricoMandato?: string;
  caricoPerimetro?: string;
  filtroLabel?: string;
  onClose: () => void;
}) {
  const [righe, setRighe] = useState<RigaMeseIncassoGuadagno[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const carica = useCallback(() => {
    if (!operatore) return;
    setErrore(null);
    setRighe(null);
    startTransition(async () => {
      try {
        const data = await loadIncassiGuadagnoAnnoOperatoreAction({
          operatoreId: operatore.id,
          anno,
          caricoMandato,
          caricoPerimetro,
        });
        setRighe(data);
      } catch (e) {
        setErrore(e instanceof Error ? e.message : "Errore nel caricamento");
      }
    });
  }, [operatore, anno, caricoMandato, caricoPerimetro]);

  useEffect(() => {
    if (open && operatore) carica();
    if (!open) {
      setRighe(null);
      setErrore(null);
    }
  }, [open, operatore, carica]);

  const totIncassato = righe?.reduce((s, r) => s + r.incassato, 0) ?? 0;
  const totGuadagno = righe?.reduce((s, r) => s + r.guadagno, 0) ?? 0;

  return (
    <Modal
      open={open}
      title={operatore ? `${operatore.name} · ${anno}` : "Dettaglio anno"}
      onClose={onClose}
      wide
    >
      <div className="p-4">
        {filtroLabel ? (
          <p className="mb-3 text-xs text-[var(--muted)]">{filtroLabel}</p>
        ) : null}

        {pending ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Caricamento…</p>
        ) : null}

        {errore ? (
          <div className="py-4 text-center">
            <p className="mb-3 text-sm text-red-700">{errore}</p>
            <button
              type="button"
              onClick={carica}
              className="text-sm text-[var(--accent)] underline"
            >
              Riprova
            </button>
          </div>
        ) : null}

        {righe && !pending ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="py-2">Mese</th>
                  <th className="text-right">Incassato</th>
                  <th className="text-right">Guadagno</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.meseKey} className="border-t border-[var(--line)]">
                    <td className="py-2 capitalize">{r.label}</td>
                    <td className="text-right tabular-nums">{valoreCell(r.incassato)}</td>
                    <td className="text-right tabular-nums">{valoreCell(r.guadagno)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#132033] font-semibold">
                  <td className="py-2">Totale {anno}</td>
                  <td className="text-right tabular-nums">{euro(totIncassato)}</td>
                  <td className="text-right tabular-nums">{euro(totGuadagno)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function AffidiIncassiOperatori({
  righe,
  selezionatoId,
  nav,
  meseLabel,
  totaleGruppo,
  totaleGuadagno,
  annoCarico,
  caricoMandato,
  caricoPerimetro,
  filtroCaricoLabel,
}: {
  righe: RigaIncassoOperatore[];
  selezionatoId?: string;
  nav?: Pick<
    AffidiNavParams,
    "mandato" | "perimetro" | "caricoMandato" | "caricoPerimetro" | "caricoMese" | "operatore" | "coda"
  >;
  meseLabel?: string;
  totaleGruppo: number;
  totaleGuadagno: number;
  annoCarico: number;
  caricoMandato?: string;
  caricoPerimetro?: string;
  filtroCaricoLabel?: string;
}) {
  const [modalOp, setModalOp] = useState<RigaIncassoOperatore | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr>
              <th className="py-2">Operatore</th>
              <th className="text-right">
                <span className="block">Incassato</span>
                <span className="text-[9px] font-normal normal-case">{meseLabel ?? "mese"}</span>
              </th>
              <th className="text-right">
                <span className="block">Guadagno</span>
                <span className="text-[9px] font-normal normal-case">{meseLabel ?? "mese"}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {righe.map((o) => {
              const onOp = selezionatoId === o.id;
              if (selezionatoId && !onOp) return null;
              return (
                <tr
                  key={o.id}
                  className={`border-t border-[var(--line)] ${onOp ? "bg-[#eef4f8]" : ""}`}
                >
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => setModalOp(o)}
                      className={`cursor-pointer text-left font-medium underline ${
                        onOp ? "text-[var(--navy)]" : "text-[var(--accent)]"
                      }`}
                    >
                      {o.name}
                    </button>
                    {o.role === "SUPERVISOR" ? (
                      <span className="ml-1 text-[10px] text-[var(--muted)]">supervisor</span>
                    ) : null}
                  </td>
                  <td className="text-right tabular-nums">{valoreCell(o.incassatoMese)}</td>
                  <td className="text-right tabular-nums">{valoreCell(o.guadagnoMese)}</td>
                </tr>
              );
            })}
            {!selezionatoId ? (
              <tr className="border-t-2 border-[#132033] font-semibold">
                <td className="py-2">
                  <Link href={buildAffidiHref(nav)} className="hover:underline">
                    Totale gruppo
                  </Link>
                </td>
                <td className="text-right tabular-nums">{euro(totaleGruppo)}</td>
                <td className="text-right tabular-nums">{euro(totaleGuadagno)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AnnoOperatoreModal
        open={modalOp != null}
        operatore={modalOp}
        anno={annoCarico}
        caricoMandato={caricoMandato}
        caricoPerimetro={caricoPerimetro}
        filtroLabel={
          filtroCaricoLabel ? `${filtroCaricoLabel} · Anno ${annoCarico}` : `Anno ${annoCarico}`
        }
        onClose={() => setModalOp(null)}
      />
    </>
  );
}
