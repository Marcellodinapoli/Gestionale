import "server-only";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider, isNeonProvider } from "@/lib/data/factory";
import { connectorFetch } from "@/lib/data/connector/ConnectorClient";
import { neonQuery } from "@/lib/neon/pool";
import { resolveTenantSlug } from "@/lib/praticheRepo";
import { mapSqlRow } from "@/lib/data/mapSqlRow";
import type { SessionUser } from "@/lib/permissions";
import type { StatoAvvioGiudiziale } from "@/lib/giudiziale/avvioGiudiziale";
import {
  costiSostenutiDaTotale,
  normalizeSpeseGiudizialiInput,
} from "@/lib/giudiziale/speseGiudiziali";

export type PraticaGiudizialeRecord = {
  id: string;
  tenantId: string;
  praticaId: string;
  statoAvvio: string;
  dataAffidamentoGiudiziale: Date | string | null;
  studioLegale: string | null;
  avvocatoReferente: string | null;
  referenteInternoId: string | null;
  noteAffidamento: string | null;
  motivoPassaggio: string | null;
  motivoAltroDettaglio: string | null;
  documentazioneDisponibile: string | null;
  prescrizioneVerificata: string | null;
  anagraficaDebitoreVerificata: string | null;
  valutazioneRecuperabilita: string | null;
  noteVerifica: string | null;
  motivazioneArchiviazione: string | null;
  noteArchiviazione: string | null;
  titoloCreditoEsistenza: string | null;
  titoloCreditoValidita: string | null;
  titoloCreditoEsigibilita: string | null;
  prescrizioneTermini: string | null;
  documentazioneProve: string | null;
  contestazioniDebitore: string | null;
  solvibilitaRecupero: string | null;
  giudiceCompetente: string | null;
  foroEventuale: string | null;
  tipoAzioneIpotizzata: string | null;
  tipoAzioneAltroDettaglio: string | null;
  costiBenefici: string | null;
  rischiLegali: string | null;
  parereValutazione: string | null;
  parereMotivazione: string | null;
  valutazioneCompletataAt: Date | string | null;
  valutazioneById: string | null;
  strategiaScelta: string | null;
  proceduraDaSeguire: string | null;
  professionistaIncaricato: string | null;
  attivitaProceduraJson: string | null;
  agendaScadenze: string | null;
  documentiDaProdurre: string | null;
  statoProcedura: string | null;
  eventiStorico: string | null;
  costiSostenuti: string | null;
  speseGiudizialiJson: string | null;
  esitoGiudiziale: string | null;
  dataEsito: Date | string | null;
  importoRecuperato: number | null;
  noteLegaliOperatori: string | null;
  strategiaAggiornataAt: Date | string | null;
  esitoRegistratoAt: Date | string | null;
  createdById: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  closedAt: Date | string | null;
};

export type PraticaGiudizialeUpsertInput = {
  statoAvvio: StatoAvvioGiudiziale;
  dataAffidamentoGiudiziale?: string | Date | null;
  studioLegale?: string | null;
  avvocatoReferente?: string | null;
  referenteInternoId?: string | null;
  noteAffidamento?: string | null;
  motivoPassaggio?: string | null;
  motivoAltroDettaglio?: string | null;
  documentazioneDisponibile?: string | null;
  prescrizioneVerificata?: string | null;
  anagraficaDebitoreVerificata?: string | null;
  valutazioneRecuperabilita?: string | null;
  noteVerifica?: string | null;
  motivazioneArchiviazione?: string | null;
  noteArchiviazione?: string | null;
  createdById?: string | null;
  closedAt?: string | Date | null;
};

export type ValutazioneLegaleInput = {
  statoAvvio: StatoAvvioGiudiziale;
  titoloCreditoEsistenza?: string | null;
  titoloCreditoValidita?: string | null;
  titoloCreditoEsigibilita?: string | null;
  prescrizioneTermini?: string | null;
  documentazioneProve?: string | null;
  contestazioniDebitore?: string | null;
  solvibilitaRecupero?: string | null;
  giudiceCompetente?: string | null;
  foroEventuale?: string | null;
  tipoAzioneIpotizzata?: string | null;
  tipoAzioneAltroDettaglio?: string | null;
  costiBenefici?: string | null;
  rischiLegali?: string | null;
  parereValutazione?: string | null;
  parereMotivazione?: string | null;
  valutazioneCompletataAt?: string | Date | null;
  valutazioneById?: string | null;
  createdById?: string | null;
};

export type StrategiaProceduraInput = {
  statoAvvio: StatoAvvioGiudiziale;
  strategiaScelta?: string | null;
  proceduraDaSeguire?: string | null;
  professionistaIncaricato?: string | null;
  attivitaProceduraJson?: string | null;
  agendaScadenze?: string | null;
  documentiDaProdurre?: string | null;
  statoProcedura?: string | null;
  eventiStorico?: string | null;
  costiSostenuti?: string | null;
  /** JSON voci spesa; se valorizzato aggiorna anche Pratica.speseGiudiziali. */
  speseGiudizialiJson?: string | null;
  esitoGiudiziale?: string | null;
  dataEsito?: string | Date | null;
  importoRecuperato?: number | null;
  noteLegaliOperatori?: string | null;
  strategiaAggiornataAt?: string | Date | null;
  esitoRegistratoAt?: string | Date | null;
  closedAt?: string | Date | null;
  createdById?: string | null;
};

