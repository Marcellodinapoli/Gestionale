const MESE_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseIncMeseParam(raw?: string): { year: number; month: number } {
  const now = new Date();
  const match = raw?.trim().match(MESE_RE);
  if (!match) {
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

export function rangeMeseIncassi(raw?: string) {
  const { year, month } = parseIncMeseParam(raw);
  const inizio = new Date(year, month, 1, 0, 0, 0, 0);
  const fine = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const label = inizio.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const param = raw?.trim().match(MESE_RE) ? raw.trim() : undefined;
  return { inizio, fine, label, param };
}

export function incMeseSelectOptions(monthsBack = 24): Array<{ value: string; label: string }> {
  const opts: Array<{ value: string; label: string }> = [{ value: "", label: "Mese corrente" }];
  const now = new Date();
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}
