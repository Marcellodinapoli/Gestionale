"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { euro } from "@/lib/domainFormat";
import {
  compilaSmsConImporto,
  importoSmsEffettivo,
  smsRichiedeImporto,
  type SmsPreset,
} from "@/lib/smsPreimpostati";

export function SmsPresetsMenu({
  numero,
  x,
  y,
  presets,
  importoNetto,
  importoConcordatoIniziale,
  onPick,
  onClose,
}: {
  numero: string;
  x: number;
  y: number;
  presets: SmsPreset[];
  importoNetto: number;
  importoConcordatoIniziale?: number | null;
  onPick: (testo: string, titolo: string) => void;
  onClose: () => void;
}) {
  const [compose, setCompose] = useState<SmsPreset | null>(null);
  const [importoConcordato, setImportoConcordato] = useState("");

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target;
      if (t instanceof Node && document.getElementById("sms-presets-menu")?.contains(t)) {
        return;
      }
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (compose) setCompose(null);
        else onClose();
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, compose]);

  useEffect(() => {
    if (!compose) return;
    const init =
      importoConcordatoIniziale != null && importoConcordatoIniziale > 0
        ? String(importoConcordatoIniziale)
        : "";
    setImportoConcordato(init);
  }, [compose, importoConcordatoIniziale, importoNetto]);

  const { importo: importoEffettivo, errore } = useMemo(
    () => importoSmsEffettivo(importoNetto, importoConcordato),
    [importoNetto, importoConcordato]
  );

  const anteprima = compose ? compilaSmsConImporto(compose.testo, importoEffettivo) : "";

  const wide = Boolean(compose);
  const left = Math.min(
    x,
    typeof window !== "undefined" ? window.innerWidth - (wide ? 320 : 280) : x
  );
  const top = Math.min(
    y,
    typeof window !== "undefined" ? window.innerHeight - (wide ? 360 : 280) : y
  );

  function invia(testo: string, titolo: string) {
    onPick(testo, titolo);
    onClose();
  }

  function onSelectPreset(preset: SmsPreset) {
    if (smsRichiedeImporto(preset.testo)) {
      setCompose(preset);
      return;
    }
    invia(preset.testo, preset.titolo);
  }

  return createPortal(
    <div
      id="sms-presets-menu"
      className={`fixed z-[90] overflow-hidden rounded border border-[var(--line)] bg-white shadow-xl ${wide ? "w-80" : "w-64"}`}
      style={{ left, top }}
      role="menu"
    >
      <p className="border-b border-[var(--line)] bg-[#dce4ec] px-2 py-1 text-[10px] font-bold uppercase text-[#1a365d]">
        SMS a {numero}
      </p>

      {compose ? (
        <div className="space-y-2 p-2">
          <p className="text-xs font-semibold text-[var(--navy)]">{compose.titolo}</p>
          <label className="block text-[10px]">
            <span className="font-semibold text-[var(--muted)]">Netto da pagare</span>
            <div className="mt-0.5 h-7 rounded border border-[var(--line)] bg-[#f4f7fa] px-2 text-xs leading-7">
              {euro(importoNetto)}
            </div>
          </label>
          <label className="block text-[10px]">
            <span className="font-semibold text-[var(--muted)]">Importo concordato</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={importoConcordato}
              onChange={(e) => setImportoConcordato(e.target.value)}
              placeholder={euro(importoNetto)}
              className="mt-0.5 h-7 w-full rounded border border-[var(--line)] px-2 text-xs"
            />
            <span className="mt-0.5 block text-[9px] text-[var(--muted)]">
              Se compilato, verrà usato nel messaggio al posto del netto da pagare.
            </span>
          </label>
          <div className="rounded border border-[var(--line)] bg-[#fafbfc] p-2 text-[10px] leading-snug text-[#132033]">
            {anteprima}
          </div>
          {errore ? <p className="text-[10px] text-[var(--danger)]">{errore}</p> : null}
          <div className="flex gap-1">
            <button
              type="button"
              className="h-7 flex-1 rounded border border-[var(--line)] text-[10px] text-[var(--muted)] hover:bg-[#eef4f8]"
              onClick={() => setCompose(null)}
            >
              Indietro
            </button>
            <button
              type="button"
              disabled={Boolean(errore)}
              className="h-7 flex-1 rounded bg-[#132033] text-[10px] font-medium text-white disabled:opacity-50"
              onClick={() => invia(anteprima, compose.titolo)}
            >
              Invia SMS
            </button>
          </div>
        </div>
      ) : (
        <ul className="max-h-64 overflow-auto py-0.5">
          {presets.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                role="menuitem"
                className="flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-[#eef4f8]"
                onClick={() => onSelectPreset(m)}
              >
                <span className="text-xs font-semibold text-[var(--navy)]">{m.titolo}</span>
                <span className="line-clamp-2 text-[10px] leading-snug text-[var(--muted)]">
                  {m.testo}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body
  );
}
