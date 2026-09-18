"use server";

import { revalidatePath } from "next/cache";
import { requireWritablePermission } from "@/lib/guard";
import { validaOffertaLavoroInput } from "@/lib/recruiting/offerte";
import {
  chiudiOffertaLavoro,
  createOffertaLavoro,
  updateOffertaLavoro,
} from "@/lib/recruiting/offerteRepo";
import { validaReceiverConfigInput } from "@/lib/recruiting/receiver";
import {
  deleteReceiverConfig,
  probeReceiverConfig,
  upsertReceiverConfig,
} from "@/lib/recruiting/receiverRepo";
import {
  assertTransizioneCandidatura,
  parseStatoCandidatura,
  validaCandidaturaInput,
} from "@/lib/recruiting/candidature";
import {
  createCandidatura,
  getCandidatura,
  updateCandidaturaStato,
} from "@/lib/recruiting/candidatureRepo";
import {
  validaContattoInput,
  validaNotaInput,
  validaProvaInput,
  hasContattoRegistrato,
} from "@/lib/recruiting/attivita";
import {
  createContattoAttivita,
  createNotaAttivita,
  createProvaProgrammata,
  listAttivitaByCandidatura,
  updateContattoAttivita,
} from "@/lib/recruiting/attivitaRepo";
import {
  validaColloquioCreateInput,
  validaEsitoColloquioInput,
  validaSvolgimentoInput,
} from "@/lib/recruiting/colloqui";
import {
  annullaColloquio,
  chiudiColloquio,
  createColloquio,
  svolgiColloquio,
} from "@/lib/recruiting/colloquiRepo";

function revalidateRecruiting(offertaId?: string) {
  revalidatePath("/recruiting");
  if (offertaId) {
    revalidatePath(`/recruiting/offerte/${offertaId}`);
  }
}

export async function creaOffertaLavoroAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaOffertaLavoroInput({
    titolo: String(formData.get("titolo") || ""),
    luogo: String(formData.get("luogo") || ""),
    modalitaLavoro: String(formData.get("modalitaLavoro") || ""),
    tipoContratto: String(formData.get("tipoContratto") || ""),
    orario: String(formData.get("orario") || ""),
    numeroPosizioni: String(formData.get("numeroPosizioni") || "1"),
    descrizione: String(formData.get("descrizione") || ""),
    attivitaPrincipali: String(formData.get("attivitaPrincipali") || ""),
    requisiti: String(formData.get("requisiti") || ""),
    competenze: String(formData.get("competenze") || ""),
    retribuzione: String(formData.get("retribuzione") || ""),
    benefit: String(formData.get("benefit") || ""),
    stato: String(formData.get("stato") || "BOZZA"),
  });
  await createOffertaLavoro(user.tenantId, input);
  revalidateRecruiting();
}

export async function aggiornaOffertaLavoroAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Offerta non indicata");
  const input = validaOffertaLavoroInput({
    titolo: String(formData.get("titolo") || ""),
    luogo: String(formData.get("luogo") || ""),
    modalitaLavoro: String(formData.get("modalitaLavoro") || ""),
    tipoContratto: String(formData.get("tipoContratto") || ""),
    orario: String(formData.get("orario") || ""),
    numeroPosizioni: String(formData.get("numeroPosizioni") || "1"),
    descrizione: String(formData.get("descrizione") || ""),
    attivitaPrincipali: String(formData.get("attivitaPrincipali") || ""),
    requisiti: String(formData.get("requisiti") || ""),
    competenze: String(formData.get("competenze") || ""),
    retribuzione: String(formData.get("retribuzione") || ""),
    benefit: String(formData.get("benefit") || ""),
    stato: String(formData.get("stato") || "BOZZA"),
  });
  await updateOffertaLavoro(user.tenantId, id, input);
  revalidateRecruiting();
}

export async function chiudiOffertaLavoroAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Offerta non indicata");
  await chiudiOffertaLavoro(user.tenantId, id);
  revalidateRecruiting();
}

export async function salvaReceiverConfigAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaReceiverConfigInput({
    baseUrl: String(formData.get("baseUrl") || ""),
    sourceName: String(formData.get("sourceName") || ""),
  });
  await upsertReceiverConfig(user.tenantId, input);
  revalidateRecruiting();
}

export async function eliminaReceiverConfigAction() {
  const user = await requireWritablePermission("recruiting:manage");
  await deleteReceiverConfig(user.tenantId);
  revalidateRecruiting();
}

export async function verificaReceiverConfigAction() {
  const user = await requireWritablePermission("recruiting:manage");
  const updated = await probeReceiverConfig(user.tenantId);
  revalidateRecruiting();
  if (updated.status === "ERROR") {
    throw new Error("Ricevitore non raggiungibile");
  }
}

export async function creaCandidaturaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaCandidaturaInput({
    offertaId: String(formData.get("offertaId") || ""),
    cognome: String(formData.get("cognome") || ""),
    nome: String(formData.get("nome") || ""),
    source: String(formData.get("source") || ""),
  });
  const created = await createCandidatura(user.tenantId, input, user.id);
  revalidateRecruiting(created.offertaId);
  revalidatePath(`/recruiting/offerte/${created.offertaId}/${created.id}`);
}

export async function aggiornaStatoCandidaturaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Candidatura non indicata");
  const current = await getCandidatura(user.tenantId, id);
  if (!current) throw new Error("Candidatura non trovata");
  const stato = parseStatoCandidatura(String(formData.get("stato") || ""));
  assertTransizioneCandidatura(current.stato, stato);
  if (stato === "COLLOQUIO") {
    throw new Error("Per passare a Colloquio è obbligatorio programmare il colloquio con data e ora");
  }
  if (stato === "PROVA") {
    throw new Error("Per passare a Prova è obbligatorio programmare la prova con data e ora");
  }
  if (current.stato === "RICEVUTA" && stato === "IN_VALUTAZIONE") {
    const attivita = await listAttivitaByCandidatura(user.tenantId, current.id);
    if (!hasContattoRegistrato(attivita)) {
      throw new Error("Nella fase Ricevuta è obbligatorio registrare un contatto");
    }
  }
  const updated = await updateCandidaturaStato(user.tenantId, id, stato, user.id);
  revalidateRecruiting(updated.offertaId);
  revalidatePath(`/recruiting/offerte/${updated.offertaId}/${updated.id}`);
}

function revalidateCandidatura(offertaId: string, candidaturaId: string) {
  revalidateRecruiting(offertaId);
  revalidatePath(`/recruiting/offerte/${offertaId}/${candidaturaId}`);
}

export async function registraContattoCandidaturaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaContattoInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    canale: String(formData.get("canale") || ""),
    esito: String(formData.get("esito") || ""),
    occurredAt: String(formData.get("occurredAt") || ""),
    note: String(formData.get("note") || ""),
  });
  const candidatura = await getCandidatura(user.tenantId, input.candidaturaId);
  if (!candidatura) throw new Error("Candidatura non trovata");
  await createContattoAttivita(user.tenantId, user.id, input);
  revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function modificaContattoCandidaturaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Contatto non indicato");
  const input = validaContattoInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    canale: String(formData.get("canale") || ""),
    esito: String(formData.get("esito") || ""),
    occurredAt: String(formData.get("occurredAt") || ""),
    note: String(formData.get("note") || ""),
  });
  const candidatura = await getCandidatura(user.tenantId, input.candidaturaId);
  if (!candidatura) throw new Error("Candidatura non trovata");
  await updateContattoAttivita(user.tenantId, user.id, { id, ...input });
  revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function aggiungiNotaCandidaturaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaNotaInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    occurredAt: String(formData.get("occurredAt") || ""),
    note: String(formData.get("note") || ""),
  });
  const candidatura = await getCandidatura(user.tenantId, input.candidaturaId);
  if (!candidatura) throw new Error("Candidatura non trovata");
  await createNotaAttivita(user.tenantId, user.id, input);
  revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function creaColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaColloquioCreateInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    scheduledAt: String(formData.get("scheduledAt") || ""),
    modalita: String(formData.get("modalita") || ""),
    intervistatoreUserId: String(formData.get("intervistatoreUserId") || ""),
    intervistatoreLabel: String(formData.get("intervistatoreLabel") || ""),
    notePreliminari: String(formData.get("notePreliminari") || ""),
  });
  const created = await createColloquio(user.tenantId, user.id, input);
  const candidatura = await getCandidatura(user.tenantId, created.candidaturaId);
  if (candidatura?.stato === "IN_VALUTAZIONE") {
    await updateCandidaturaStato(user.tenantId, candidatura.id, "COLLOQUIO", user.id);
  }
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function creaProvaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaProvaInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    scheduledAt: String(formData.get("scheduledAt") || ""),
    note: String(formData.get("note") || ""),
  });
  const candidatura = await getCandidatura(user.tenantId, input.candidaturaId);
  if (!candidatura) throw new Error("Candidatura non trovata");
  await createProvaProgrammata(user.tenantId, user.id, input);
  await updateCandidaturaStato(user.tenantId, candidatura.id, "PROVA", user.id);
  revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function svolgiColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaSvolgimentoInput({
    id: String(formData.get("id") || ""),
    noteSvolgimento: String(formData.get("noteSvolgimento") || ""),
  });
  const updated = await svolgiColloquio(user.tenantId, user.id, input);
  const candidatura = await getCandidatura(user.tenantId, updated.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function chiudiColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaEsitoColloquioInput({
    id: String(formData.get("id") || ""),
    esito: String(formData.get("esito") || ""),
    valutazione: String(formData.get("valutazione") || ""),
  });
  const updated = await chiudiColloquio(user.tenantId, user.id, input);
  const candidatura = await getCandidatura(user.tenantId, updated.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function annullaColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Colloquio non indicato");
  const updated = await annullaColloquio(user.tenantId, user.id, id);
  const candidatura = await getCandidatura(user.tenantId, updated.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}