function str(v: unknown) {
  if (v == null || v === "") return null;
  return String(v);
}

function mapRow(row: Record<string, unknown>): PraticaGiudizialeRecord {
  const m = mapSqlRow(row) as Record<string, unknown>;
  return {
    id: String(m.id),
    tenantId: String(m.tenantId),
    praticaId: String(m.praticaId),
    statoAvvio: String(m.statoAvvio || "BOZZA"),
    dataAffidamentoGiudiziale: (m.dataAffidamentoGiudiziale as Date | string | null) ?? null,
    studioLegale: str(m.studioLegale),
    avvocatoReferente: str(m.avvocatoReferente),
    referenteInternoId: str(m.referenteInternoId),
    noteAffidamento: str(m.noteAffidamento),
    motivoPassaggio: str(m.motivoPassaggio),
    motivoAltroDettaglio: str(m.motivoAltroDettaglio),
    documentazioneDisponibile: str(m.documentazioneDisponibile),
    prescrizioneVerificata: str(m.prescrizioneVerificata),
    anagraficaDebitoreVerificata: str(m.anagraficaDebitoreVerificata),
    valutazioneRecuperabilita: str(m.valutazioneRecuperabilita),
    noteVerifica: str(m.noteVerifica),
    motivazioneArchiviazione: str(m.motivazioneArchiviazione),
    noteArchiviazione: str(m.noteArchiviazione),
    titoloCreditoEsistenza: str(m.titoloCreditoEsistenza),
    titoloCreditoValidita: str(m.titoloCreditoValidita),
    titoloCreditoEsigibilita: str(m.titoloCreditoEsigibilita),
    prescrizioneTermini: str(m.prescrizioneTermini),
    documentazioneProve: str(m.documentazioneProve),
    contestazioniDebitore: str(m.contestazioniDebitore),
    solvibilitaRecupero: str(m.solvibilitaRecupero),
    giudiceCompetente: str(m.giudiceCompetente),
    foroEventuale: str(m.foroEventuale),
    tipoAzioneIpotizzata: str(m.tipoAzioneIpotizzata),
    tipoAzioneAltroDettaglio: str(m.tipoAzioneAltroDettaglio),
    costiBenefici: str(m.costiBenefici),
    rischiLegali: str(m.rischiLegali),
    parereValutazione: str(m.parereValutazione),
    parereMotivazione: str(m.parereMotivazione),
    valutazioneCompletataAt: (m.valutazioneCompletataAt as Date | string | null) ?? null,
    valutazioneById: str(m.valutazioneById),
    strategiaScelta: str(m.strategiaScelta),
    proceduraDaSeguire: str(m.proceduraDaSeguire),
    professionistaIncaricato: str(m.professionistaIncaricato),
    attivitaProceduraJson: str(m.attivitaProceduraJson),
    agendaScadenze: str(m.agendaScadenze),
    documentiDaProdurre: str(m.documentiDaProdurre),
    statoProcedura: str(m.statoProcedura),
    eventiStorico: str(m.eventiStorico),
    costiSostenuti: str(m.costiSostenuti),
    speseGiudizialiJson: str(m.speseGiudizialiJson),
    esitoGiudiziale: str(m.esitoGiudiziale),
    dataEsito: (m.dataEsito as Date | string | null) ?? null,
    importoRecuperato:
      m.importoRecuperato != null && m.importoRecuperato !== ""
        ? Number(m.importoRecuperato)
        : null,
    noteLegaliOperatori: str(m.noteLegaliOperatori),
    strategiaAggiornataAt: (m.strategiaAggiornataAt as Date | string | null) ?? null,
    esitoRegistratoAt: (m.esitoRegistratoAt as Date | string | null) ?? null,
    createdById: str(m.createdById),
    createdAt: (m.createdAt as Date | string) ?? new Date(),
    updatedAt: (m.updatedAt as Date | string) ?? new Date(),
    closedAt: (m.closedAt as Date | string | null) ?? null,
  };
}

