"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import {
  addDebitoreRecapitoAction,
  addGaranteRecapitoAction,
  removeDebitoreRecapitoAction,
  removeGaranteRecapitoAction,
  updateDebitoreContattiPrincipaliAction,
  updateDebitoreRecapitoAction,
  updateGaranteContattiPrincipaliAction,
  updateGaranteRecapitoAction,
  updateStatoTelefonoAction,
} from "@/actions/core";
import { apriMail, apriSms } from "@/lib/clickToCall";
import {
  useChiamaNumero,
  usePrefissoChiamata,
} from "@/components/telefonia/TelephonyDialProvider";
import { formatNotaAzioneContatto } from "@/lib/noteFormat";
import { apriNotaBozza } from "@/lib/notaBozza";
import { avviaSessioneChiamata } from "@/lib/callSession";
import { SmsPresetsMenu } from "@/components/pratica/SmsPresetsMenu";
import type { SmsPreset } from "@/lib/smsPreimpostati";
import {
  STATI_TELEFONO_OPTIONS,
  statoTelefonoClassi,
  statoTelefonoLabel,
} from "@/lib/statoTelefono";

type Recapito = {
  id: string;
  tipo: string;
  valore: string;
  stato?: string | null;
};

const PRINCIPALE_TEL = "principale-tel";
const PRINCIPALE_MAIL = "principale-mail";

