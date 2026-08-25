"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { salvaMemoAgendaAction } from "@/actions/core";
import { AgendaGiornoImpegniPanel } from "@/components/agenda/AgendaGiornoImpegniPanel";
import { CompletaRichiamoButton } from "@/components/pratica/CompletaRichiamoButton";

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

export function AgendaMemoPopup({
  praticaId,
  memoAt,
  onDone,
}: {
  praticaId: string;
  memoAt?: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const initial = parseLocal(memoAt) || new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [day, setDay] = useState(initial.getDate());
  const [hour, setHour] = useState(initial.getHours());
  const [minute, setMinute] = useState(initial.getMinutes());
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = parseLocal(memoAt) || new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setDay(d.getDate());
    setHour(d.getHours());
    setMinute(d.getMinutes());
  }, [memoAt]);

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("praticaId", praticaId);
      fd.set("scheduledAt", selectedValue);
      fd.set("nota", nota);
      await salvaMemoAgendaAction(fd);
      setNota("");
      router.refresh();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="px-3 py-3">
      <p className="mb-2 text-[11px] font-bold uppercase text-[#1a365d]">
        Appuntamento in agenda
      </p>
      <p className="mb-2 text-sm text-[var(--navy)]">
        {selected.toLocaleString("it-IT", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(10rem,0.9fr)]">
        <div className="flex gap-2 rounded-md border border-[var(--line)] bg-white p-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-sm capitalize">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <div className="flex flex-col">
                <button type="button" onClick={() => shiftMonth(1)} className="h-4 px-1 text-[10px] leading-none">
                  ▲
                </button>
                <button type="button" onClick={() => shiftMonth(-1)} className="h-4 px-1 text-[10px] leading-none">
                  ▼
                </button>
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
                      isSel ? "border border-[#132033] bg-[#eef4f8] font-semibold" : ""
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
        <AgendaGiornoImpegniPanel
          year={viewYear}
          month={viewMonth}
          day={day}
          excludePraticaId={praticaId}
        />
      </div>

      <label className="mt-3 block text-xs">
        <span className="font-semibold text-[var(--muted)]">Nota agenda</span>
        <textarea
          name="nota"
          rows={3}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Testo del richiamo (separato dal messaggio ai colleghi)"
          className="mt-0.5 w-full resize-y rounded border border-[var(--line)] bg-[#fafcfd] px-3 py-2 font-sans text-sm"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="h-9 rounded bg-[var(--navy)] px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Salvataggio…" : "Salva in agenda"}
        </button>
        <button type="button" onClick={applyToday} className="h-9 px-2 text-sm text-[#1a73e8]">
          Oggi
        </button>
        {memoAt ? (
          <CompletaRichiamoButton
            praticaId={praticaId}
            label="Azzera richiamo"
            onCleared={onDone}
          />
        ) : null}
      </div>
      {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
    </form>
  );
}