function valutazioneData(input: ValutazioneLegaleInput, userId: string) {
  const completedAt = input.valutazioneCompletataAt
    ? new Date(input.valutazioneCompletataAt)
    : null;
  return {
    statoAvvio: input.statoAvvio,
    titoloCreditoEsistenza: input.titoloCreditoEsistenza || null,
    titoloCreditoValidita: input.titoloCreditoValidita || null,
    titoloCreditoEsigibilita: input.titoloCreditoEsigibilita || null,
    prescrizioneTermini: input.prescrizioneTermini?.trim() || null,
    documentazioneProve: input.documentazioneProve?.trim() || null,
    contestazioniDebitore: input.contestazioniDebitore?.trim() || null,
    solvibilitaRecupero: input.solvibilitaRecupero?.trim() || null,
    giudiceCompetente: input.giudiceCompetente?.trim() || null,
    foroEventuale: input.foroEventuale?.trim() || null,
    tipoAzioneIpotizzata: input.tipoAzioneIpotizzata || null,
    tipoAzioneAltroDettaglio:
      input.tipoAzioneIpotizzata === "ALTRA_PROCEDURA"
        ? input.tipoAzioneAltroDettaglio?.trim() || null
        : null,
    costiBenefici: input.costiBenefici?.trim() || null,
    rischiLegali: input.rischiLegali?.trim() || null,
    parereValutazione: input.parereValutazione || null,
    parereMotivazione: input.parereMotivazione?.trim() || null,
    valutazioneCompletataAt: completedAt,
    valutazioneById: input.valutazioneById || userId,
  };
}

export async function getPraticaGiudizialeByPraticaId(
  user: SessionUser,
  praticaId: string
): Promise<PraticaGiudizialeRecord | null> {
  try {
    if (isConnectorProvider()) {
      const slug = resolveTenantSlug(user);
      const data = await connectorFetch<{ item: Record<string, unknown> | null }>(
        `/api/v1/tenants/${encodeURIComponent(slug)}/pratiche-giudiziali/by-pratica/${encodeURIComponent(praticaId)}`
      );
      return data.item ? mapRow(data.item) : null;
    }
    if (isNeonProvider()) {
      const rows = await neonQuery(
        `SELECT * FROM "PraticheGiudiziali"
         WHERE "PraticaId" = $1::uuid AND "TenantId" = $2::uuid
         LIMIT 1`,
        [praticaId, user.tenantId]
      );
      return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
    }
    const row = await prisma.praticaGiudiziale.findUnique({ where: { praticaId } });
    return row ? mapRow(row as unknown as Record<string, unknown>) : null;
  } catch (err) {
    console.error("[giudiziale] getPraticaGiudizialeByPraticaId failed", err);
    return null;
  }
}

