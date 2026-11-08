import {
  SORT_COLUMNS,
  parseDir,
  parseSort,
  type SortDir,
  type SortField,
} from "@/lib/praticaSortFields";

export type AffidaSortCol = {
  key: SortField;
  label: string;
  href: string;
  active: boolean;
  arrow: string;
};

export function parseAffidaSortFromQuery(affidaQuery: string): {
  sort: SortField;
  dir: SortDir;
} | null {
  if (!affidaQuery.trim()) return null;
  const sp = new URLSearchParams(affidaQuery);
  const rawSort = sp.get("affidaSort");
  if (!rawSort) return null;
  const sort = parseSort(rawSort);
  return { sort, dir: parseDir(sp.get("affidaDir"), sort) };
}

export function buildAffidaSortHref(
  affidaQuery: string,
  field: SortField,
  currentSort: SortField,
  currentDir: SortDir
): string {
  const sp = new URLSearchParams(affidaQuery);
  const nextDir = field === currentSort && currentDir === "asc" ? "desc" : "asc";
  sp.set("affidaSort", field);
  sp.set("affidaDir", nextDir);
  sp.delete("affidaPage");
  const qs = sp.toString();
  return qs ? `/affidi?${qs}` : "/affidi";
}

export function affidaSortColumns(
  affidaQuery: string,
  sortParsed: { sort: SortField; dir: SortDir } | null
): AffidaSortCol[] {
  const currentSort = sortParsed?.sort ?? "numero";
  const currentDir = sortParsed?.dir ?? "asc";
  return SORT_COLUMNS.map((col) => {
    const active = sortParsed != null && sortParsed.sort === col.key;
    const dir = sortParsed?.dir ?? "asc";
    return {
      key: col.key,
      label: col.label,
      href: buildAffidaSortHref(affidaQuery, col.key, currentSort, currentDir),
      active,
      arrow: active ? (dir === "asc" ? " ▲" : " ▼") : "",
    };
  });
}
