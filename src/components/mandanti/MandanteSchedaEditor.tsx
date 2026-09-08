"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import {
  updateMandanteAction,
  createMandanteAction,
  deleteMandanteAction,
} from "@/actions/core";
import {
  loadPerimetriForEditor,
  serializePerimetri,
  type MandantePerimetro,
} from "@/lib/mandantePerimetri";
import { PerimetriMandanteSection } from "@/components/mandanti/PerimetriMandanteSection";
import { Modal } from "@/components/Modal";

type DestinatarioStampa = "admin" | "operatore" | "consulente";

type MandanteData = {
  id: string;
  codice: string;
  ragioneSociale: string;
  email: string | null;
  telefono: string | null;
  referente: string | null;
  referenteTelefono: string | null;
  referenteEmail: string | null;
  pec: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  provvigionePerc: number | null;
  provvigioniMetodo: string | null;
  incentivoTipo: string | null;
  incentivoValore: number | null;
  incentivoSoglia: number | null;
  incentivoNote: string | null;
  codiciScarico: string | null;
  smsPreimpostati: string | null;
  perimetri: string | null;
  pratiche: number;
};

export function MandanteSchedaEditor({
  mandante,
  ruolo,
  isNew = false,
}: {
  mandante: MandanteData;
  ruolo: string;
  isNew?: boolean;
}) {
  const router = useRouter();
  const canManagePerimetri = ruolo === "ADMIN" || ruolo === "AMMINISTRAZIONE";
  const canDelete = ruolo === "ADMIN";
  const [codice, setCodice] = useState(mandante.codice);
  const [ragioneSociale, setRagioneSociale] = useState(mandante.ragioneSociale);
  const [email, setEmail] = useState(mandante.email || "");
  const [telefono, setTelefono] = useState(mandante.telefono || "");
  const [referente, setReferente] = useState(mandante.referente || "");
  const [referenteTelefono, setReferenteTelefono] = useState(mandante.referenteTelefono || "");
  const [referenteEmail, setReferenteEmail] = useState(mandante.referenteEmail || "");
  const [pec, setPec] = useState(mandante.pec || "");
  const [indirizzo, setIndirizzo] = useState(mandante.indirizzo || "");
  const [citta, setCitta] = useState(mandante.citta || "");
  const [cap, setCap] = useState(mandante.cap || "");
  const [provincia, setProvincia] = useState(mandante.provincia || "");
  const [perimetri, setPerimetri] = useState<MandantePerimetro[]>(() =>
    loadPerimetriForEditor(mandante)
  );
  const perimetriRef = useRef(perimetri);
  perimetriRef.current = perimetri;

  function handlePerimetriChange(next: MandantePerimetro[]) {
    perimetriRef.current = next;
    setPerimetri(next);
  }

  useEffect(() => {
    const loaded = loadPerimetriForEditor(mandante);
    setPerimetri(loaded);
    perimetriRef.current = loaded;
  }, [mandante.id, mandante.perimetri]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [savedRevision, setSavedRevision] = useState(0);
  const [stampaOpen, setStampaOpen] = useState(false);

  const canCreatePerimetro = Boolean(ragioneSociale.trim() && codice.trim());

  function vaiAllaStampa(destinatario: DestinatarioStampa) {
    setStampaOpen(false);
    router.push(`/mandanti/${mandante.id}/stampa?destinatario=${destinatario}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (canManagePerimetri) {
        for (const p of perimetriRef.current) {
          const a = p.nomeInterno.trim();
          const d = p.descrizione.trim();
          if (!a || !d) {
            setMsg("Ogni perimetro deve avere acronimo e descrizione");
            return;
          }
          if (a.toLowerCase() === d.toLowerCase()) {
            setMsg("Acronimo e descrizione devono essere diversi su ogni perimetro");
            return;
          }
        }
      }
      const fd = new FormData();
      if (isNew) {
        if (!canCreatePerimetro) {
          setMsg("Compila ragione sociale e acronimo interno");
          return;
        }
        fd.set("codice", codice);
        fd.set("ragioneSociale", ragioneSociale);
        fd.set("email", email);
        fd.set("telefono", telefono);
        fd.set("referente", referente);
        fd.set("referenteTelefono", referenteTelefono);
        fd.set("referenteEmail", referenteEmail);
        fd.set("pec", pec);
        if (canManagePerimetri) {
          fd.set("perimetri", serializePerimetri(perimetriRef.current));
        }
        await createMandanteAction(fd);
        return;
      }
      fd.set("id", mandante.id);
      fd.set("ragioneSociale", ragioneSociale);
      fd.set("email", email);
      fd.set("telefono", telefono);
      fd.set("referente", referente);
      fd.set("referenteTelefono", referenteTelefono);
      fd.set("referenteEmail", referenteEmail);
      fd.set("pec", pec);
      fd.set("indirizzo", indirizzo);
      fd.set("citta", citta);
      fd.set("cap", cap);
      fd.set("provincia", provincia);
      if (canManagePerimetri) {
        fd.set("perimetri", serializePerimetri(perimetriRef.current));
      }
      await updateMandanteAction(fd);
      setMsg("Salvato");
      setSavedRevision((n) => n + 1);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (mandante.pratiche > 0) {
      setMsg(
        `Impossibile eliminare: sono collegate ${mandante.pratiche} pratiche`
      );
      return;
    }
    const label = ragioneSociale.trim() || mandante.codice;
    if (
      !confirm(
        `Eliminare definitivamente la mandante "${label}"? L'operazione non è reversibile.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("id", mandante.id);
      await deleteMandanteAction(fd);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Errore");
      setDeleting(false);
      router.refresh();
    }
  }

  const sectionCls =
    "rounded-lg border border-[var(--line)] bg-[#f8fafc] overflow-hidden";
  const headerCls =
    "bg-[#c5d4e3] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#1a365d]";
  const inputCls =
    "h-9 w-full rounded border border-[var(--line)] px-2 text-sm";

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Link
          href="/mandanti"
          className="flex items-center gap-1 rounded border border-[var(--line)] px-2 py-1 text-xs hover:bg-[#eef4f8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Mandanti
        </Link>
        <h1 className="text-lg font-bold text-[var(--navy)]">
          {isNew ? "Nuova mandante" : `${mandante.codice} · ${mandante.ragioneSociale}`}
        </h1>
        {!isNew ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs text-[var(--muted)]">
              {mandante.pratiche} pratiche
            </span>
            <button
              type="button"
              onClick={() => setStampaOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--line)] bg-white px-3 text-xs font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
              title="Stampa i dati salvati della scheda"
            >
              <Printer className="h-3.5 w-3.5" />
              Stampa
            </button>
          </div>
        ) : null}
      </div>

      <Modal
        open={stampaOpen}
        title="Destinatario della stampa"
        onClose={() => setStampaOpen(false)}
      >
        <div className="space-y-3 px-4 py-4 text-sm">
          <p className="text-[var(--muted)]">
            Per chi è questa stampa? Le provvigioni mostrate dipendono dalla
            scelta (dati già salvati).
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => vaiAllaStampa("admin")}
              className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2.5 text-left hover:border-[var(--navy)] hover:bg-[#eef4f8]"
            >
              <span className="block font-semibold text-[var(--navy)]">
                Admin / amministrazione
              </span>
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                Tutte le provvigioni: percepite dalla mandante e da pagare a
                operatori e consulenti.
              </span>
            </button>
            <button
              type="button"
              onClick={() => vaiAllaStampa("operatore")}
              className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2.5 text-left hover:border-[var(--navy)] hover:bg-[#eef4f8]"
            >
              <span className="block font-semibold text-[var(--navy)]">
                Operatore
              </span>
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                Solo le provvigioni da pagare agli operatori (niente ricevute
                mandante né consulenti).
              </span>
            </button>
            <button
              type="button"
              onClick={() => vaiAllaStampa("consulente")}
              className="rounded-lg border border-[var(--line)] bg-[#f8fafc] px-3 py-2.5 text-left hover:border-[var(--navy)] hover:bg-[#eef4f8]"
            >
              <span className="block font-semibold text-[var(--navy)]">
                Consulente
              </span>
              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                Solo le provvigioni da pagare ai consulenti.
              </span>
            </button>
          </div>
        </div>
      </Modal>

      <form id="mandante-scheda-form" onSubmit={handleSubmit} className="space-y-4">
        <div className={sectionCls}>
          <div className={headerCls}>Anagrafica mandante</div>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Ragione sociale
              </span>
              <input
                value={ragioneSociale}
                onChange={(e) => setRagioneSociale(e.target.value)}
                required
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Acronimo interno
              </span>
              <input
                value={codice}
                onChange={(e) => setCodice(e.target.value.toUpperCase())}
                disabled={!isNew}
                required={isNew}
                className={`${inputCls} ${!isNew ? "bg-[#eef2f6] text-[var(--muted)]" : ""}`}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Telefono
              </span>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Referente
              </span>
              <input
                value={referente}
                onChange={(e) => setReferente(e.target.value)}
                placeholder="Nome e cognome"
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Telefono referente
              </span>
              <input
                value={referenteTelefono}
                onChange={(e) => setReferenteTelefono(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                Email referente
              </span>
              <input
                type="email"
                value={referenteEmail}
                onChange={(e) => setReferenteEmail(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                PEC aziendale
              </span>
              <input
                type="email"
                value={pec}
                onChange={(e) => setPec(e.target.value)}
                placeholder="nome@pec.it"
                className={inputCls}
              />
            </label>
            {!isNew ? (
              <>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Indirizzo
                  </span>
                  <input
                    value={indirizzo}
                    onChange={(e) => setIndirizzo(e.target.value)}
                    placeholder="Via/Piazza..."
                    className={inputCls}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                    Città
                  </span>
                  <input
                    value={citta}
                    onChange={(e) => setCitta(e.target.value)}
                    className={inputCls}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                      CAP
                    </span>
                    <input
                      value={cap}
                      onChange={(e) => setCap(e.target.value)}
                      maxLength={5}
                      className={inputCls}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Provincia
                    </span>
                    <input
                      value={provincia}
                      onChange={(e) => setProvincia(e.target.value)}
                      maxLength={2}
                      placeholder="RM"
                      className={`${inputCls} uppercase`}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {canManagePerimetri ? (
          <div className={sectionCls}>
            <div className={headerCls}>Perimetri / commesse</div>
            <PerimetriMandanteSection
              key={isNew ? "nuova" : `${mandante.id}-${savedRevision}`}
              initial={perimetri}
              onChange={handlePerimetriChange}
              canCreatePerimetro={canCreatePerimetro}
              savedRevision={savedRevision}
              mandanteFormId="mandante-scheda-form"
              isSaving={saving}
              isNew={isNew}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || deleting}
            className="h-10 rounded-lg bg-[var(--navy)] px-6 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Salvataggio..." : isNew ? "Crea mandante" : "Salva modifiche"}
          </button>
          <Link
            href="/mandanti"
            className="flex h-10 items-center rounded-lg border border-[var(--line)] bg-white px-6 text-sm font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
          >
            Annulla
          </Link>
          {!isNew && canDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              title={
                mandante.pratiche > 0
                  ? `Collegata a ${mandante.pratiche} pratiche`
                  : "Elimina definitivamente la mandante"
              }
              className={`ml-auto flex h-10 items-center gap-1.5 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50 ${
                mandante.pratiche > 0
                  ? "cursor-pointer border-red-100 bg-red-50/60 text-red-400"
                  : "cursor-pointer border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? "Eliminazione..." : "Elimina mandante"}
            </button>
          ) : null}
          {msg ? (
            <span
              className={`text-xs font-semibold ${
                msg === "Salvato" ? "text-emerald-600" : "text-[var(--danger)]"
              }`}
            >
              {msg}
            </span>
          ) : null}
        </div>
        {!isNew && canDelete && mandante.pratiche > 0 ? (
          <p className="text-xs text-[var(--muted)]">
            La mandante non può essere eliminata finché risultano collegate{" "}
            {mandante.pratiche} pratiche.
          </p>
        ) : null}
      </form>
    </div>
  );
}
