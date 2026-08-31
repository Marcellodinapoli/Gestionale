"use client";

import { useState, useTransition } from "react";
import { CONDIZIONI_ECONOMICHE, type CondizioneEconomica } from "@/lib/condizioneEconomica";
import { annoNascitaDaCodiceFiscale, normalizeCf } from "@/lib/codiceFiscale";
import { updateOperatoreAction } from "@/actions/operatoriAdmin";

type SedeOpt = { id: string; nome: string };
type SupervisorOpt = { id: string; name: string };

export type OperatoreModifica = {
  id: string;
  name: string;
  cognome: string | null;
  email: string;
  role: string;
  acronimo: string | null;
  formazioneOnly: boolean;
  sedeId: string | null;
  supervisorId: string | null;
  codiceFiscale: string | null;
  residenza: string | null;
  condizioneEconomica: CondizioneEconomica;
  importoFisso: number | null;
};

export function ModificaOperatoreForm({
  utente,
  sedi,
  supervisori,
  onSuccess,
  onCancel,
}: {
  utente: OperatoreModifica;
  sedi: SedeOpt[];
  supervisori: SupervisorOpt[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [codiceFiscale, setCodiceFiscale] = useState(utente.codiceFiscale || "");
  const [condizioneEconomica, setCondizioneEconomica] = useState<CondizioneEconomica>(
    utente.condizioneEconomica
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const mostraCondizione =
    utente.role === "OPERATOR" && !utente.formazioneOnly;
  const annoNascita = annoNascitaDaCodiceFiscale(codiceFiscale);
  const inputCls = "mt-1 h-9 w-full rounded-lg border border-[var(--line)] px-3 text-sm";

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("userId", utente.id);
    startTransition(async () => {
      try {
        await updateOperatoreAction(formData);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore durante il salvataggio");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[130px] flex-1">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Nome</span>
          <input name="name" required defaultValue={utente.name} className={inputCls} />
        </label>
        <label className="min-w-[130px] flex-1">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Cognome</span>
          <input
            name="cognome"
            required
            defaultValue={utente.cognome || ""}
            className={inputCls}
          />
        </label>
        <label className="min-w-[180px] flex-1">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Email</span>
          <input
            name="email"
            type="email"
            required
            defaultValue={utente.email}
            className={inputCls}
          />
        </label>
        <label className="w-28">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Acronimo</span>
          <input
            name="acronimo"
            maxLength={6}
            defaultValue={utente.acronimo || ""}
            className={`${inputCls} uppercase`}
          />
        </label>
        <label className="w-44">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Sede</span>
          <select name="sedeId" className={inputCls} required defaultValue={utente.sedeId || ""}>
            <option value="">—</option>
            {sedi.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        {utente.role === "OPERATOR" && !utente.formazioneOnly ? (
          <label className="w-44">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Supervisor
            </span>
            <select
              name="supervisorId"
              className={inputCls}
              defaultValue={utente.supervisorId || ""}
            >
              <option value="">—</option>
              {supervisori.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {mostraCondizione ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-3">
          <label className="w-52">
            <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
              Condizione economica
            </span>
            <select
              name="condizioneEconomica"
              className={inputCls}
              value={condizioneEconomica}
              onChange={(e) =>
                setCondizioneEconomica(e.target.value as CondizioneEconomica)
              }
            >
              {CONDIZIONI_ECONOMICHE.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {condizioneEconomica === "FISSO_PROVV" ? (
            <label className="w-40">
              <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                Importo fisso (€/mese)
              </span>
              <input
                name="importoFisso"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={utente.importoFisso ?? ""}
                className={inputCls}
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 border-t border-[var(--line)] pt-3">
        <label className="min-w-[180px] flex-1">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            Codice fiscale
          </span>
          <input
            name="codiceFiscale"
            value={codiceFiscale}
            onChange={(e) => setCodiceFiscale(normalizeCf(e.target.value))}
            maxLength={16}
            className={`${inputCls} font-mono uppercase`}
          />
        </label>
        <label className="w-28">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
            Anno nascita
          </span>
          <input
            readOnly
            value={annoNascita ?? ""}
            placeholder="—"
            className={`${inputCls} bg-[#f4f6f8] text-[var(--muted)]`}
            tabIndex={-1}
          />
          {annoNascita != null ? (
            <input type="hidden" name="annoNascita" value={String(annoNascita)} />
          ) : null}
        </label>
        <label className="min-w-[220px] flex-[2]">
          <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">Residenza</span>
          <input
            name="residenza"
            defaultValue={utente.residenza || ""}
            className={inputCls}
            placeholder="Via, città, CAP"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Salvataggio…" : "Salva modifiche"}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm font-medium text-[var(--navy)] hover:bg-slate-50 disabled:opacity-60"
          >
            Annulla
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {error}
        </p>
      ) : null}
    </form>
  );
}
