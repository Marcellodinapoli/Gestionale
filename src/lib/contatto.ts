export const ESITO_CONTATTO_LABELS: Record<string, string> = {
  CONTATTO: "Contatto",
  NON_RISPONDE: "Non risponde",
  PROMESSA: "Promessa",
  RIFIUTO: "Rifiuto",
  RECAPITO_ERRATO: "Recapito errato",
  INESIGIBILE: "Inesigibile",
  ALTRO: "Altro",
};

export const TIPO_CONTATTO_LABELS: Record<string, string> = {
  TELEFONATA: "Telefonata",
  LETTERA: "Lettera / SMS",
  APPUNTAMENTO: "Appuntamento",
  NOTA: "Nota libera",
};

export const ESITO_CONTATTO_OPTIONS = Object.entries(ESITO_CONTATTO_LABELS);
export const TIPO_CONTATTO_OPTIONS = Object.entries(TIPO_CONTATTO_LABELS);

export function esitoContattoLabel(value?: string | null) {
  if (!value) return "—";
  return ESITO_CONTATTO_LABELS[value] || value;
}

export function tipoContattoLabel(value?: string | null) {
  if (!value) return "—";
  return TIPO_CONTATTO_LABELS[value] || value;
}
