"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Pin, PinOff } from "lucide-react";
import {
  addAttivitaAction,
  toggleFissaAttivitaAction,
  updateAttivitaAction,
  updateContattoPraticaAction,
} from "@/actions/core";
import { CompletaRichiamoButton } from "@/components/pratica/CompletaRichiamoButton";
import {
  ESITO_CONTATTO_OPTIONS,
  TIPO_CONTATTO_OPTIONS,
} from "@/lib/contatto";

export type AttivitaRow = {
  id: string;
  line: string;
  nota: string | null;
  fissata?: boolean;
  importante?: boolean;
  bloccata?: boolean;
};

const WEEKDAYS = ["lu", "ma", "me", "gi", "ve", "sa", "do"];
const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocal(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(value?: string | null) {
  const d = parseLocal(value);
  if (!d) return "";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function CalendarioMemoField({
  name,
  value,
  onChange,
  onSaveAndClose,
  saving,
}: {
  name: string;
  value: string;
  onChange: (next: string) => void;
  onSaveAndClose: (next: string) => void | Promise<void>;
  saving: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const current = parseLocal(value) || new Date();
  const [viewYear, setViewYear] = useState(current.getFullYear());
  const [viewMonth, setViewMonth] = useState(current.getMonth());
  const [day, setDay] = useState(current.getDate());
  const [hour, setHour] = useState(current.getHours());
  const [minute, setMinute] = useState(current.getMinutes());

  useEffect(() => {
    const d = parseLocal(value) || new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setDay(d.getDate());
    setHour(d.getHours());
    setMinute(d.getMinutes());
  }, [value, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = new Date(viewYear, viewMonth, day, hour, minute);
  const selectedValue = toLocalValue(selected);
  const days = monthGrid(viewYear, viewMonth);
  const today = new Date();

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function applyToday() {
    const n = new Date();
    setViewYear(n.getFullYear());
    setViewMonth(n.getMonth());
    setDay(n.getDate());
    setHour(n.getHours());
    setMinute(n.getMinutes());
  }

  async function saveAndClose() {
    onChange(selectedValue);
    await onSaveAndClose(selectedValue);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative text-xs">
      <span className="font-semibold text-[var(--muted)]">Sc. memo (richiamo)</span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-0.5 flex h-8 w-full items-center truncate rounded border border-[var(--line)] bg-white px-1 text-left text-[13px]"
      >
        {formatDisplay(value) || <span className="text-[var(--muted)]">gg/mm/aaaa, --:--</span>}
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-[min(340px,calc(100vw-1rem))] rounded-md border border-[#cfcfcf] bg-white p-2 shadow-xl">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between px-1">
                <span className="text-sm capitalize">{MONTHS[viewMonth]} {viewYear}</span>
                <div className="flex flex-col">
                  <button type="button" onClick={() => shiftMonth(1)} className="h-4 px-1 text-[10px] leading-none">▲</button>
                  <button type="button" onClick={() => shiftMonth(-1)} className="h-4 px-1 text-[10px] leading-none">▼</button>
                </div>
              </div>
              <div className="grid grid-cols-7 text-center text-[11px] text-[var(--muted)]">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
                {days.map((d) => {
                  const inMonth = d.getMonth() === viewMonth;
                  const isSel =
                    d.getFullYear() === viewYear &&
                    d.getMonth() === viewMonth &&
                    d.getDate() === day;
                  const isToday =
                    d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
                  return (
                    <button
                      key={`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`}
                      type="button"
                      onClick={() => {
                        setViewYear(d.getFullYear());
                        setViewMonth(d.getMonth());
                        setDay(d.getDate());
                      }}
                      className={`h-8 w-8 justify-self-center rounded-sm text-xs ${
                        isSel ? "border border-[#132033] font-semibold" : ""
                      } ${inMonth ? "text-[#132033]" : "text-[#bbb]"} ${isToday && !isSel ? "font-semibold" : ""}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex h-[220px] gap-1 border-l border-[#eee] pl-1">
              <div className="h-full w-10 overflow-y-auto">
                {Array.from({ length: 24 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHour(i)}
                    className={`block w-full py-1 text-xs ${hour === i ? "bg-[#e8e8e8] font-semibold" : ""}`}
                  >
                    {pad(i)}
                  </button>
                ))}
              </div>
              <div className="h-full w-10 overflow-y-auto">
                {Array.from({ length: 60 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setMinute(i)}
                    className={`block w-full py-1 text-xs ${minute === i ? "bg-[#e8e8e8] font-semibold" : ""}`}
                  >
                    {pad(i)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[#eee] pt-2">
            <button
              type="button"
              onClick={async () => {
                onChange("");
                await onSaveAndClose("");
                setOpen(false);
              }}
              className="text-xs text-[#1a73e8]"
            >
              Cancella
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveAndClose}
              className="h-7 rounded bg-[#132033] px-3 text-xs font-medium text-white disabled:opacity-60"
            >
              {saving ? "…" : "Salva e chiudi"}
            </button>
            <button type="button" onClick={applyToday} className="text-xs text-[#1a73e8]">
              Oggi
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  esitoContatto,
  tipoContatto,
  memoAt,
  promessaAt,
  promessaImporto,
  bozzaNota,
  bozzaKey,
  inModal,
  onDone,
}: {
  praticaId: string;
  esitoContatto?: string | null;
  tipoContatto?: string | null;
  memoAt?: string | null;
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
  const [esito, setEsito] = useState(esitoContatto || "");
  const [tipo, setTipo] = useState(tipoContatto || "");
  const [memo, setMemo] = useState(memoAt || "");
  const [promessa, setPromessa] = useState(promessaAt || "");
  const [importoPromessa, setImportoPromessa] = useState(
    promessaImporto != null && promessaImporto > 0 ? String(promessaImporto) : ""
  );
  const [saving, setSaving] = useState(false);
  const notaRef = useRef<HTMLTextAreaElement>(null);
  const bozzaApplicata = useRef<number | undefined>(undefined);

  useEffect(() => {
    setEsito(esitoContatto || "");
    setTipo(tipoContatto || "");
    setMemo(memoAt || "");
    setPromessa(promessaAt || "");
    setImportoPromessa(
      promessaImporto != null && promessaImporto > 0 ? String(promessaImporto) : ""
    );
  }, [esitoContatto, tipoContatto, memoAt, promessaAt, promessaImporto]);

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
      const notaTrim = nota.trim();
      if (notaTrim) {
        const fdNota = new FormData();
        fdNota.set("praticaId", praticaId);
        fdNota.set("nota", notaTrim);
        await addAttivitaAction(fdNota);
      }

      const fdContatto = new FormData();
      fdContatto.set("praticaId", praticaId);
      fdContatto.set("esito", esito);
      fdContatto.set("tipo", tipo);
      fdContatto.set("scheduledAt", memo);
      if (esito === "PROMESSA" && promessa) fdContatto.set("promessaAt", promessa);
      if (esito === "PROMESSA" && importoPromessa.trim()) {
        fdContatto.set("promessaImporto", importoPromessa.trim());
      }
      await updateContattoPraticaAction(fdContatto);

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
            Esito contatto della posizione
          </p>
          <div className="flex flex-wrap items-end gap-1.5">
            <label className="w-full min-w-[120px] shrink-0 text-xs sm:w-[138px]">
              <span className="font-semibold text-[var(--muted)]">Esito contatto</span>
              <select
                name="esito"
                value={esito}
                onChange={(e) => setEsito(e.target.value)}
                className="mt-0.5 h-8 w-full rounded border border-[var(--line)] px-1.5 text-[13px]"
              >
                <option value="">—</option>
                {ESITO_CONTATTO_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {esito === "PROMESSA" ? (
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
            <div className="w-full min-w-[120px] shrink-0 sm:w-[138px]">
              <CalendarioMemoField
                name="scheduledAt"
                value={memo}
                onChange={setMemo}
                onSaveAndClose={async (next) => setMemo(next)}
                saving={false}
              />
            </div>
            <label className="w-full min-w-[120px] shrink-0 text-xs sm:w-[138px]">
              <span className="block truncate font-semibold text-[var(--muted)]">
                Tipo contatto
              </span>
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="mt-0.5 h-8 w-full rounded border border-[var(--line)] px-1.5 text-[13px]"
              >
                <option value="">—</option>
                {TIPO_CONTATTO_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
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
          {memo ? (
            <CompletaRichiamoButton
              praticaId={praticaId}
              label="Azzera richiamo"
              onCleared={() => setMemo("")}
            />
          ) : null}
          <span className="text-xs text-[var(--muted)]">
            Salva nota ed esito contatto insieme. Dopo il richiamo usa «Azzera richiamo».
          </span>
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