export async function upsertPraticaGiudiziale(
  user: SessionUser,
  praticaId: string,
  input: PraticaGiudizialeUpsertInput
): Promise<PraticaGiudizialeRecord> {
  if (isConnectorProvider()) {
    const slug = resolveTenantSlug(user);
    const data = await connectorFetch<{ item: Record<string, unknown> }>(
      `/api/v1/tenants/${encodeURIComponent(slug)}/pratiche-giudiziali/upsert`,
      {
        method: "POST",
        body: { praticaId, tenantId: user.tenantId, ...input },
      }
    );
    return mapRow(data.item);
  }

  if (isNeonProvider()) {
    const dataPassaggio = input.dataAffidamentoGiudiziale
      ? new Date(input.dataAffidamentoGiudiziale)
      : null;
    const closedAt = input.closedAt ? new Date(input.closedAt) : null;
    const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
    if (existing) {
      await neonQuery(
        `UPDATE "PraticheGiudiziali" SET
           "StatoAvvio" = $3,
           "DataAffidamentoGiudiziale" = $4,
           "StudioLegale" = $5,
           "AvvocatoReferente" = $6,
           "ReferenteInternoId" = $7::uuid,
           "NoteAffidamento" = $8,
           "MotivoPassaggio" = $9,
           "MotivoAltroDettaglio" = $10,
           "DocumentazioneDisponibile" = $11,
           "PrescrizioneVerificata" = $12,
           "AnagraficaDebitoreVerificata" = $13,
           "ValutazioneRecuperabilita" = $14,
           "NoteVerifica" = $15,
           "MotivazioneArchiviazione" = $16,
           "NoteArchiviazione" = $17,
           "ClosedAt" = $18,
           "UpdatedAt" = NOW()
         WHERE "TenantId" = $1::uuid AND "PraticaId" = $2::uuid`,
        [
          user.tenantId,
          praticaId,
          input.statoAvvio,
          dataPassaggio,
          input.studioLegale?.trim() || null,
          input.avvocatoReferente?.trim() || null,
          input.referenteInternoId || null,
          input.noteAffidamento?.trim() || null,
          input.motivoPassaggio || null,
          input.motivoAltroDettaglio?.trim() || null,
          input.documentazioneDisponibile || null,
          input.prescrizioneVerificata || null,
          input.anagraficaDebitoreVerificata || null,
          input.valutazioneRecuperabilita || null,
          input.noteVerifica?.trim() || null,
          input.motivazioneArchiviazione?.trim() || null,
          input.noteArchiviazione?.trim() || null,
          closedAt,
        ]
      );
    } else {
      await neonQuery(
        `INSERT INTO "PraticheGiudiziali" (
           "Id","TenantId","PraticaId","StatoAvvio","DataAffidamentoGiudiziale",
           "StudioLegale","AvvocatoReferente","ReferenteInternoId","NoteAffidamento",
           "MotivoPassaggio","MotivoAltroDettaglio","DocumentazioneDisponibile",
           "PrescrizioneVerificata","AnagraficaDebitoreVerificata","ValutazioneRecuperabilita",
           "NoteVerifica","MotivazioneArchiviazione","NoteArchiviazione",
           "CreatedById","CreatedAt","UpdatedAt","ClosedAt"
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,$5,
           $6,$7,$8::uuid,$9,
           $10,$11,$12,
           $13,$14,$15,
           $16,$17,$18,
           $19::uuid,NOW(),NOW(),$20
         )`,
        [
          crypto.randomUUID(),
          user.tenantId,
          praticaId,
          input.statoAvvio,
          dataPassaggio,
          input.studioLegale?.trim() || null,
          input.avvocatoReferente?.trim() || null,
          input.referenteInternoId || null,
          input.noteAffidamento?.trim() || null,
          input.motivoPassaggio || null,
          input.motivoAltroDettaglio?.trim() || null,
          input.documentazioneDisponibile || null,
          input.prescrizioneVerificata || null,
          input.anagraficaDebitoreVerificata || null,
          input.valutazioneRecuperabilita || null,
          input.noteVerifica?.trim() || null,
          input.motivazioneArchiviazione?.trim() || null,
          input.noteArchiviazione?.trim() || null,
          input.createdById || user.id,
          closedAt,
        ]
      );
    }
    const row = await getPraticaGiudizialeByPraticaId(user, praticaId);
    if (!row) throw new Error("Upsert giudiziale Neon fallito");
    return row;
  }

  const dataPassaggio = input.dataAffidamentoGiudiziale
    ? new Date(input.dataAffidamentoGiudiziale)
    : null;
  const closedAt = input.closedAt ? new Date(input.closedAt) : null;

  const row = await prisma.praticaGiudiziale.upsert({
    where: { praticaId },
    create: {
      tenantId: user.tenantId,
      praticaId,
      statoAvvio: input.statoAvvio,
      dataAffidamentoGiudiziale: dataPassaggio,
      studioLegale: input.studioLegale?.trim() || null,
      avvocatoReferente: input.avvocatoReferente?.trim() || null,
      referenteInternoId: input.referenteInternoId || null,
      noteAffidamento: input.noteAffidamento?.trim() || null,
      motivoPassaggio: input.motivoPassaggio || null,
      motivoAltroDettaglio: input.motivoAltroDettaglio?.trim() || null,
      documentazioneDisponibile: input.documentazioneDisponibile || null,
      prescrizioneVerificata: input.prescrizioneVerificata || null,
      anagraficaDebitoreVerificata: input.anagraficaDebitoreVerificata || null,
      valutazioneRecuperabilita: input.valutazioneRecuperabilita || null,
      noteVerifica: input.noteVerifica?.trim() || null,
      motivazioneArchiviazione: input.motivazioneArchiviazione?.trim() || null,
      noteArchiviazione: input.noteArchiviazione?.trim() || null,
      createdById: input.createdById || user.id,
      closedAt,
    },
    update: {
      statoAvvio: input.statoAvvio,
      dataAffidamentoGiudiziale: dataPassaggio,
      studioLegale: input.studioLegale?.trim() || null,
      avvocatoReferente: input.avvocatoReferente?.trim() || null,
      referenteInternoId: input.referenteInternoId || null,
      noteAffidamento: input.noteAffidamento?.trim() || null,
      motivoPassaggio: input.motivoPassaggio || null,
      motivoAltroDettaglio: input.motivoAltroDettaglio?.trim() || null,
      documentazioneDisponibile: input.documentazioneDisponibile || null,
      prescrizioneVerificata: input.prescrizioneVerificata || null,
      anagraficaDebitoreVerificata: input.anagraficaDebitoreVerificata || null,
      valutazioneRecuperabilita: input.valutazioneRecuperabilita || null,
      noteVerifica: input.noteVerifica?.trim() || null,
      motivazioneArchiviazione: input.motivazioneArchiviazione?.trim() || null,
      noteArchiviazione: input.noteArchiviazione?.trim() || null,
      closedAt,
    },
  });
  return mapRow(row as unknown as Record<string, unknown>);
}

