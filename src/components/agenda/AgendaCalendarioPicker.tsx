"use client";

import { useEffect, useState } from "react";
import { AgendaGiornoImpegniPanel } from "@/components/agenda/AgendaGiornoImpegniPanel";

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

export function toAgendaLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseAgendaLocal(value?: string | null) {
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

export function AgendaCalendarioPicker({
  initial,
  onChange,
}: {
  initial?: Date;
  onChange: (localValue: string) => void;
}) {
  const base = initial || new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  const [day, setDay] = useState(base.getDate());
  const [hour, setHour] = useState(base.getHours());
  const [minute, setMinute] = useState(base.getMinutes());

  useEffect(() => {
    const d = initial || new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setDay(d.getDate());
    setHour(d.getHours());
    setMinute(d.getMinutes());
  }, [initial]);

  const selected = new Date(viewYear, viewMonth, day, hour, minute);
  const selectedValue = toAgendaLocalValue(selected);
  const days = monthGrid(viewYear, viewMonth);
  const today = new Date();

  useEffect(() => {
    onChange(selectedValue);
  }, [selectedValue, onChange]);

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

  return (
    <div>
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
        <AgendaGiornoImpegniPanel year={viewYear} month={viewMonth} day={day} />
      </div>
      <button type="button" onClick={applyToday} className="mt-2 text-sm text-[#1a73e8]">
        Oggi
      </button>
    </div>
  );
}
