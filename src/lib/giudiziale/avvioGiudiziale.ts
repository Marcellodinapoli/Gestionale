/** Costanti e tipi — Avvio attività giudiziale (prima pagina). */

export const MOTIVI_PASSAGGIO_GIUDIZIALE = [
  { value: "MANCATO_PAGAMENTO", label: "Mancato pagamento" },
  { value: "PROMESSA_NON_MANTENUTA", label: "Promessa non mantenuta" },
  { value: "PIANO_RIENTRO_DECADUTO", label: "Piano di rientro decaduto" },
  { value: "IRREPERIBILITA", label: "Irreperibilità" },
  { value: "CONTESTAZIONE", label: "Contestazione" },
  { value: "INSOLVENZA", label: "Insolvenza" },
  { value: "ALTRO", label: "Altro" },
] as const;

export type MotivoPassaggioGiudiziale =
  (typeof MOTIVI_PASSAGGIO_GIUDIZIALE)[number]["value"];

export const TRISTATO_VERIFICA = [
  { value: "SI", label: "Sì" },
  { value: "NO", label: "No" },
  { value: "IN_VERIFICA", label: "In verifica" },
] as const;

export type TriStatoVerifica = (typeof TRISTATO_VERIFICA)[number]["value"];

export const VALUTAZIONE_RECUPERABILITA = [
  { value: "POSITIVA", label: "Positiva" },
  { value: "NEGATIVA", label: "Negativa" },
  { value: "DA_VALUTARE", label: "Da valutare" },
] as const;

export type ValutazioneRecuperabilita =
  (typeof VALUTAZIONE_RECUPERABILITA)[number]["value"];

export const STATI_AVVIO_GIUDIZIALE = [
  { value: "BOZZA", label: "Bozza" },
  {
    value: "ARCHIVIATA_SENZA_AZIONE",
    label: "Archiviata senza azione giudiziale",
  },
  {
    value: "IN_ATTESA_VALUTAZIONE_LEGALE",
    label: "In attesa di valutazione legale",
  },
  {
    value: "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
    label: "Giudiziale avviato – procedura da definire",
  },
  { value: "IN_PROCEDURA", label: "In procedura" },
  { value: "CONCLUSA_CON_ESITO", label: "Conclusa con esito" },
] as const;

export type StatoAvvioGiudiziale = (typeof STATI_AVVIO_GIUDIZIALE)[number]["value"];

export type AzioneAvvioGiudiziale =
  | "ARCHIVIA_SENZA_AZIONE"
  | "RICHIEDI_VALUTAZIONE"
  | "AVVIA_PROCEDURA";

export function statoFromAzione(azione: AzioneAvvioGiudiziale): StatoAvvioGiudiziale {
  switch (azione) {
    case "ARCHIVIA_SENZA_AZIONE":
      return "ARCHIVIATA_SENZA_AZIONE";
    case "RICHIEDI_VALUTAZIONE":
      return "IN_ATTESA_VALUTAZIONE_LEGALE";
    case "AVVIA_PROCEDURA":
      return "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE";
  }
}

export function labelMotivo(value?: string | null) {
  return MOTIVI_PASSAGGIO_GIUDIZIALE.find((m) => m.value === value)?.label ?? value ?? "—";
}

export function labelStatoAvvio(value?: string | null) {
  if (value === "PROCEDURA_AVVIATA") {
    return "Giudiziale avviato – procedura da definire";
  }
  return STATI_AVVIO_GIUDIZIALE.find((s) => s.value === value)?.label ?? value ?? "—";
}

export function isStatoAvvioChiuso(stato?: string | null) {
  return (
    stato === "ARCHIVIATA_SENZA_AZIONE" ||
    stato === "IN_ATTESA_VALUTAZIONE_LEGALE" ||
    stato === "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE" ||
    stato === "IN_PROCEDURA" ||
    stato === "CONCLUSA_CON_ESITO" ||
    // legacy (prima versione avvio)
    stato === "PROCEDURA_AVVIATA"
  );
}

/** True se dalla pratica è già stata confermata un'azione di avvio giudiziale. */
export function isGiudizialeAvviato(stato?: string | null) {
  return isStatoAvvioChiuso(stato);
}