export async function saveValutazioneLegale(
  user: SessionUser,
  praticaId: string,
  input: ValutazioneLegaleInput
): Promise<PraticaGiudizialeRecord> {
  if (isConnectorProvider()) {
    const slug = resolveTenantSlug(user);
    const data = await connectorFetch<{ item: Record<string, unknown> }>(
      `/api/v1/tenants/${encodeURIComponent(slug)}/pratiche-giudiziali/valutazione`,
      {
        method: "POST",
        body: { praticaId, tenantId: user.tenantId, ...input },
      }
    );
    return mapRow(data.item);
  }

  if (isNeonProvider()) {
    const data = valutazioneData(input, user.id);
    const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
    if (existing) {
      await neonQuery(
        `UPDATE "PraticheGiudiziali" SET
           "StatoAvvio" = $3,
           "TitoloCreditoEsistenza" = $4,
           "TitoloCreditoValidita" = $5,
           "TitoloCreditoEsigibilita" = $6,
           "PrescrizioneTermini" = $7,
           "DocumentazioneProve" = $8,
           "ContestazioniDebitore" = $9,
           "SolvibilitaRecupero" = $10,
           "GiudiceCompetente" = $11,
           "ForoEventuale" = $12,
           "TipoAzioneIpotizzata" = $13,
           "TipoAzioneAltroDettaglio" = $14,
           "CostiBenefici" = $15,
           "RischiLegali" = $16,
           "ParereValutazione" = $17,
           "ParereMotivazione" = $18,
           "ValutazioneCompletataAt" = $19,
           "ValutazioneById" = $20::uuid,
           "UpdatedAt" = NOW()
         WHERE "TenantId" = $1::uuid AND "PraticaId" = $2::uuid`,
        [
          user.tenantId,
          praticaId,
          data.statoAvvio,
          data.titoloCreditoEsistenza,
          data.titoloCreditoValidita,
          data.titoloCreditoEsigibilita,
          data.prescrizioneTermini,
          data.documentazioneProve,
          data.contestazioniDebitore,
          data.solvibilitaRecupero,
          data.giudiceCompetente,
          data.foroEventuale,
          data.tipoAzioneIpotizzata,
          data.tipoAzioneAltroDettaglio,
          data.costiBenefici,
          data.rischiLegali,
          data.parereValutazione,
          data.parereMotivazione,
          data.valutazioneCompletataAt,
          data.valutazioneById,
        ]
      );
    } else {
      await neonQuery(
        `INSERT INTO "PraticheGiudiziali" (
           "Id","TenantId","PraticaId","StatoAvvio",
           "TitoloCreditoEsistenza","TitoloCreditoValidita","TitoloCreditoEsigibilita",
           "PrescrizioneTermini","DocumentazioneProve","ContestazioniDebitore","SolvibilitaRecupero",
           "GiudiceCompetente","ForoEventuale","TipoAzioneIpotizzata","TipoAzioneAltroDettaglio",
           "CostiBenefici","RischiLegali","ParereValutazione","ParereMotivazione",
           "ValutazioneCompletataAt","ValutazioneById","CreatedById","CreatedAt","UpdatedAt"
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,
           $5,$6,$7,
           $8,$9,$10,$11,
           $12,$13,$14,$15,
           $16,$17,$18,$19,
           $20,$21::uuid,$22::uuid,NOW(),NOW()
         )`,
        [
          crypto.randomUUID(),
          user.tenantId,
          praticaId,
          data.statoAvvio,
          data.titoloCreditoEsistenza,
          data.titoloCreditoValidita,
          data.titoloCreditoEsigibilita,
          data.prescrizioneTermini,
          data.documentazioneProve,
          data.contestazioniDebitore,
          data.solvibilitaRecupero,
          data.giudiceCompetente,
          data.foroEventuale,
          data.tipoAzioneIpotizzata,
          data.tipoAzioneAltroDettaglio,
          data.costiBenefici,
          data.rischiLegali,
          data.parereValutazione,
          data.parereMotivazione,
          data.valutazioneCompletataAt,
          data.valutazioneById,
          input.createdById || user.id,
        ]
      );
    }
    const row = await getPraticaGiudizialeByPraticaId(user, praticaId);
    if (!row) throw new Error("Salvataggio valutazione Neon fallito");
    return row;
  }

  const data = valutazioneData(input, user.id);
  const row = await prisma.praticaGiudiziale.upsert({
    where: { praticaId },
    create: {
      tenantId: user.tenantId,
      praticaId,
      createdById: input.createdById || user.id,
      ...data,
    },
    update: data,
  });
  return mapRow(row as unknown as Record<string, unknown>);
}

function strategiaData(input: StrategiaProceduraInput) {
  const speseNorm =
    input.speseGiudizialiJson != null
      ? normalizeSpeseGiudizialiInput(input.speseGiudizialiJson)
      : null;
  return {
    statoAvvio: input.statoAvvio,
    strategiaScelta: input.strategiaScelta || null,
    proceduraDaSeguire: input.proceduraDaSeguire?.trim() || null,
    professionistaIncaricato: input.professionistaIncaricato?.trim() || null,
    attivitaProceduraJson: input.attivitaProceduraJson?.trim() || null,
    agendaScadenze: input.agendaScadenze?.trim() || null,
    documentiDaProdurre: input.documentiDaProdurre?.trim() || null,
    statoProcedura: input.statoProcedura || null,
    eventiStorico: input.eventiStorico?.trim() || null,
    costiSostenuti: speseNorm
      ? costiSostenutiDaTotale(speseNorm.totale)
      : input.costiSostenuti?.trim() || null,
    speseGiudizialiJson: speseNorm ? speseNorm.json : undefined,
    esitoGiudiziale: input.esitoGiudiziale || null,
    dataEsito: input.dataEsito ? new Date(input.dataEsito) : null,
    importoRecuperato:
      input.importoRecuperato != null && Number.isFinite(Number(input.importoRecuperato))
        ? Math.round(Number(input.importoRecuperato) * 100) / 100
        : null,
    noteLegaliOperatori: input.noteLegaliOperatori?.trim() || null,
    strategiaAggiornataAt: input.strategiaAggiornataAt
      ? new Date(input.strategiaAggiornataAt)
      : null,
    esitoRegistratoAt: input.esitoRegistratoAt
      ? new Date(input.esitoRegistratoAt)
      : null,
    closedAt: input.closedAt ? new Date(input.closedAt) : null,
    _totaleSpeseGiudiziali: speseNorm?.totale ?? null,
  };
}

