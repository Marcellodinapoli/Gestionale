"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Card, PageHeader } from "@/components/ui";
import { OperatoriGestione } from "@/components/operatori/OperatoriGestione";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { CONDIZIONI_ECONOMICHE } from "@/lib/condizioneEconomica";
import { NAV_VISIBILITY_ROLES } from "@/lib/navVisibility/catalog";
import type { NavRoleDefaults, NavUserOverrides } from "@/lib/navVisibility/catalog";
import {
  OPERATORI_FILTRI_EMPTY,
  contaFiltriAttivi,
  filtraOperatori,
  hasOperatoriFiltri,
  type OperatoreListaItem,
  type OperatoriFiltri,
} from "@/lib/operatoriFiltri";
import { FILTRI_FIELD_CLASS } from "@/components/filtri/filtriFieldStyles";

type SedeOpt = { id: string; nome: string };
type SupervisorOpt = { id: string; name: string };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Sezione({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function OperatoriWorkspace({
  utenti,
  sedi,
  supervisori,
  creatorRole,
  roleDefaults,
  userOverrides,
  acronimiUsati,
  headerActions,
}: {
  utenti: OperatoreListaItem[];
  sedi: SedeOpt[];
  supervisori: SupervisorOpt[];
  creatorRole: Role;
  roleDefaults: NavRoleDefaults;
  userOverrides: NavUserOverrides;
  acronimiUsati: string[];
  headerActions: ReactNode;
}) {
  const [filtri, setFiltri] = useState<OperatoriFiltri>(OPERATORI_FILTRI_EMPTY);
  const [draft, setDraft] = useState<OperatoriFiltri>(OPERATORI_FILTRI_EMPTY);
  const [open, setOpen] = useState(false);

  const filtrati = useMemo(() => filtraOperatori(utenti, filtri), [utenti, filtri]);
  const nAttivi = contaFiltriAttivi(filtri);
  const field = FILTRI_FIELD_CLASS;

  function setDraftField<K extends keyof OperatoriFiltri>(key: K, value: OperatoriFiltri[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function apri() {
    setDraft(filtri);
    setOpen(true);
  }

  function applica() {
    setFiltri(draft);
    setOpen(false);
  }

  function reset() {
    setDraft(OPERATORI_FILTRI_EMPTY);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Gestione operatori"
        subtitle="Anagrafica, condizione economica, accesso, sede e password"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={apri}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
                hasOperatoriFiltri(filtri)
                  ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--navy)] hover:bg-slate-50"
              }`}
            >
              <Search className="h-4 w-4" />
              Cerca
              {nAttivi > 0 ? (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-semibold">
                  {nAttivi}
                </span>
              ) : null}
            </button>
            {headerActions}
          </div>
        }
      />

      {hasOperatoriFiltri(filtri) ? (
        <p className="text-xs text-[var(--muted)]">
          Mostrati {filtrati.length} di {utenti.length} operatori
          {" · "}
          <button
            type="button"
            className="underline hover:text-[var(--navy)]"
            onClick={() => setFiltri(OPERATORI_FILTRI_EMPTY)}
          >
            Azzera filtri
          </button>
        </p>
      ) : null}

      <Card>
        <OperatoriGestione
          utenti={filtrati}
          sedi={sedi}
          supervisori={supervisori}
          creatorRole={creatorRole}
          roleDefaults={roleDefaults}
          userOverrides={userOverrides}
          acronimiUsati={acronimiUsati}
        />
      </Card>

      <Modal open={open} title="Cerca operatori" onClose={() => setOpen(false)} wide>
        <div className="space-y-5 p-4">
          <Sezione title="Anagrafica">
            <Field label="Nome">
              <input
                value={draft.nome}
                onChange={(e) => setDraftField("nome", e.target.value)}
                className={field}
                placeholder="Nome"
              />
            </Field>
            <Field label="Cognome">
              <input
                value={draft.cognome}
                onChange={(e) => setDraftField("cognome", e.target.value)}
                className={field}
                placeholder="Cognome"
              />
            </Field>
            <Field label="Email">
              <input
                value={draft.email}
                onChange={(e) => setDraftField("email", e.target.value)}
                className={field}
                placeholder="Email"
              />
            </Field>
            <Field label="Acronimo">
              <input
                value={draft.acronimo}
                onChange={(e) => setDraftField("acronimo", e.target.value.toUpperCase())}
                className={`${field} uppercase`}
                maxLength={6}
                placeholder="Es. PAO"
              />
            </Field>
            <Field label="Codice fiscale">
              <input
                value={draft.codiceFiscale}
                onChange={(e) =>
                  setDraftField("codiceFiscale", e.target.value.toUpperCase())
                }
                className={`${field} uppercase font-mono`}
                placeholder="CF"
              />
            </Field>
            <Field label="Residenza">
              <input
                value={draft.residenza}
                onChange={(e) => setDraftField("residenza", e.target.value)}
                className={field}
                placeholder="Via, città…"
              />
            </Field>
          </Sezione>

          <Sezione title="Nascita ed età">
            <Field label="Giorno">
              <input
                type="number"
                min={1}
                max={31}
                value={draft.giornoNascita}
                onChange={(e) => setDraftField("giornoNascita", e.target.value)}
                className={field}
                placeholder="gg"
              />
            </Field>
            <Field label="Mese">
              <input
                type="number"
                min={1}
                max={12}
                value={draft.meseNascita}
                onChange={(e) => setDraftField("meseNascita", e.target.value)}
                className={field}
                placeholder="mm"
              />
            </Field>
            <Field label="Anno">
              <input
                type="number"
                min={1900}
                max={2100}
                value={draft.annoNascita}
                onChange={(e) => setDraftField("annoNascita", e.target.value)}
                className={field}
                placeholder="aaaa"
              />
            </Field>
            <Field label="Età da">
              <input
                type="number"
                min={0}
                max={120}
                value={draft.etaDa}
                onChange={(e) => setDraftField("etaDa", e.target.value)}
                className={field}
                placeholder="min"
              />
            </Field>
            <Field label="Età a">
              <input
                type="number"
                min={0}
                max={120}
                value={draft.etaA}
                onChange={(e) => setDraftField("etaA", e.target.value)}
                className={field}
                placeholder="max"
              />
            </Field>
          </Sezione>

          <Sezione title="Qualifiche / titoli">
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Testo in qualifiche scolastiche / titoli">
                <input
                  value={draft.qualifiche}
                  onChange={(e) => setDraftField("qualifiche", e.target.value)}
                  className={field}
                  placeholder="Es. master, laurea, diploma…"
                />
              </Field>
            </div>
          </Sezione>

          <Sezione title="Ruolo e organizzazione">
            <Field label="Ruolo">
              <select
                value={draft.ruolo}
                onChange={(e) => setDraftField("ruolo", e.target.value)}
                className={field}
              >
                <option value="">Tutti</option>
                {NAV_VISIBILITY_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
                <option value="MANUTENZIONE">{ROLE_LABELS.MANUTENZIONE}</option>
              </select>
            </Field>
            <Field label="Accesso">
              <select
                value={draft.accesso}
                onChange={(e) =>
                  setDraftField("accesso", e.target.value as OperatoriFiltri["accesso"])
                }
                className={field}
              >
                <option value="">Tutti</option>
                <option value="completo">Completo</option>
                <option value="formazione">Solo formazione</option>
              </select>
            </Field>
            <Field label="Sede">
              <select
                value={draft.sedeId}
                onChange={(e) => setDraftField("sedeId", e.target.value)}
                className={field}
              >
                <option value="">Tutte</option>
                {sedi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supervisor">
              <select
                value={draft.supervisorId}
                onChange={(e) => setDraftField("supervisorId", e.target.value)}
                className={field}
              >
                <option value="">Tutti</option>
                {supervisori.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Condizione economica">
              <select
                value={draft.condizioneEconomica}
                onChange={(e) => setDraftField("condizioneEconomica", e.target.value)}
                className={field}
              >
                <option value="">Tutte</option>
                {CONDIZIONI_ECONOMICHE.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Consulente esterno">
              <select
                value={draft.consulenteEsterno}
                onChange={(e) =>
                  setDraftField(
                    "consulenteEsterno",
                    e.target.value as OperatoriFiltri["consulenteEsterno"]
                  )
                }
                className={field}
              >
                <option value="">Tutti</option>
                <option value="1">Sì</option>
                <option value="0">No</option>
              </select>
            </Field>
            <Field label="CreditCalc">
              <select
                value={draft.creditCalc}
                onChange={(e) =>
                  setDraftField("creditCalc", e.target.value as OperatoriFiltri["creditCalc"])
                }
                className={field}
              >
                <option value="">Tutti</option>
                <option value="1">Abilitato</option>
                <option value="0">Non abilitato</option>
              </select>
            </Field>
            <Field label="Postazione">
              <input
                value={draft.postazione}
                onChange={(e) => setDraftField("postazione", e.target.value)}
                className={field}
                placeholder="Nome postazione"
              />
            </Field>
            <Field label="Interno">
              <input
                value={draft.interno}
                onChange={(e) => setDraftField("interno", e.target.value)}
                className={field}
                placeholder="Interno"
              />
            </Field>
          </Sezione>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
            <button
              type="button"
              onClick={reset}
              className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
            >
              Azzera
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-9 rounded-lg border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8]"
            >
              Chiudi
            </button>
            <button
              type="button"
              onClick={applica}
              className="h-9 rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Applica filtri
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
