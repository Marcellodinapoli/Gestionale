"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { salvaConferimentoImportBatchAction } from "@/actions/conferimentoImport";
import { CONFERIMENTO_TIPI, type ConferimentoTipo } from "@/lib/conferimentoLegale";

function formatScadenzaIt(isoDate: string | null | undefined) {
  if (!isoDate?.trim()) return "non indicata";
  const [y, m, d] = isoDate.trim().slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export type ConferimentoPopupPayload = {
  batchId: string;
  lotto: string;
  scadenzaMandato: string | null;
};

export function ConferimentoImportPopup({
  open,
  payload,
  onClose,
}: {
  open: boolean;
  payload: ConferimentoPopupPayload | null;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState<ConferimentoTipo | "">("");
  const [vuoleData, setVuoleData] = useState(false);
  const [dataPassaggio, setDataPassaggio] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!payload) return null;

  const scad = payload.scadenzaMandato?.slice(0, 10) || "";

  async function onSalva() {
    if (!tipo) {
      setError("Seleziona il tipo di conferimento");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await salvaConferimentoImportBatchAction({
        batchId: payload!.batchId,
        conferimentoTipo: tipo,
        dataPassaggioGiudiziale:
          tipo === "ENTRAMBI" && vuoleData && dataPassaggio ? dataPassaggio : null,
        scadenzaMandato: scad || null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    } catch {
      setError("Salvataggio non riuscito. Riprova.");
    } finally {
      setPending(false);
    }
  }

  function onAnnulla() {
    if (pending) return;
    onClose();
  }

  return (
    <Modal open={open} title="Conferimento legale del lotto" onClose={onAnnulla}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-[var(--navy)]">
          Lotto <strong>{payload.lotto}</strong>
          <br />
          Scadenza mandato intercettata:{" "}
          <strong>{formatScadenzaIt(payload.scadenzaMandato)}</strong>
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-[var(--navy)]">
            Tipo di conferimento per questo lotto
          </legend>
          {CONFERIMENTO_TIPI.map((t) => (
            <label key={t.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="conferimento"
                value={t.value}
                checked={tipo === t.value}
                onChange={() => {
                  setTipo(t.value);
                  if (t.value !== "ENTRAMBI") {
                    setVuoleData(false);
                    setDataPassaggio("");
                  }
                }}
              />
              {t.label}
            </label>
          ))}
        </fieldset>

        {tipo === "ENTRAMBI" ? (
          <div className="space-y-2 rounded-lg border border-[var(--line)] bg-[#f8fafc] p-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={vuoleData}
                onChange={(e) => {
                  setVuoleData(e.target.checked);
                  if (!e.target.checked) setDataPassaggio("");
                  else if (!dataPassaggio && scad) setDataPassaggio(scad);
                }}
              />
              <span>
                Inserisci una data intermedia per il passaggio alla fase giudiziale
                <span className="block text-xs text-[var(--muted)]">
                  Opzionale. Può coincidere con la scadenza mandato. Se compilata, sulle
                  pratiche verrà indicata come prossima attività: passaggio a fase giudiziale.
                </span>
              </span>
            </label>
            {vuoleData ? (
              <label className="block text-sm">
                <span className="mb-0.5 block text-xs font-semibold text-[var(--danger)]">
                  Data passaggio a giudiziale
                </span>
                <input
                  type="date"
                  value={dataPassaggio}
                  max={scad || undefined}
                  onChange={(e) => setDataPassaggio(e.target.value)}
                  className="h-9 w-full rounded border border-[#7d94a8] bg-white px-2 text-sm"
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="rounded border border-[var(--danger)]/30 bg-[#fef2f2] px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={onAnnulla}
            disabled={pending}
            className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onSalva}
            disabled={pending || !tipo}
            className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Salvataggio…" : "Conferma"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
