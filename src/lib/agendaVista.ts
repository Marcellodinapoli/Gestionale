export type VistaAgenda = "giorno" | "settimana" | "mese";

export function parseVistaAgenda(raw?: string | null): VistaAgenda {
  if (raw === "settimana" || raw === "mese") return raw;
  return "giorno";
}

export function parseDataAgenda(raw?: string | null): Date {
  if (raw?.trim()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (
        d.getFullYear() === Number(m[1]) &&
        d.getMonth() === Number(m[2]) - 1 &&
        d.getDate() === Number(m[3])
      ) {
        return d;
      }
    }
  }
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  return oggi;
}

export function formatDataAgenda(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function intervalloVista(vista: VistaAgenda, anchor: Date) {
  const start = startOfDay(anchor);
  const end = endOfDay(anchor);

  if (vista === "giorno") {
    return { start, end };
  }

  if (vista === "settimana") {
    const dow = (start.getDay() + 6) % 7;
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - dow);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return { start: weekStart, end: endOfDay(weekEnd) };
  }

  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { start: monthStart, end: endOfDay(monthEnd) };
}

export function spostaAnchor(vista: VistaAgenda, anchor: Date, delta: number) {
  const d = new Date(anchor);
  if (vista === "giorno") d.setDate(d.getDate() + delta);
  else if (vista === "settimana") d.setDate(d.getDate() + delta * 7);
  else d.setMonth(d.getMonth() + delta);
  return d;
}

export function etichettaIntervallo(vista: VistaAgenda, anchor: Date) {
  const { start, end } = intervalloVista(vista, anchor);
  const fmt = (d: Date) =>
    d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  if (vista === "giorno") {
    return fmt(start);
  }
  if (vista === "settimana") {
    return `${fmt(start)} – ${fmt(end)}`;
  }
  return start.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
}

export function filtraPerIntervallo<T extends { memoAt: string }>(
  items: T[],
  start: Date,
  end: Date
) {
  const s = start.getTime();
  const e = end.getTime();
  return items.filter((item) => {
    const t = new Date(item.memoAt).getTime();
    return t >= s && t <= e;
  });
}