export function AnagraficaRecapiti({
  praticaId,
  garanteId,
  telefono,
  telefonoStato,
  email,
  recapiti,
  canEdit,
  layout = "debitore",
  codiceFiscale,
  operatoreName,
  prefissoChiamata,
  smsPresets = [],
  importoNetto = 0,
  importoConcordatoIniziale,
}: {
  praticaId: string;
  garanteId?: string;
  telefono: string | null;
  telefonoStato?: string | null;
  email: string | null;
  recapiti: Recapito[];
  canEdit: boolean;
  layout?: "debitore" | "inline";
  codiceFiscale?: string | null;
  operatoreName?: string | null;
  prefissoChiamata?: string | null;
  smsPresets?: SmsPreset[];
  importoNetto?: number;
  importoConcordatoIniziale?: number | null;
}) {
  const router = useRouter();
  const chiamaNumero = useChiamaNumero();
  const prefissoDaAccount = usePrefissoChiamata();
  const prefissoEffettivo = (prefissoChiamata || prefissoDaAccount || "").trim();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [telPrincipale, setTelPrincipale] = useState(telefono || "");
  const [emailPrincipale, setEmailPrincipale] = useState(email || "");
  const [popupTipo, setPopupTipo] = useState<"TELEFONO" | "EMAIL" | null>(null);
  const [nuovoValore, setNuovoValore] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [smsMenu, setSmsMenu] = useState<{
    numero: string;
    x: number;
    y: number;
  } | null>(null);
  const [legendaTargetId, setLegendaTargetId] = useState<string | null>(null);

  const telefoni = recapiti.filter((r) => r.tipo === "TELEFONO");
  const emails = recapiti.filter((r) => r.tipo === "EMAIL");

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      }
    });
  }

  function salvaPrincipali(tel: string, mail: string) {
    const fd = new FormData();
    fd.set("praticaId", praticaId);
    if (garanteId) fd.set("garanteId", garanteId);
    fd.set("telefono", tel);
    fd.set("email", mail);
    run(async () => {
      if (garanteId) {
        await updateGaranteContattiPrincipaliAction(fd);
      } else {
        await updateDebitoreContattiPrincipaliAction(fd);
      }
    });
  }

  function apriPopup(tipo: "TELEFONO" | "EMAIL") {
    setError(null);
    setNuovoValore("");
    setPopupTipo(tipo);
  }

  function chiudiPopup() {
    setPopupTipo(null);
    setNuovoValore("");
  }

  function salvaNuovoRecapito() {
    const valore = nuovoValore.trim();
    if (!valore || !popupTipo) return;
    const fd = new FormData();
    fd.set("praticaId", praticaId);
    if (garanteId) fd.set("garanteId", garanteId);
    fd.set("tipo", popupTipo);
    fd.set("valore", valore);
    run(async () => {
      if (garanteId) {
        await addGaranteRecapitoAction(fd);
      } else {
        await addDebitoreRecapitoAction(fd);
      }
      chiudiPopup();
    });
  }

  function rimuoviRecapito(recapitoId: string) {
    const fd = new FormData();
    fd.set("praticaId", praticaId);
    if (garanteId) fd.set("garanteId", garanteId);
    fd.set("recapitoId", recapitoId);
    run(async () => {
      if (garanteId) {
        await removeGaranteRecapitoAction(fd);
      } else {
        await removeDebitoreRecapitoAction(fd);
      }
    });
  }

  function aggiornaRecapito(recapitoId: string, valore: string) {
    const fd = new FormData();
    fd.set("praticaId", praticaId);
    if (garanteId) fd.set("garanteId", garanteId);
    fd.set("recapitoId", recapitoId);
    fd.set("valore", valore);
    run(async () => {
      if (garanteId) {
        await updateGaranteRecapitoAction(fd);
      } else {
        await updateDebitoreRecapitoAction(fd);
      }
    });
  }

  function salvaStatoTelefono(targetId: string, stato: string | null) {
    const fd = new FormData();
    fd.set("praticaId", praticaId);
    if (garanteId) fd.set("garanteId", garanteId);
    fd.set("target", targetId === PRINCIPALE_TEL ? "principale" : targetId);
    fd.set("stato", stato || "");
    run(async () => {
      await updateStatoTelefonoAction(fd);
    });
  }

  function registraAzione(
    azione: "chiamata" | "mail" | "sms",
    dest: string,
    testo?: string
  ) {
    if (!canEdit) return;
    apriNotaBozza(
      formatNotaAzioneContatto({
        userName: operatoreName || "OPR",
        azione,
        dest,
        testo,
        prefisso: azione === "chiamata" ? prefissoEffettivo || undefined : undefined,
      })
    );
  }

  function iniziaModifica(id: string, valore: string) {
    setEditingId(id);
    setDraft(valore);
  }

  function salvaRiga(id: string) {
    const valore = draft.trim();
    if (id === PRINCIPALE_TEL) {
      setTelPrincipale(valore);
      salvaPrincipali(valore, emailPrincipale);
    } else if (id === PRINCIPALE_MAIL) {
      setEmailPrincipale(valore);
      salvaPrincipali(telPrincipale, valore);
    } else if (valore) {
      aggiornaRecapito(id, valore);
    }
    setEditingId(null);
  }

  function eliminaRiga(id: string) {
    if (id === PRINCIPALE_TEL) {
      setTelPrincipale("");
      salvaPrincipali("", emailPrincipale);
      return;
    }
    if (id === PRINCIPALE_MAIL) {
      setEmailPrincipale("");
      salvaPrincipali(telPrincipale, "");
      return;
    }
    rimuoviRecapito(id);
  }

  const labelCls =
    "bg-[#eef2f6] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[#4a5568]";
  const iconBtn =
    "shrink-0 rounded p-0.5 text-[var(--muted)] hover:bg-[#eef4f8] hover:text-[var(--navy)] disabled:opacity-50";

  function riga({
    id,
    valore,
    tipo,
    highlight,
    stato,
  }: {
    id: string;
    valore: string;
    tipo: "TELEFONO" | "EMAIL";
    highlight?: boolean;
    stato?: string | null;
  }) {
    const isTel = tipo === "TELEFONO";
    const editing = editingId === id;
    const textCls = highlight ? " font-semibold text-[var(--danger)]" : "";
    const telBg =
      isTel && valore && !editing
        ? ` rounded px-1 ${statoTelefonoClassi(stato)}`
        : "";

    return (
      <div key={id} className="flex items-center gap-1">
        {canEdit && editing ? (
          <input
            autoFocus
            type={isTel ? "tel" : "email"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => salvaRiga(id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") setEditingId(null);
            }}
            className={`h-6 w-[9.5rem] shrink-0 rounded border border-[var(--line)] bg-white px-1.5 text-xs${textCls}`}
          />
        ) : valore ? (
          <span
            className={`w-[9.5rem] shrink-0 truncate text-xs leading-6${textCls}${telBg} cursor-pointer select-none`}
            title={
              isTel
                ? `${statoTelefonoLabel(stato) ? `${statoTelefonoLabel(stato)} · ` : ""}Doppio clic: chiama · Tasto destro: SMS`
                : "Clic per inviare e-mail con Outlook"
            }
            onDoubleClick={
              isTel && canEdit
                ? () => {
                    if (!chiamaNumero(valore)) return;
                    avviaSessioneChiamata(valore);
                    registraAzione("chiamata", valore);
                  }
                : undefined
            }
            onContextMenu={
              isTel
                ? (e) => {
                    e.preventDefault();
                    setSmsMenu({ numero: valore, x: e.clientX, y: e.clientY });
                  }
                : undefined
            }
            onClick={
              !isTel
                ? (e) => {
                    e.preventDefault();
                    apriMail(valore);
                    registraAzione("mail", valore);
                  }
                : undefined
            }
          >
            {valore}
          </span>
        ) : (
          <span className="w-[9.5rem] shrink-0 text-xs leading-6 text-[var(--muted)]">—</span>
        )}

        {canEdit ? (
          <span className="ml-auto flex shrink-0 items-center">
            {isTel && valore && !editing ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setLegendaTargetId(id)}
                className={`${iconBtn} mr-0.5 h-4 w-4 rounded-sm ${statoTelefonoClassi(stato)}`}
                title={
                  statoTelefonoLabel(stato)
                    ? `Stato: ${statoTelefonoLabel(stato)} · Legenda`
                    : "Stato numero · Legenda"
                }
              />
            ) : null}
            <button
              type="button"
              disabled={pending || (!valore && !editing)}
              onClick={() => (editing ? salvaRiga(id) : iniziaModifica(id, valore))}
              className={`${iconBtn} disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--muted)]`}
              title={valore || editing ? "Modifica" : "Nessun valore da modificare"}
            >
              <Pencil className="h-3 w-3" />
            </button>
            {valore ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => eliminaRiga(id)}
                className={`${iconBtn} hover:bg-[#fee2e2] hover:text-[var(--danger)]`}
                title="Elimina"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ) : isTel && stato ? (
          <span
            className={`ml-auto shrink-0 rounded px-1 py-px text-[8px] leading-tight ${statoTelefonoClassi(stato)}`}
          >
            {statoTelefonoLabel(stato)}
          </span>
        ) : null}
      </div>
    );
  }

  function blocco(
    label: string,
    principaleId: string,
    principale: string,
    principaleStato: string | null | undefined,
    extra: Recapito[],
    tipo: "TELEFONO" | "EMAIL",
    highlight?: boolean
  ) {
    return (
      <div className="min-w-0">
        <div className={labelCls}>{label}</div>
        <div className="space-y-0.5 border border-[var(--line)] bg-white p-1">
          {riga({
            id: principaleId,
            valore: principale,
            tipo,
            highlight,
            stato: tipo === "TELEFONO" ? principaleStato : undefined,
          })}
          {extra.map((rec) => (
            <div key={rec.id} className="border-t border-[var(--line)] pt-0.5">
              {riga({
                id: rec.id,
                valore: rec.valore,
                tipo,
                highlight,
                stato: tipo === "TELEFONO" ? rec.stato : undefined,
              })}
            </div>
          ))}
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => apriPopup(tipo)}
              className="mt-0.5 flex w-full items-center justify-center gap-1 border-t border-[var(--line)] pt-0.5 text-[10px] text-[var(--muted)] hover:text-[var(--navy)] disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Aggiungi
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const telefonoBlocco = blocco(
    "Telefono",
    PRINCIPALE_TEL,
    telPrincipale,
    telefonoStato,
    telefoni,
    "TELEFONO",
    true
  );

  const emailBlocco = blocco(
    "E-mail",
    PRINCIPALE_MAIL,
    emailPrincipale,
    null,
    emails,
    "EMAIL"
  );

  const popup = (
    <>
    <Modal
      open={popupTipo !== null}
      title={popupTipo === "EMAIL" ? "Nuova e-mail" : "Nuovo telefono"}
      onClose={chiudiPopup}
    >
      <form
        className="space-y-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          salvaNuovoRecapito();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            {popupTipo === "EMAIL" ? "Indirizzo e-mail" : "Numero di telefono"}
          </span>
          <input
            autoFocus
            type={popupTipo === "EMAIL" ? "email" : "tel"}
            value={nuovoValore}
            onChange={(e) => setNuovoValore(e.target.value)}
            placeholder={popupTipo === "EMAIL" ? "es. nome@email.it" : "es. 3331234567"}
            className="h-9 w-full rounded border border-[var(--line)] px-2 text-sm"
          />
        </label>
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={chiudiPopup}
            className="rounded border border-[var(--line)] px-3 py-1.5 text-xs hover:bg-[#eef4f8]"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={pending || !nuovoValore.trim()}
            className="rounded border border-[#2d6a4f] bg-gradient-to-b from-[#b7e4c7] to-[#74c69d] px-3 py-1.5 text-xs font-semibold text-[#1b4332] hover:from-[#d8f3dc] disabled:opacity-50"
          >
            Salva
          </button>
        </div>
      </form>
    </Modal>
    <Modal
      open={legendaTargetId !== null}
      title="Stato numero"
      onClose={() => setLegendaTargetId(null)}
    >
      <div className="space-y-2 p-4">
        <p className="text-xs text-[var(--muted)]">
          Seleziona lo stato per colorare il numero.
        </p>
        <div className="space-y-1">
          {STATI_TELEFONO_OPTIONS.map(([key, statoLabel]) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => {
                if (legendaTargetId) {
                  salvaStatoTelefono(legendaTargetId, key);
                  setLegendaTargetId(null);
                }
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${statoTelefonoClassi(key)} hover:opacity-90 disabled:opacity-50`}
            >
              {statoLabel}
            </button>
          ))}
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (legendaTargetId) {
                salvaStatoTelefono(legendaTargetId, null);
                setLegendaTargetId(null);
              }
            }}
            className="w-full rounded border border-[var(--line)] px-2 py-1.5 text-xs text-[var(--muted)] hover:bg-[#eef4f8] disabled:opacity-50"
          >
            Nessuno stato
          </button>
        ) : null}
      </div>
    </Modal>
    </>
  );

  const smsMenuNode = smsMenu ? (
    <SmsPresetsMenu
      numero={smsMenu.numero}
      x={smsMenu.x}
      y={smsMenu.y}
      presets={smsPresets}
      importoNetto={importoNetto}
      importoConcordatoIniziale={importoConcordatoIniziale}
      onClose={() => setSmsMenu(null)}
      onPick={(testo) => {
        apriSms(smsMenu.numero, testo);
        registraAzione("sms", smsMenu.numero, testo);
        setSmsMenu(null);
      }}
    />
  ) : null;

  if (layout === "inline") {
    return (
      <div className="min-w-0">
        <div className="grid grid-cols-2 gap-1 [&>*]:min-w-0">
          {telefonoBlocco}
          {emailBlocco}
        </div>
        {error && !popupTipo ? (
          <p className="mt-0.5 text-[10px] text-[var(--danger)]">{error}</p>
        ) : null}
        {popup}
        {smsMenuNode}
      </div>
    );
  }

  return (
    <div className="col-span-full space-y-1">
      <div>
        <div className={labelCls}>Cod. fiscale</div>
        <div className="min-h-[22px] truncate border border-[var(--line)] bg-white px-1.5 py-0.5 text-xs leading-snug">
          {codiceFiscale || "—"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 [&>*]:min-w-0">
        {telefonoBlocco}
        {emailBlocco}
      </div>
      {error && !popupTipo ? (
        <p className="text-[10px] text-[var(--danger)]">{error}</p>
      ) : null}
      {popup}
      {smsMenuNode}
    </div>
  );
}
