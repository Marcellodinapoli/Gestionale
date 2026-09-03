/** Filtro operatore di affido (multi-selezione, = / ≠). */

export type OperatoreFiltroOp = "eq" | "ne";

export const OPERATORE_FILTER_OPS: {
  value: OperatoreFiltroOp;
  label: string;
  title: string;
}[] = [
  { value: "eq", label: "=", title: "Uguale" },
  { value: "ne", label: "≠", title: "Diverso" },
];

export const OPERATORE_LIST_SEP = ",";

export function parseOperatoreOp(raw?: string | null): OperatoreFiltroOp {
  if (raw === "ne") return "ne";
  return "eq";
}

export function labelOperatoreOp(op?: OperatoreFiltroOp | null) {
  return OPERATORE_FILTER_OPS.find((o) => o.value === parseOperatoreOp(op))?.label ?? "=";
}

export function parseOperatoreList(raw?: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(OPERATORE_LIST_SEP)) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function joinOperatoreList(ids: readonly string[]): string {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].join(OPERATORE_LIST_SEP);
}

export function hasOperatoreFiltro(raw?: string | null) {
  return parseOperatoreList(raw).length > 0;
}

export type OperatoreFiltroOption = {
  id: string;
  name: string;
  acronimo?: string | null;
};

export function codiceOperatoreFiltro(op: OperatoreFiltroOption): string {
  const acr = op.acronimo?.trim();
  if (acr) return acr.toUpperCase();
  const parts = op.name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

/** Ruoli che possono usare il filtro cod. operatore. */
export const OPERATORE_FILTRO_ROLES = [
  "OPERATOR",
  "SUPERVISOR",
  "ADMIN",
  "BACK_OFFICE",
  "AMMINISTRAZIONE",
] as const;

export function canUseOperatoreFiltro(role: string) {
  return (OPERATORE_FILTRO_ROLES as readonly string[]).includes(role);
}

/** Solo operatori: membri del gruppo; supervisor/admin/back office/amministrazione: tutti. */
export function operatoreFiltroSoloGruppo(role: string) {
  return role === "OPERATOR";
}

/** Default filtro = operatore titolare dell'account (operatori e supervisor). */
export function defaultOperatoreFiltroId(role: string, userId: string) {
  return role === "OPERATOR" || role === "SUPERVISOR" ? userId : undefined;
}

export function memberIdsOperatoreFiltro(
  role: string,
  userId: string,
  memberIds: readonly string[]
) {
  if (!operatoreFiltroSoloGruppo(role)) return undefined;
  return memberIds.length ? [...memberIds] : [userId];
}
