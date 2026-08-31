/** Mappa righe SQL PascalCase → camelCase Prisma. */
export function mapSqlRow(row: Record<string, unknown>): Record<string, unknown> {
  if (!row || row.id) return row;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.charAt(0).toLowerCase() + k.slice(1)] = v;
  }
  if (row.Perimetri != null && out.perimetri == null) out.perimetri = row.Perimetri;
  if (row.PerimetriJson != null && out.perimetri == null) out.perimetri = row.PerimetriJson;
  if (row.ProvvigioniMetodoJson != null && out.provvigioniMetodo == null) {
    out.provvigioniMetodo = row.ProvvigioniMetodoJson;
  }
  if (row.CodiciScaricoJson != null && out.codiciScarico == null) {
    out.codiciScarico = row.CodiciScaricoJson;
  }
  if (row.SmsPreimpostatiJson != null && out.smsPreimpostati == null) {
    out.smsPreimpostati = row.SmsPreimpostatiJson;
  }
  if (row.PraticaCount != null) {
    out._count = { pratiche: Number(row.PraticaCount) };
  }
  return out;
}

export function applySelect(row: Record<string, unknown>, select: unknown) {
  if (!select || typeof select !== "object") return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select as Record<string, unknown>)) {
    const sel = (select as Record<string, unknown>)[key];
    if (sel === true) out[key] = row[key];
    else if (key === "_count" && sel && typeof sel === "object") {
      const countSel = (sel as { select?: Record<string, boolean> }).select;
      if (countSel?.pratiche) out._count = row._count;
    }
  }
  return out;
}
