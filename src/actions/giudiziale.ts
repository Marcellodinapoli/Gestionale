"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/guard";
import { canAccessPratica, writeAudit } from "@/lib/domain";
import { attivitaDbFromUser } from "@/lib/attivitaRepo";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import {
  getPraticaGiudizialeByPraticaId,
  saveStrategiaProcedura,
  saveValutazioneLegale,
  upsertPraticaGiudiziale,
} from "@/lib/giudiziale/praticaGiudizialeRepo";
import {
  isStatoAvvioChiuso,
  labelMotivo,
  labelStatoAvvio,
  MOTIVI_PASSAGGIO_GIUDIZIALE,
  statoFromAzione,
  type AzioneAvvioGiudiziale,
} from "@/lib/giudiziale/avvioGiudiziale";
import {
  isGiudizialePrevistoSulLotto,
} from "@/lib/conferimentoLegale";
import {
  labelParere,
  labelTipoAzione,
  PARERI_VALUTAZIONE,
  TIPI_AZIONE_IPOTIZZATA,
} from "@/lib/giudiziale/valutazioneLegale";
import {
  ESITI_GIUDIZIALI,
  STATI_PROCEDURA,
  STRATEGIE_SCELTE,
  labelEsitoGiudiziale,
  labelStrategiaScelta,
} from "@/lib/giudiziale/strategiaGiudiziale";

export type AvvioGiudizialeFormPayload = {
  praticaId: string;
  dataAffidamentoGiudiziale?: string | null;
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
  /** Obbligatoria solo per ARCHIVIA_SENZA_AZIONE */
  motivazioneArchiviazione?: string | null;
  noteArchiviazione?: string | null;
  azione: AzioneAvvioGiudiziale;
};

function validatePayload(input: AvvioGiudizialeFormPayload): string | null {
  if (!input.motivoPassaggio) return "Seleziona il motivo del passaggio al giudiziale";
  const motivoOk = MOTIVI_PASSAGGIO_GIUDIZIALE.some((m) => m.value === input.motivoPassaggio);
  if (!motivoOk) return "Motivo non valido";
  if (input.motivoPassaggio === "ALTRO" && !input.motivoAltroDettaglio?.trim()) {
    return "Descrivi il motivo (campo obbligatorio se scegli Altro)";
  }
  if (!input.dataAffidamentoGiudiziale?.trim()) {
    return "Indica la data di affidamento giudiziale";
  }
  if (input.azione === "ARCHIVIA_SENZA_AZIONE") {
    if (!input.motivazioneArchiviazione?.trim()) {
      return "Indica la motivazione dell'archiviazione";
    }
  }
  return null;
}

function notaStorico(
  azione: AzioneAvvioGiudiziale,
  motivo: string,
  motivoAltro: string | null | undefined,
  motivazioneArchiviazione?: string | null,
  noteArchiviazione?: string | null
) {
  const motivoLabel =
    motivo === "ALTRO" && motivoAltro?.trim()
      ? `Altro: ${motivoAltro.trim()}`
      : labelMotivo(motivo);
  switch (azione) {
    case "ARCHIVIA_SENZA_AZIONE": {
      const motiv = motivazioneArchiviazione?.trim() || "—";
      const note = noteArchiviazione?.trim();
      return (
        `GIUDIZIALE · Archiviata senza azione giudiziale. ` +
        `Motivo passaggio: ${motivoLabel}. Motivazione archiviazione: ${motiv}.` +
        (note ? ` Note: ${note}` : "")
      );
    }
    case "RICHIEDI_VALUTAZIONE":
      return (
        `GIUDIZIALE · Richiesta valutazione legale (stato: In attesa di valutazione legale). ` +
        `Motivo passaggio: ${motivoLabel}.`
      );
    case "AVVIA_PROCEDURA":
      return (
        `GIUDIZIALE · Giudiziale avviato – procedura da definire. ` +
        `Motivo passaggio: ${motivoLabel}.`
      );
  }
}

