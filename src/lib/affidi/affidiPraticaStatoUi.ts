import { statoOperativoPratica } from "@/lib/statoOperativoPratica";
import {
  isScadutaStragiudiziale,
  scadenzaStragiudizialeEffettiva,
  STATI_GIUDIZIALE_NASCOSTI_A_OPERATORI,
} from "@/lib/scadenzaStragiudiziale";
import { STATI_ATTIVITA_GIUDIZIALE } from "@/lib/giudiziale/avvioGiudiziale";
import {
  isGiudizialePrevistoSulLotto,
  isStragiudizialePrevistoSulLotto,
} from "@/lib/conferimentoLegale";

const STATI_CHIUSE_AFFIDI = new Set(["INCASSO", "RESA", "INESIGIBILE"]);

function isPraticaNonAssegnata(p: {
  stato: string;
  assegnatarioId?: string | null;
}) {
  return p.assegnatarioId == null && !STATI_CHIUSE_AFFIDI.has(p.stato);
}

function isPraticaScadutaAperta(p: {
  stato: string;
  scadenza?: Date | string | null;
}) {
  if (STATI_CHIUSE_AFFIDI.has(p.stato) || !p.scadenza) return false;
  const d = p.scadenza instanceof Date ? p.scadenza : new Date(p.scadenza);
  if (Number.isNaN(d.getTime())) return false;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day < oggi;
}

function inizioGiorno(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type AffidiPraticaStatoInput = {
  stato: string;
  assegnatarioId?: string | null;
  scadenza?: Date | string | null;
  codiceScaricoBk?: string | null;
  dataPassaggioGiudiziale?: Date | string | null;
  conferimentoTipo?: string | null;
  statoAvvioGiudiziale?: string | null;
};

export function affidiStatoOperativo(p: AffidiPraticaStatoInput) {
  return statoOperativoPratica({
    stato: p.stato,
    assegnatarioId: p.assegnatarioId,
    scadenza: p.scadenza,
    codiceScaricoBk: p.codiceScaricoBk,
  });
}

/** In gestione legale (fascicolo giudiziale avviato / in attesa legale). */
export function affidiPraticaLegale(p: AffidiPraticaStatoInput): boolean {
  const statoG = p.statoAvvioGiudiziale?.trim();
  if (!statoG) return false;
  return (STATI_GIUDIZIALE_NASCOSTI_A_OPERATORI as readonly string[]).includes(statoG);
}

export function affidiPraticaScaduta(p: AffidiPraticaStatoInput): boolean {
  return affidiStatoOperativo(p) === "SCADUTA";
}

export function affidiPraticaInLavorazione(p: AffidiPraticaStatoInput): boolean {
  return affidiStatoOperativo(p) === "IN_LAVORAZIONE";
}

/** Mandato scaduto o fase stragiudiziale conclusa: non in coda Affida per il supervisor. */
export function affidiPraticaScadutaPerSupervisor(p: AffidiPraticaStatoInput): boolean {
  if (isPraticaScadutaAperta({ stato: p.stato, scadenza: p.scadenza })) return true;
  const eff = scadenzaStragiudizialeEffettiva({
    scadenza: p.scadenza,
    dataPassaggioGiudiziale: p.dataPassaggioGiudiziale,
    conferimentoTipo: p.conferimentoTipo,
  });
  return isScadutaStragiudiziale(eff);
}

/** Fascicolo in attività giudiziale (valutazione legale, procedura, …). */
export function affidiPraticaInFaseGiudiziale(p: AffidiPraticaStatoInput): boolean {
  const statoG = p.statoAvvioGiudiziale?.trim();
  if (!statoG) return false;
  return (STATI_ATTIVITA_GIUDIZIALE as readonly string[]).includes(statoG);
}

/**
 * Card Affidi «In fase giudiziale»: attività giudiziale, lotto solo giudiziale,
 * o stragiudiziale concluso su lotto con fase giudiziale (anche senza stato fascicolo avanzato).
 */
export function affidiPraticaInFaseGiudizialeAffidiCard(p: AffidiPraticaStatoInput): boolean {
  if (STATI_CHIUSE_AFFIDI.has(p.stato)) return false;
  const statoG = p.statoAvvioGiudiziale?.trim();
  if (statoG === "ARCHIVIATA_SENZA_AZIONE" || statoG === "CONCLUSA_CON_ESITO") return false;
  if (affidiPraticaInFaseGiudiziale(p)) return true;
  if (!isGiudizialePrevistoSulLotto(p.conferimentoTipo)) return false;
  if (!isStragiudizialePrevistoSulLotto(p.conferimentoTipo)) return true;
  return affidiPraticaScadutaPerSupervisor(p);
}

/** Stragiudiziale attivo: stato operativo in lavorazione, non in coda giudiziale. */
export function affidiPraticaInLavorazioneStragiudizialeAffidi(
  p: AffidiPraticaStatoInput
): boolean {
  if (affidiPraticaInFaseGiudizialeAffidiCard(p)) return false;
  return affidiPraticaInLavorazione(p);
}

/** In scadenza 7 gg solo sul portafoglio stragiudiziale in lavorazione. */
export function affidiPraticaInScadenza7ggAffidi(
  p: AffidiPraticaStatoInput,
  now = new Date()
): boolean {
  if (!affidiPraticaInLavorazioneStragiudizialeAffidi(p)) return false;
  if (!p.scadenza) return false;
  const d = p.scadenza instanceof Date ? p.scadenza : new Date(p.scadenza);
  if (Number.isNaN(d.getTime())) return false;
  const oggi = inizioGiorno(now);
  const tra7gg = new Date(oggi);
  tra7gg.setDate(tra7gg.getDate() + 7);
  const day = inizioGiorno(d);
  return day >= oggi && day <= tra7gg;
}

/** Giudiziali aperte senza affidatario (coda dedicata back office). */
export function isPraticaGiudizialeDaAffidareAffidi(p: AffidiPraticaStatoInput): boolean {
  return p.assegnatarioId == null && affidiPraticaInFaseGiudizialeAffidiCard(p);
}

/** Card Home «Da affidare» / monitor Affidi: senza affidatario, non scadute (come non_assegnate supervisor). */
export function isPraticaDaAffidareGruppoHome(p: AffidiPraticaStatoInput): boolean {
  return (
    isPraticaNonAssegnata(p) &&
    !affidiPraticaScadutaPerSupervisor(p) &&
    !affidiPraticaLegale(p)
  );
}

/** Supervisor: niente scadute; da affidare = aperte senza affidatario e non scadute. */
export function visibileInElencoAffidiSupervisor(p: AffidiPraticaStatoInput): boolean {
  if (affidiPraticaLegale(p)) return false;
  if (affidiPraticaScadutaPerSupervisor(p)) return false;
  const op = affidiStatoOperativo(p);
  if (op === "SCADUTA") return false;
  return op === "IN_LAVORAZIONE" || op === "NUOVA";
}
