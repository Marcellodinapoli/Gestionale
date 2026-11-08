import { labelStatoAvvio } from "@/lib/giudiziale/avvioGiudiziale";
import {
  isScadutaStragiudiziale,
  scadenzaStragiudizialeEffettiva,
  STATI_GIUDIZIALE_NASCOSTI_A_OPERATORI,
} from "@/lib/scadenzaStragiudiziale";

export type InboundPraticaFaseInput = {
  stato: string;
  statoOperativo: string;
  scadenza?: Date | string | null;
  dataPassaggioGiudiziale?: Date | string | null;
  conferimentoTipo?: string | null;
  statoAvvioGiudiziale?: string | null;
};

/** Messaggio quando la scheda pratica non è apribile (operatore/supervisor). */
export function describeInboundPraticaFase(input: InboundPraticaFaseInput): string {
  const statoG = input.statoAvvioGiudiziale?.trim() || null;
  if (
    statoG &&
    (STATI_GIUDIZIALE_NASCOSTI_A_OPERATORI as readonly string[]).includes(statoG)
  ) {
    return `Affidata alla sezione legale — ${labelStatoAvvio(statoG)}. La scheda operatore non è disponibile.`;
  }

  const eff = scadenzaStragiudizialeEffettiva({
    scadenza: input.scadenza,
    dataPassaggioGiudiziale: input.dataPassaggioGiudiziale,
    conferimentoTipo: input.conferimentoTipo,
  });
  if (isScadutaStragiudiziale(eff)) {
    return "Fase stragiudiziale scaduta: la pratica non è più in lavorazione operatore. Per dettagli rivolgersi alla sezione competente (legale / back office).";
  }

  if (input.statoOperativo === "SCADUTA") {
    return "Pratica scaduta (mandato): non è apribile dalla lavorazione operatore.";
  }

  return "Pratica non apribile dal tuo profilo (ambito operativo o assegnazione).";
}
