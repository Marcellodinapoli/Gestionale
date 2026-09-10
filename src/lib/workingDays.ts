/** Giorni lavorativi lun–ven (senza festività IT in v1). */

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Aggiunge N giorni lavorativi a una data (salta sab/dom). N può essere 0. */
export function addWorkingDays(from: Date, workingDays: number): Date {
  const out = startOfLocalDay(from);
  let left = Math.max(0, Math.floor(workingDays));
  while (left > 0) {
    out.setDate(out.getDate() + 1);
    if (!isWeekend(out)) left -= 1;
  }
  return out;
}

/** Giorni lavorativi strettamente tra due date (esclusi estremi weekend-aware count). */
export function workingDaysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from);
  const b = startOfLocalDay(to);
  if (b < a) return -workingDaysBetween(b, a);
  let n = 0;
  const cur = new Date(a);
  cur.setDate(cur.getDate() + 1);
  while (cur <= b) {
    if (!isWeekend(cur)) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
