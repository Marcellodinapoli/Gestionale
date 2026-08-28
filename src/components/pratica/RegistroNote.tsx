"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Pin, PinOff } from "lucide-react";
import {
  salvaNotaServizioPraticaAction,
  toggleFissaAttivitaAction,
  updateAttivitaAction,
} from "@/actions/core";
import { CODICI_SCARICO, CODICE_SCARICO_LABELS } from "@/lib/scarico";

export type AttivitaRow = {
  id: string;
  line: string;
  nota: string | null;
  fissata?: boolean;
  importante?: boolean;
  bloccata?: boolean;
};

function NotaRiga({
  row,
  canEdit,
  canSblocca,
  onError,
  evidenza,
}: {
  row: AttivitaRow;
  canEdit: boolean;
  canSblocca?: boolean;
  onError: (msg: string | null) => void;
  evidenza?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const lockedForUser = Boolean(row.bloccata) && !canSblocca;
  const showActions = canEdit && !lockedForUser;

  async function onSave(formData: FormData) {
    onError(null);
    setSaving(true);
    try {
      await updateAttivitaAction(formData);
      setEditing(false);
      router.refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Errore modifica");
    } finally {
      setSaving(false);
    }
  }

  async function onFissa() {
    onError(null);
    setPinning(true);
    try {
      const fd = new FormData();
      fd.set("attivitaId", row.id);
      await toggleFissaAttivitaAction(fd);
      router.refresh();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Errore fissaggio nota");
    } finally {
      setPinning(false);
    }
  }

  if (!editing) {
    const importante = Boolean(row.importante);
    const fissata = Boolean(row.fissata || evidenza);
    return (
      <div
        className={`group flex w-full items-center gap-2 border-b last:border-0 ${
          importante
            ? "min-h-8 border-b-amber-400/40 bg-[#ffd54f] px-3 py-1.5 text-[#5a3e00]"
            : fissata
              ? "min-h-8 border-b-amber-400/30 bg-[#ffe08a] px-3 py-1.5 text-[#5a3e00]"
              : "h-7 shrink-0 border-[#b8d9e2]/60 px-3"
        }`}
      >
        <p
          className={`min-w-0 flex-1 ${
            importante || fissata
              ? "whitespace-normal break-words font-semibold leading-snug"
              : "truncate"
          }`}
          title={row.line}
        >
          {importante ? (
            <span className="mr-1.5 inline-block rounded bg-[#5a3e00]/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide">
              Importante
            </span>
          ) : null}
          {row.line}
        </p>
        {showActions ? (
          <div className="flex shrink-0 items-center gap-0.5 font-sans text-[11px] text-[#1a4a55]">
            <button
              type="button"
              disabled={pinning}
              onClick={() => void onFissa()}
              className="rounded px-1.5 py-0.5 hover:bg-black/5 disabled:opacity-50"
              title={row.fissata ? "Togli nota fissa" : "Fissa in alto"}
            >
              {row.fissata ? (
                <PinOff className="inline h-3 w-3" />
              ) : (
                <Pin className="inline h-3 w-3" />
              )}{" "}
              {row.fissata ? "Togli" : "Fissa"}
            </button>
            <button
              type="button"
              onClick={() => {
                onError(null);
                setEditing(true);
              }}
              className="rounded px-1.5 py-0.5 opacity-100 hover:bg-black/5 sm:opacity-0 sm:transition sm:group-hover:opacity-100"
              title="Modifica nota"
            >
              <Pencil className="inline h-3 w-3" /> Modifica
            </button>
          </div>
        ) : lockedForUser ? (
          <span
            className="shrink-0 font-sans text-[10px] font-semibold text-slate-600"
            title="Nota non modificabile"
          >
            solo lettura
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={onSave}
      className="my-1 rounded border border-[#7eb8c4] bg-white p-2 font-sans text-sm shadow-sm"
    >
      <input type="hidden" name="attivitaId" value={row.id} />
      <label className="block text-xs">
        <span className="font-semibold text-[var(--muted)]">Testo nota</span>
        <textarea
          name="nota"
          rows={3}
          required
          defaultValue={row.nota || ""}
          className="mt-0.5 w-full resize-y rounded border border-[var(--line)] px-2 py-1.5 text-sm"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="h-8 rounded bg-[#132033] px-3 text-xs font-medium text-white disabled:opacity-60"
        >
          {saving ? "Salvataggio…" : "Salva modifiche"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="h-8 rounded border border-[var(--line)] px-3 text-xs"
        >
          Annulla
        </button>
      </div>
    </form>
  );
}

export function InserisciNotaServizio({
  praticaId,
  codiceScarico,
  promessaAt,
  promessaImporto,
  bozzaNota,
  bozzaKey,
  inModal,
  onDone,
}: {
  praticaId: string;
  codiceScarico?: string | null;
  promessaAt?: string | null;
  promessaImporto?: number | null;
  bozzaNota?: string | null;
  bozzaKey?: number;
  inModal?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [codice, setCodice] = useState(codiceScarico || "");
  const [promessa, setPromessa] = useState(promessaAt || "");
  const [importoPromessa, setImportoPromessa] = useState(
    promessaImporto != null && promessaImporto > 0 ? String(promessaImporto) : ""
  );
  const [saving, setSaving] = useState(false);
  const notaRef = useRef<HTMLTextAreaElement>(null);
  const bozzaApplicata = useRef<number | undefined>(undefined);

  useEffect(() => {
    setCodice(codiceScarico || "");
    setPromessa(promessaAt || "");
    setImportoPromessa(
      promessaImporto != null && promessaImporto > 0 ? String(promessaImporto) : ""
    );
  }, [codiceScarico, promessaAt, promessaImporto]);

  useEffect(() => {
    if (!bozzaNota || bozzaKey == null) return;
    if (bozzaApplicata.current === bozzaKey) return;
    bozzaApplicata.current = bozzaKey;
    const riga = bozzaNota.trim();
    setNota((prev) => {
      if (!prev.trim()) return `${riga} `;
      if (prev.includes(riga)) return prev;
      return `${prev.trimEnd()}\n${riga} `;
    });
    requestAnimationFrame(() => {
      const el = notaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }, [bozzaKey, bozzaNota]);

  async function onSalvaTutto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("nota", nota.trim());
      fd.set("codScarico", codice);
      if (codice === "PPC" && promessa) fd.set("promessaAt", promessa);
      if (codice === "PPC" && importoPromessa.trim()) {
        fd.set("promessaImporto", importoPromessa.trim());
      }
      await salvaNotaServizioPraticaAction(fd);

      setNota("");
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={inModal ? "p-3" : "shrink-0 border-t border-[#7eb8c4] bg-white p-3"}>
      <form onSubmit={onSalvaTutto}>
        <input type="hidden" name="praticaId" value={praticaId} />
        <label className="block text-xs">
          <span className="font-semibold text-[var(--muted)]">Inserisci nota</span>
          <textarea
            ref={notaRef}
            name="nota"
            rows={4}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Es.: da cell 333… segreteria telefonica — oppure testo SMS inviato"
            className="mt-0.5 w-full resize-y rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2 font-sans text-sm"
          />
        </label>

        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#1a4a55]">
            Codice scarico
          </p>
          <div className="flex flex-wrap items-end gap-1.5">
            <label className="w-full min-w-[160px] shrink-0 text-xs sm:w-[200px]">
              <span className="font-semibold text-[var(--muted)]">Codice scarico</span>
              <select
                name="codScarico"
                value={codice}
                onChange={(e) => setCodice(e.target.value)}
                className="mt-0.5 h-8 w-full rounded border border-[var(--line)] px-1.5 text-[13px]"
              >
                <option value="">—</option>
                {CODICI_SCARICO.map((c) => (
                  <option key={c} value={c}>
                    {c} — {CODICE_SCARICO_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            {codice === "PPC" ? (
              <>
                <label className="w-full min-w-[120px] shrink-0 text-xs sm:w-[138px]">
                  <span className="font-semibold text-[var(--muted)]">Data promessa</span>
                  <input
                    type="date"
                    name="promessaAt"
                    required
                    value={promessa}
                    onChange={(e) => setPromessa(e.target.value)}
                    className="mt-0.5 h-8 w-full rounded border border-[var(--line)] px-1 text-[13px]"
                  />
                </label>
                <label className="w-full min-w-[120px] shrink-0 text-xs sm:w-[138px]">
                  <span className="font-semibold text-[var(--muted)]">Importo da pagare</span>
                  <input
                    type="number"
                    name="promessaImporto"
                    min={0}
                    step="0.01"
                    value={importoPromessa}
                    onChange={(e) => setImportoPromessa(e.target.value)}
                    placeholder="0,00"
                    className="mt-0.5 h-8 w-full rounded border border-[var(--line)] px-1 text-[13px]"
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvataggio…" : "Salva"}
          </button>
          {inModal && onDone ? (
            <button
              type="button"
              disabled={saving}
              onClick={onDone}
              className="h-9 rounded border border-[var(--line)] bg-white px-4 text-sm hover:bg-[#eef4f8] disabled:opacity-60"
            >
              Annulla
            </button>
          ) : null}
        </div>
      </form>

      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export function RegistroNote({
  praticaId,
  attivita,
  canEdit,
  canSblocca = false,
}: {
  praticaId: string;
  attivita: AttivitaRow[];
  canEdit: boolean;
  canSblocca?: boolean;
}) {
  const fissate = attivita.filter((a) => a.fissata);
  const scorrevoli = attivita.filter((a) => !a.fissata);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-[#7eb8c4] bg-[#e8f4f8] shadow-inner">
      <div className="shrink-0 border-b border-[#7eb8c4] bg-[#d0e8ef] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#1a4a55]">
        Registro note e lavorazioni
      </div>

      {fissate.length ? (
        <div className="shrink-0 border-b-2 border-amber-500 bg-[#ffd54f] font-mono text-[13px] leading-7">
          {fissate.map((a) => (
            <NotaRiga
              key={a.id}
              row={a}
              canEdit={canEdit}
              canSblocca={canSblocca}
              onError={setError}
              evidenza
            />
          ))}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden font-mono text-[13px] leading-7 text-[#0d2a32]">
        {attivita.length === 0 ? (
          <p className="flex flex-1 items-start px-3 py-2 italic text-[var(--muted)]">
            Nessuna nota registrata.
          </p>
        ) : scorrevoli.length ? (
          scorrevoli.map((a) => (
            <NotaRiga
              key={a.id}
              row={a}
              canEdit={canEdit}
              canSblocca={canSblocca}
              onError={setError}
            />
          ))
        ) : (
          <p className="flex flex-1 items-start px-3 py-2 italic text-[var(--muted)]">
            Le altre note compariranno qui.
          </p>
        )}
      </div>

      {error ? <p className="border-t border-[#7eb8c4] px-3 py-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </section>
  );
}