export async function saveStrategiaProcedura(
  user: SessionUser,
  praticaId: string,
  input: StrategiaProceduraInput
): Promise<PraticaGiudizialeRecord> {
  if (isConnectorProvider()) {
    const slug = resolveTenantSlug(user);
    const speseNorm =
      input.speseGiudizialiJson != null
        ? normalizeSpeseGiudizialiInput(input.speseGiudizialiJson)
        : null;
    const body = {
      praticaId,
      tenantId: user.tenantId,
      ...input,
      ...(speseNorm
        ? {
            speseGiudizialiJson: speseNorm.json,
            costiSostenuti: costiSostenutiDaTotale(speseNorm.totale),
            totaleSpeseGiudiziali: speseNorm.totale,
          }
        : {}),
    };
    const data = await connectorFetch<{ item: Record<string, unknown> }>(
      `/api/v1/tenants/${encodeURIComponent(slug)}/pratiche-giudiziali/strategia`,
      {
        method: "POST",
        body,
      }
    );
    return mapRow(data.item);
  }

  const raw = strategiaData(input);
  const { _totaleSpeseGiudiziali, speseGiudizialiJson, ...rest } = raw;
  const data = {
    ...rest,
    ...(speseGiudizialiJson !== undefined
      ? { speseGiudizialiJson }
      : {}),
  };

  if (isNeonProvider()) {
    const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
    if (existing) {
      await neonQuery(
        `UPDATE "PraticheGiudiziali" SET
           "StatoAvvio" = $3,
           "StrategiaScelta" = $4,
           "ProceduraDaSeguire" = $5,
           "ProfessionistaIncaricato" = $6,
           "AttivitaProceduraJson" = $7,
           "AgendaScadenze" = $8,
           "DocumentiDaProdurre" = $9,
           "StatoProcedura" = $10,
           "EventiStorico" = $11,
           "CostiSostenuti" = $12,
           "SpeseGiudizialiJson" = $13,
           "EsitoGiudiziale" = $14,
           "DataEsito" = $15,
           "ImportoRecuperato" = $16,
           "NoteLegaliOperatori" = $17,
           "StrategiaAggiornataAt" = $18,
           "EsitoRegistratoAt" = $19,
           "ClosedAt" = $20,
           "UpdatedAt" = NOW()
         WHERE "TenantId" = $1::uuid AND "PraticaId" = $2::uuid`,
        [
          user.tenantId,
          praticaId,
          data.statoAvvio,
          data.strategiaScelta,
          data.proceduraDaSeguire,
          data.professionistaIncaricato,
          data.attivitaProceduraJson,
          data.agendaScadenze,
          data.documentiDaProdurre,
          data.statoProcedura,
          data.eventiStorico,
          data.costiSostenuti,
          data.speseGiudizialiJson ?? null,
          data.esitoGiudiziale,
          data.dataEsito,
          data.importoRecuperato,
          data.noteLegaliOperatori,
          data.strategiaAggiornataAt,
          data.esitoRegistratoAt,
          data.closedAt,
        ]
      );
    } else {
      await neonQuery(
        `INSERT INTO "PraticheGiudiziali" (
           "Id","TenantId","PraticaId","StatoAvvio",
           "StrategiaScelta","ProceduraDaSeguire","ProfessionistaIncaricato",
           "AttivitaProceduraJson","AgendaScadenze","DocumentiDaProdurre","StatoProcedura",
           "EventiStorico","CostiSostenuti","SpeseGiudizialiJson","EsitoGiudiziale",
           "DataEsito","ImportoRecuperato","NoteLegaliOperatori",
           "StrategiaAggiornataAt","EsitoRegistratoAt","ClosedAt",
           "CreatedById","CreatedAt","UpdatedAt"
         ) VALUES (
           $1::uuid,$2::uuid,$3::uuid,$4,
           $5,$6,$7,
           $8,$9,$10,$11,
           $12,$13,$14,$15,
           $16,$17,$18,
           $19,$20,$21,
           $22::uuid,NOW(),NOW()
         )`,
        [
          crypto.randomUUID(),
          user.tenantId,
          praticaId,
          data.statoAvvio,
          data.strategiaScelta,
          data.proceduraDaSeguire,
          data.professionistaIncaricato,
          data.attivitaProceduraJson,
          data.agendaScadenze,
          data.documentiDaProdurre,
          data.statoProcedura,
          data.eventiStorico,
          data.costiSostenuti,
          data.speseGiudizialiJson ?? null,
          data.esitoGiudiziale,
          data.dataEsito,
          data.importoRecuperato,
          data.noteLegaliOperatori,
          data.strategiaAggiornataAt,
          data.esitoRegistratoAt,
          data.closedAt,
          input.createdById || user.id,
        ]
      );
    }
    if (_totaleSpeseGiudiziali != null) {
      await neonQuery(
        `UPDATE "Pratiche" SET "SpeseGiudiziali" = $3, "UpdatedAt" = NOW()
         WHERE "Id" = $1::uuid AND "TenantId" = $2::uuid`,
        [praticaId, user.tenantId, _totaleSpeseGiudiziali]
      );
    }
    const row = await getPraticaGiudizialeByPraticaId(user, praticaId);
    if (!row) throw new Error("Salvataggio strategia Neon fallito");
    return row;
  }

  const row = await prisma.praticaGiudiziale.upsert({
    where: { praticaId },
    create: {
      tenantId: user.tenantId,
      praticaId,
      createdById: input.createdById || user.id,
      ...data,
    },
    update: data,
  });

  if (_totaleSpeseGiudiziali != null) {
    await prisma.pratica.update({
      where: { id: praticaId },
      data: { speseGiudiziali: _totaleSpeseGiudiziali },
    });
  }

  return mapRow(row as unknown as Record<string, unknown>);
}