function redirectForAzione(azione: AzioneAvvioGiudiziale, praticaId: string): string {
  switch (azione) {
    case "ARCHIVIA_SENZA_AZIONE":
      return `/pratiche/${praticaId}`;
    case "RICHIEDI_VALUTAZIONE":
      return `/pratiche/${praticaId}/valutazione-legale`;
    case "AVVIA_PROCEDURA":
      return `/pratiche/${praticaId}/strategia-giudiziale`;
  }
}

export async function confermaAvvioGiudizialeAction(
  input: AvvioGiudizialeFormPayload
): Promise<{ ok?: string; error?: string; redirectTo?: string }> {
  const user = await requirePermission("legal:view");
  const praticaId = String(input.praticaId || "").trim();
  if (!praticaId) return { error: "Pratica non valida" };
  if (!(await canAccessPratica(user, praticaId))) {
    return { error: "Pratica non accessibile" };
  }

  const praticaLotto = await praticaDbFromUser(user).findUnique({
    where: { id: praticaId },
    select: { conferimentoTipo: true },
  });
  if (!isGiudizialePrevistoSulLotto(praticaLotto?.conferimentoTipo)) {
    return {
      error:
        "Gestione giudiziale non prevista sul lotto (conferimento solo stragiudiziale o non impostato)",
    };
  }

  const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
  if (existing && isStatoAvvioChiuso(existing.statoAvvio)) {
    return {
      error: `Avvio già registrato (${labelStatoAvvio(existing.statoAvvio)}).`,
    };
  }

  const validationError = validatePayload(input);
  if (validationError) return { error: validationError };

  const statoAvvio = statoFromAzione(input.azione);
  const now = new Date();
  const isArchivia = input.azione === "ARCHIVIA_SENZA_AZIONE";

  await upsertPraticaGiudiziale(user, praticaId, {
    statoAvvio,
    dataAffidamentoGiudiziale: input.dataAffidamentoGiudiziale,
    studioLegale: input.studioLegale,
    avvocatoReferente: input.avvocatoReferente,
    referenteInternoId: input.referenteInternoId || null,
    noteAffidamento: input.noteAffidamento,
    motivoPassaggio: input.motivoPassaggio,
    motivoAltroDettaglio:
      input.motivoPassaggio === "ALTRO" ? input.motivoAltroDettaglio : null,
    documentazioneDisponibile: input.documentazioneDisponibile,
    prescrizioneVerificata: input.prescrizioneVerificata,
    anagraficaDebitoreVerificata: input.anagraficaDebitoreVerificata,
    valutazioneRecuperabilita: input.valutazioneRecuperabilita,
    noteVerifica: input.noteVerifica,
    motivazioneArchiviazione: isArchivia ? input.motivazioneArchiviazione : null,
    noteArchiviazione: isArchivia ? input.noteArchiviazione : null,
    createdById: user.id,
    closedAt: now,
  });

  const nota = notaStorico(
    input.azione,
    input.motivoPassaggio!,
    input.motivoAltroDettaglio,
    input.motivazioneArchiviazione,
    input.noteArchiviazione
  );

  await attivitaDbFromUser(user).create({
    data: {
      praticaId,
      userId: user.id,
      tipo: "GIUDIZIALE",
      nota,
    },
  });

  await praticaDbFromUser(user).update({
    where: { id: praticaId },
    data: { updatedAt: now, ultimaLavorazioneAt: now },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    action: "avvio_giudiziale",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${statoAvvio} · ${user.name || user.id} · ${nota}`,
  });

  const redirectTo = redirectForAzione(input.azione, praticaId);

  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/avvio-giudiziale`);
  revalidatePath(redirectTo);
  revalidatePath("/legal");
  revalidatePath("/legal/avvio");
  revalidatePath("/legal/valutazione");
  revalidatePath("/legal/strategia");

  let ok = "Operazione registrata";
  if (input.azione === "ARCHIVIA_SENZA_AZIONE") {
    ok = "Fase giudiziale archiviata senza azione (pratica consultabile)";
  } else if (input.azione === "RICHIEDI_VALUTAZIONE") {
    ok = "Richiesta valutazione legale registrata";
  } else if (input.azione === "AVVIA_PROCEDURA") {
    ok = "Fase giudiziale avviata – procedura da definire";
  }

  return { ok, redirectTo };
}

export type ValutazioneLegaleFormPayload = {
  praticaId: string;
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
};

export async function definisciStrategiaAction(
  input: ValutazioneLegaleFormPayload
): Promise<{ ok?: string; error?: string; redirectTo?: string }> {
  const user = await requirePermission("legal:view");
  const praticaId = String(input.praticaId || "").trim();
  if (!praticaId) return { error: "Pratica non valida" };
  if (!(await canAccessPratica(user, praticaId))) {
    return { error: "Pratica non accessibile" };
  }

  const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
  if (existing?.statoAvvio === "ARCHIVIATA_SENZA_AZIONE") {
    return { error: "Fase giudiziale archiviata senza azione: valutazione non disponibile" };
  }

  if (!input.parereValutazione) return { error: "Seleziona il parere" };
  if (!PARERI_VALUTAZIONE.some((p) => p.value === input.parereValutazione)) {
    return { error: "Parere non valido" };
  }
  if (!input.parereMotivazione?.trim()) {
    return { error: "Indica la motivazione del parere" };
  }
  if (!input.tipoAzioneIpotizzata) {
    return { error: "Seleziona il tipo di azione ipotizzata" };
  }
  if (!TIPI_AZIONE_IPOTIZZATA.some((t) => t.value === input.tipoAzioneIpotizzata)) {
    return { error: "Tipo di azione non valido" };
  }
  if (
    input.tipoAzioneIpotizzata === "ALTRA_PROCEDURA" &&
    !input.tipoAzioneAltroDettaglio?.trim()
  ) {
    return { error: "Descrivi l'altra procedura" };
  }

  const now = new Date();
  await saveValutazioneLegale(user, praticaId, {
    statoAvvio: "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
    titoloCreditoEsistenza: input.titoloCreditoEsistenza,
    titoloCreditoValidita: input.titoloCreditoValidita,
    titoloCreditoEsigibilita: input.titoloCreditoEsigibilita,
    prescrizioneTermini: input.prescrizioneTermini,
    documentazioneProve: input.documentazioneProve,
    contestazioniDebitore: input.contestazioniDebitore,
    solvibilitaRecupero: input.solvibilitaRecupero,
    giudiceCompetente: input.giudiceCompetente,
    foroEventuale: input.foroEventuale,
    tipoAzioneIpotizzata: input.tipoAzioneIpotizzata,
    tipoAzioneAltroDettaglio: input.tipoAzioneAltroDettaglio,
    costiBenefici: input.costiBenefici,
    rischiLegali: input.rischiLegali,
    parereValutazione: input.parereValutazione,
    parereMotivazione: input.parereMotivazione,
    valutazioneCompletataAt: now,
    valutazioneById: user.id,
    createdById: user.id,
  });

  const nota =
    `GIUDIZIALE · Valutazione legale completata. ` +
    `Parere: ${labelParere(input.parereValutazione)}. ` +
    `Azione ipotizzata: ${labelTipoAzione(input.tipoAzioneIpotizzata)}. ` +
    `Motivazione: ${input.parereMotivazione.trim()}`;

  await attivitaDbFromUser(user).create({
    data: {
      praticaId,
      userId: user.id,
      tipo: "GIUDIZIALE",
      nota,
    },
  });

  await praticaDbFromUser(user).update({
    where: { id: praticaId },
    data: { updatedAt: now, ultimaLavorazioneAt: now },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    action: "valutazione_legale",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${user.name || user.id} · ${nota}`,
  });

  const redirectTo = `/pratiche/${praticaId}/strategia-giudiziale`;
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/valutazione-legale`);
  revalidatePath(redirectTo);
  revalidatePath("/legal");
  revalidatePath("/legal/valutazione");
  revalidatePath("/legal/strategia");

  return { ok: "Valutazione salvata: definisci la strategia", redirectTo };
}

export type StrategiaProceduraFormPayload = {
  praticaId: string;
  strategiaScelta?: string | null;
  proceduraDaSeguire?: string | null;
  professionistaIncaricato?: string | null;
  attivitaProceduraJson?: string | null;
  agendaScadenze?: string | null;
  documentiDaProdurre?: string | null;
  statoProcedura?: string | null;
  eventiStorico?: string | null;
  costiSostenuti?: string | null;
  esitoGiudiziale?: string | null;
  noteLegaliOperatori?: string | null;
};

function assertStrategiaAccessibile(statoAvvio?: string | null) {
  if (!statoAvvio) return "Avvia prima la fase giudiziale e completa la valutazione";
  if (statoAvvio === "ARCHIVIATA_SENZA_AZIONE") {
    return "Fase giudiziale archiviata senza azione";
  }
  if (
    statoAvvio !== "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE" &&
    statoAvvio !== "IN_PROCEDURA" &&
    statoAvvio !== "CONCLUSA_CON_ESITO" &&
    statoAvvio !== "PROCEDURA_AVVIATA"
  ) {
    return "Completa prima la valutazione legale";
  }
  return null;
}

export async function salvaStrategiaProceduraAction(
  input: StrategiaProceduraFormPayload
): Promise<{ ok?: string; error?: string }> {
  const user = await requirePermission("legal:view");
  const praticaId = String(input.praticaId || "").trim();
  if (!praticaId) return { error: "Pratica non valida" };
  if (!(await canAccessPratica(user, praticaId))) {
    return { error: "Pratica non accessibile" };
  }

  const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
  const accessErr = assertStrategiaAccessibile(existing?.statoAvvio);
  if (accessErr) return { error: accessErr };
  if (existing?.statoAvvio === "CONCLUSA_CON_ESITO") {
    return { error: "Procedura già conclusa con esito: non modificabile" };
  }

  if (!input.strategiaScelta) return { error: "Seleziona la strategia" };
  if (!STRATEGIE_SCELTE.some((s) => s.value === input.strategiaScelta)) {
    return { error: "Strategia non valida" };
  }
  if (!input.proceduraDaSeguire?.trim()) {
    return { error: "Indica la procedura da seguire" };
  }
  if (!input.professionistaIncaricato?.trim()) {
    return { error: "Indica il professionista incaricato" };
  }
  if (
    input.statoProcedura &&
    !STATI_PROCEDURA.some((s) => s.value === input.statoProcedura)
  ) {
    return { error: "Stato procedura non valido" };
  }

  const now = new Date();
  await saveStrategiaProcedura(user, praticaId, {
    statoAvvio: "IN_PROCEDURA",
    strategiaScelta: input.strategiaScelta,
    proceduraDaSeguire: input.proceduraDaSeguire,
    professionistaIncaricato: input.professionistaIncaricato,
    attivitaProceduraJson: input.attivitaProceduraJson,
    agendaScadenze: input.agendaScadenze,
    documentiDaProdurre: input.documentiDaProdurre,
    statoProcedura: input.statoProcedura || "IN_CORSO",
    eventiStorico: input.eventiStorico,
    costiSostenuti: input.costiSostenuti,
    esitoGiudiziale: input.esitoGiudiziale || null,
    noteLegaliOperatori: input.noteLegaliOperatori,
    strategiaAggiornataAt: now,
    createdById: user.id,
  });

  const nota =
    `GIUDIZIALE · Strategia/procedura aggiornata. ` +
    `Strategia: ${labelStrategiaScelta(input.strategiaScelta)}. ` +
    `Professionista: ${input.professionistaIncaricato.trim()}.`;

  await attivitaDbFromUser(user).create({
    data: {
      praticaId,
      userId: user.id,
      tipo: "GIUDIZIALE",
      nota,
    },
  });

  await praticaDbFromUser(user).update({
    where: { id: praticaId },
    data: { updatedAt: now, ultimaLavorazioneAt: now },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    action: "strategia_giudiziale",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${user.name || user.id} · ${nota}`,
  });

  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/strategia-giudiziale`);
  revalidatePath("/agenda");
  revalidatePath("/legal");
  revalidatePath("/legal/avvio");
  revalidatePath("/legal/strategia");

  return { ok: "Strategia / procedura salvata" };
}

export async function registraEsitoGiudizialeAction(
  input: StrategiaProceduraFormPayload
): Promise<{ ok?: string; error?: string; redirectTo?: string }> {
  const user = await requirePermission("legal:view");
  const praticaId = String(input.praticaId || "").trim();
  if (!praticaId) return { error: "Pratica non valida" };
  if (!(await canAccessPratica(user, praticaId))) {
    return { error: "Pratica non accessibile" };
  }

  const existing = await getPraticaGiudizialeByPraticaId(user, praticaId);
  const accessErr = assertStrategiaAccessibile(existing?.statoAvvio);
  if (accessErr) return { error: accessErr };
  if (existing?.statoAvvio === "CONCLUSA_CON_ESITO") {
    return { error: "Esito già registrato" };
  }

  if (!input.strategiaScelta) return { error: "Seleziona la strategia" };
  if (!STRATEGIE_SCELTE.some((s) => s.value === input.strategiaScelta)) {
    return { error: "Strategia non valida" };
  }
  if (!input.esitoGiudiziale) return { error: "Seleziona l'esito" };
  if (!ESITI_GIUDIZIALI.some((e) => e.value === input.esitoGiudiziale)) {
    return { error: "Esito non valido" };
  }

  const now = new Date();
  await saveStrategiaProcedura(user, praticaId, {
    statoAvvio: "CONCLUSA_CON_ESITO",
    strategiaScelta: input.strategiaScelta,
    proceduraDaSeguire: input.proceduraDaSeguire,
    professionistaIncaricato: input.professionistaIncaricato,
    attivitaProceduraJson: input.attivitaProceduraJson,
    agendaScadenze: input.agendaScadenze,
    documentiDaProdurre: input.documentiDaProdurre,
    statoProcedura: "CONCLUSA",
    eventiStorico: input.eventiStorico,
    costiSostenuti: input.costiSostenuti,
    esitoGiudiziale: input.esitoGiudiziale,
    noteLegaliOperatori: input.noteLegaliOperatori,
    strategiaAggiornataAt: now,
    esitoRegistratoAt: now,
    closedAt: now,
    createdById: user.id,
  });

  const nota =
    `GIUDIZIALE · Esito registrato: ${labelEsitoGiudiziale(input.esitoGiudiziale)}. ` +
    `Strategia: ${labelStrategiaScelta(input.strategiaScelta)}.`;

  await attivitaDbFromUser(user).create({
    data: {
      praticaId,
      userId: user.id,
      tipo: "GIUDIZIALE",
      nota,
    },
  });

  await praticaDbFromUser(user).update({
    where: { id: praticaId },
    data: { updatedAt: now, ultimaLavorazioneAt: now },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    action: "esito_giudiziale",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${user.name || user.id} · ${nota}`,
  });

  const redirectTo = `/pratiche/${praticaId}`;
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/strategia-giudiziale`);
  revalidatePath("/agenda");
  revalidatePath("/legal");
  revalidatePath("/legal/strategia");

  return { ok: "Esito registrato: procedura conclusa", redirectTo };
}
