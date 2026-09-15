"use client";

import {
  dataNascitaDaCodiceFiscale,
  etaDaDataNascita,
  formatGiornoMese,
} from "@/lib/codiceFiscale";

const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";
const roCls = `${inputCls} bg-[#f4f6f8] text-[var(--muted)]`;

/** Campi nascita/età dal CF + qualifiche (diploma, laurea, master…). */
export function OperatoreAnagraficaExtraFields({
  codiceFiscale,
  residenzaDefault,
  qualificheDefault,
}: {
  codiceFiscale: string;
  residenzaDefault?: string;
  qualificheDefault?: string;
}) {
  const nascita = dataNascitaDaCodiceFiscale(codiceFiscale);
  const eta = etaDaDataNascita(nascita);
  const showNascita = Boolean(nascita);

  return (
    <>
      {showNascita ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-20">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Giorno
            </span>
            <input
              readOnly
              tabIndex={-1}
              value={formatGiornoMese(nascita!.giorno)}
              className={roCls}
            />
          </label>
          <label className="w-20">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Mese
            </span>
            <input
              readOnly
              tabIndex={-1}
              value={formatGiornoMese(nascita!.mese)}
              className={roCls}
            />
          </label>
          <label className="w-24">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Anno
            </span>
            <input
              readOnly
              tabIndex={-1}
              value={nascita!.anno}
              className={roCls}
            />
            <input type="hidden" name="annoNascita" value={String(nascita!.anno)} />
          </label>
          <label className="w-20">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Età
            </span>
            <input
              readOnly
              tabIndex={-1}
              value={eta ?? ""}
              className={roCls}
              title="Si aggiorna automaticamente in base alla data odierna"
            />
          </label>
        </div>
      ) : null}

      <label className="min-w-[220px] flex-[2] block">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
          Residenza
        </span>
        <input
          name="residenza"
          defaultValue={residenzaDefault || ""}
          className={inputCls}
          placeholder="Via, città, CAP"
        />
      </label>

      <label className="block w-full">
        <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
          Qualifiche scolastiche / titoli
        </span>
        <textarea
          name="qualificheScolastiche"
          rows={2}
          defaultValue={qualificheDefault || ""}
          className="mt-1 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="Es. Diploma, Laurea in…, Master in…"
        />
      </label>
    </>
  );
}
