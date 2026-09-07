import { statoChiusuraDaCodiceScarico } from "@/lib/scarico";

/**
 * Ciclo di vita operativo pratica (distinto dal codice scarico operatore LPP/PPC/…).
 * Import → NUOVA; affido → IN_LAVORAZIONE; scadenza passata → SCADUTA (derivata).
 * Resa / inesigibile seguono il codice scarico **bk off** (LPT/MOV).
 */
export const STATI_OPERATIVI = ["NUOVA", "IN_LAVORAZIONE", "SCADUTA"] as const;
export type StatoOperativo = (typeof STATI_OPERATIVI)[number];

/** Opzioni filtro elenco Pratiche (tendina): solo carico e scadute. */
export const STATI_FILTRO_PRATICHE = [
  { value: "IN_LAVORAZIONE", label: "In lavorazione" },
  { value: "SCADUTA", label: "Scadute" },
] as const;

export const STATO_OPERATIVO_LABELS: Record<StatoOperativo, string> = {
  NUOVA: "Nuova",
  IN_LAVORAZIONE: "In lavorazione",
  SCADUTA: "Scaduta",
};

const STATI_CHIUSI = new Set(["INCASSO", "INESIGIBILE", "RESA"]);

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Inizio giornata UTC per confronti scadenza in filtri Prisma. */
export function inizioGiornataUtc(now = new Date()): Date {
  return startOfDay(now);
}

/** Stato da mostrare in Affidi / elenchi operativi / Sit. affido. */
export function statoOperativoPratica(input: {
  stato: string;
  assegnatarioId?: string | null;
  scadenza?: Date | string | null;
  /** Codice scarico back office: guida RESA / INESIGIBILE. */
  codiceScaricoBk?: string | null;
  now?: Date;
}): StatoOperativo | string {
  const chiusuraBk = input.codiceScaricoBk
    ? statoChiusuraDaCodiceScarico(input.codiceScaricoBk)
    : null;
  if (chiusuraBk) return chiusuraBk;

  // Incasso da residuo azzerato: indipendente dal bk off.
  if (input.stato === "INCASSO") return "INCASSO";

  // RESA/INESIGIBILE senza bk off → tratta come aperta (Sit. affido torna in lavorazione).
  if (!input.assegnatarioId) return "NUOVA";

  const scad = input.scadenza
    ? input.scadenza instanceof Date
      ? input.scadenza
      : new Date(input.scadenza)
    : null;
  if (scad && !Number.isNaN(scad.getTime())) {
    const day = startOfDay(scad);
    if (day < (input.now ? startOfDay(input.now) : startOfTodayUtc())) {
      return "SCADUTA";
    }
  }

  return "IN_LAVORAZIONE";
}

/**
 * Where Prisma per filtro tendina Pratiche (stato operativo, non colonna DB grezza).
 * IN_LAVORAZIONE = affidata e non scaduta; SCADUTA = affidata con scadenza passata.
 */
export function whereStatoFiltroPratiche(
  statoFiltro: string,
  now = new Date()
): Record<string, unknown> {
  const oggi = inizioGiornataUtc(now);
  if (statoFiltro === "SCADUTA") {
    return {
      assegnatarioId: { not: null },
      scadenza: { lt: oggi },
      stato: { notIn: [...STATI_CHIUSI] },
    };
  }
  if (statoFiltro === "IN_LAVORAZIONE") {
    return {
      assegnatarioId: { not: null },
      stato: { notIn: [...STATI_CHIUSI] },
      OR: [{ scadenza: null }, { scadenza: { gte: oggi } }],
    };
  }
  if (statoFiltro === "NUOVA") {
    return { assegnatarioId: null, stato: { notIn: [...STATI_CHIUSI] } };
  }
  // Legacy URL (?stato=PROMESSA|…): ignora mapping colonna, non espone più in UI.
  return { stato: statoFiltro };
}
