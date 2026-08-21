export const METODI_INCASSO = [
  { value: "contanti", label: "Contanti" },
  { value: "assegni", label: "Assegni" },
  { value: "bonifico", label: "Bonifico" },
  { value: "bollettino", label: "Bollettino postale" },
  { value: "pdr_cambiali", label: "Piano di rientro con cambiali" },
  { value: "carta", label: "Carta di credito / POS" },
  { value: "rid", label: "RID / SDD" },
  { value: "vaglia", label: "Vaglia postale" },
  { value: "altro", label: "Altro" },
] as const;

export type MetodoIncasso = (typeof METODI_INCASSO)[number]["value"];

const LABELS = Object.fromEntries(
  METODI_INCASSO.map((m) => [m.value, m.label])
) as Record<string, string>;

export function metodoIncassoLabel(metodo: string) {
  if (LABELS[metodo]) return LABELS[metodo];
  return metodo
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isMetodoIncassoValido(metodo: string) {
  return METODI_INCASSO.some((m) => m.value === metodo);
}