export type PraticaGiudizialeListItem = PraticaGiudizialeRecord & {
  praticaNumero: string;
  debitoreNome: string;
  mandanteCodice: string;
  residuo: number;
};

/** Riga elenco Legal (Avvio/Valutazione/Strategia) — stesso destino pratica. */
export type LegalElencoRow = {
  praticaId: string;
  praticaNumero: string;
  debitoreNome: string;
  mandanteCodice: string;
  residuo: number;
  statoAvvio: string | null;
  motivoPassaggio: string | null;
};

export function toLegalElencoRow(item: PraticaGiudizialeListItem): LegalElencoRow {
  return {
    praticaId: item.praticaId,
    praticaNumero: item.praticaNumero,
    debitoreNome: item.debitoreNome,
    mandanteCodice: item.mandanteCodice,
    residuo: item.residuo,
    statoAvvio: item.statoAvvio,
    motivoPassaggio: item.motivoPassaggio,
  };
}

/**
 * Stesse pratiche su cui si può usare «Avvia giudiziale» dalla scheda:
 * non solo-stragiudiziale, con o senza record giudiziale già creato.
 * Destinazione: `/pratiche/{id}/avvio-giudiziale`.
 */
export async function listPratichePerAvvioLegale(
  user: SessionUser
): Promise<LegalElencoRow[]> {
  if (isConnectorProvider()) {
    const slug = resolveTenantSlug(user);
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `/api/v1/tenants/${encodeURIComponent(slug)}/pratiche-giudiziali/per-avvio`,
      { method: "POST", body: { tenantId: user.tenantId } }
    );
    return (data.items || []).map((row) => {
      const m = mapSqlRow(row) as Record<string, unknown>;
      return {
        praticaId: String(m.praticaId || m.id || ""),
        praticaNumero: String(m.praticaNumero || m.numero || "—"),
        debitoreNome: String(m.debitoreNome || "—"),
        mandanteCodice: String(m.mandanteCodice || "—"),
        residuo: Number(m.residuo || 0),
        statoAvvio: m.statoAvvio != null ? String(m.statoAvvio) : null,
        motivoPassaggio:
          m.motivoPassaggio != null ? String(m.motivoPassaggio) : null,
      };
    });
  }

  if (isNeonProvider()) {
    const rows = await neonQuery(
      `SELECT
         p."Id" AS "PraticaId",
         p."Numero" AS "PraticaNumero",
         p."Residuo" AS "Residuo",
         TRIM(CONCAT(COALESCE(d."Cognome", ''), ' ', COALESCE(d."Nome", ''))) AS "DebitoreNome",
         m."Codice" AS "MandanteCodice",
         g."StatoAvvio" AS "StatoAvvio",
         g."MotivoPassaggio" AS "MotivoPassaggio",
         p."ConferimentoTipo" AS "ConferimentoTipo"
       FROM "Pratiche" p
       INNER JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       INNER JOIN "Mandanti" m ON m."Id" = p."MandanteId"
       LEFT JOIN "PraticheGiudiziali" g ON g."PraticaId" = p."Id"
       WHERE p."TenantId" = $1::uuid
         AND (
           p."ConferimentoTipo" IS NULL
           OR TRIM(p."ConferimentoTipo") = ''
           OR UPPER(TRIM(p."ConferimentoTipo")) <> 'STRAGIUDIZIALE'
         )
       ORDER BY p."UpdatedAt" DESC
       LIMIT 300`,
      [user.tenantId]
    );
    const { isGiudizialePrevistoSulLotto } = await import("@/lib/conferimentoLegale");
    return rows
      .filter((r) =>
        isGiudizialePrevistoSulLotto(
          (r as { ConferimentoTipo?: string }).ConferimentoTipo
        )
      )
      .slice(0, 200)
      .map((r) => {
        const row = r as Record<string, unknown>;
        return {
          praticaId: String(row.PraticaId),
          praticaNumero: String(row.PraticaNumero || "—"),
          debitoreNome: String(row.DebitoreNome || "—").trim() || "—",
          mandanteCodice: String(row.MandanteCodice || "—"),
          residuo: Number(row.Residuo || 0),
          statoAvvio: row.StatoAvvio != null ? String(row.StatoAvvio) : null,
          motivoPassaggio:
            row.MotivoPassaggio != null ? String(row.MotivoPassaggio) : null,
        };
      });
  }

  const { praticaScopeWhere } = await import("@/lib/gruppoPerimetroScope");
  const { isGiudizialePrevistoSulLotto } = await import(
    "@/lib/conferimentoLegale"
  );
  const scope = await praticaScopeWhere(user);

  const rows = await prisma.pratica.findMany({
    where: scope,
    select: {
      id: true,
      numero: true,
      residuo: true,
      conferimentoTipo: true,
      updatedAt: true,
      debitore: { select: { nome: true, cognome: true } },
      mandante: { select: { codice: true } },
      giudiziale: {
        select: { statoAvvio: true, motivoPassaggio: true, updatedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  return rows
    .filter((p) => isGiudizialePrevistoSulLotto(p.conferimentoTipo))
    .slice(0, 200)
    .map((p) => ({
      praticaId: p.id,
      praticaNumero: p.numero,
      debitoreNome: `${p.debitore.cognome} ${p.debitore.nome}`.trim() || "—",
      mandanteCodice: p.mandante.codice,
      residuo: p.residuo || 0,
      statoAvvio: p.giudiziale?.statoAvvio ?? null,
      motivoPassaggio: p.giudiziale?.motivoPassaggio ?? null,
    }));
}

export async function listPraticheGiudiziali(
  user: SessionUser,
  opts?: { stati?: string[] }
): Promise<PraticaGiudizialeListItem[]> {
  const stati = opts?.stati?.filter(Boolean);

  if (isConnectorProvider()) {
    const slug = resolveTenantSlug(user);
    const qs =
      stati && stati.length
        ? `?stati=${encodeURIComponent(stati.join(","))}`
        : "";
    const data = await connectorFetch<{ items: Record<string, unknown>[] }>(
      `/api/v1/tenants/${encodeURIComponent(slug)}/pratiche-giudiziali${qs}`
    );
    return (data.items || []).map((row) => {
      const base = mapRow(row);
      const m = mapSqlRow(row) as Record<string, unknown>;
      return {
        ...base,
        praticaNumero: String(m.praticaNumero || m.numero || "—"),
        debitoreNome: String(m.debitoreNome || "—"),
        mandanteCodice: String(m.mandanteCodice || "—"),
        residuo: Number(m.residuo || 0),
      };
    });
  }

  if (isNeonProvider()) {
    const params: unknown[] = [user.tenantId];
    let statoSql = "";
    if (stati?.length) {
      params.push(stati);
      statoSql = ` AND g."StatoAvvio" = ANY($${params.length}::text[])`;
    }
    const rows = await neonQuery(
      `SELECT
         g.*,
         p."Numero" AS "PraticaNumero",
         p."Residuo" AS "Residuo",
         TRIM(CONCAT(COALESCE(d."Cognome", ''), ' ', COALESCE(d."Nome", ''))) AS "DebitoreNome",
         m."Codice" AS "MandanteCodice"
       FROM "PraticheGiudiziali" g
       INNER JOIN "Pratiche" p ON p."Id" = g."PraticaId"
       INNER JOIN "Debitori" d ON d."Id" = p."DebitoreId"
       INNER JOIN "Mandanti" m ON m."Id" = p."MandanteId"
       WHERE g."TenantId" = $1::uuid
       ${statoSql}
       ORDER BY g."UpdatedAt" DESC
       LIMIT 200`,
      params
    );
    return rows.map((row) => {
      const raw = row as Record<string, unknown>;
      const base = mapRow(raw);
      return {
        ...base,
        praticaNumero: String(raw.PraticaNumero || "—"),
        debitoreNome: String(raw.DebitoreNome || "—").trim() || "—",
        mandanteCodice: String(raw.MandanteCodice || "—"),
        residuo: Number(raw.Residuo || 0),
      };
    });
  }

  const rows = await prisma.praticaGiudiziale.findMany({
    where: {
      tenantId: user.tenantId,
      ...(stati?.length ? { statoAvvio: { in: stati } } : {}),
    },
    include: {
      pratica: {
        select: {
          numero: true,
          residuo: true,
          debitore: { select: { nome: true, cognome: true } },
          mandante: { select: { codice: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return rows.map((row) => {
    const base = mapRow(row as unknown as Record<string, unknown>);
    const deb = row.pratica.debitore;
    return {
      ...base,
      praticaNumero: row.pratica.numero,
      debitoreNome: `${deb.cognome} ${deb.nome}`.trim() || "—",
      mandanteCodice: row.pratica.mandante.codice,
      residuo: row.pratica.residuo || 0,
    };
  });
}
