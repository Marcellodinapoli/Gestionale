"use server";

import { revalidatePath } from "next/cache";
import { assertRecruitingAccess, requireWritablePermission } from "@/lib/guard";
import { validaOffertaLavoroInput } from "@/lib/recruiting/offerte";
import {
  chiudiOffertaLavoro,
  createOffertaLavoro,
  deleteOffertaLavoro,
  ensureOffertaIndeedJobId,
  getOffertaLavoro,
  updateOffertaLavoro,
} from "@/lib/recruiting/offerteRepo";
import {
  removeOffertaFromCreditCoreSafe,
  syncOffertaToCreditCoreSafe,
} from "@/lib/recruiting/creditCoreOfferteSync";
import { validaReceiverConfigInput } from "@/lib/recruiting/receiver";
import {
  deleteReceiverConfig,
  getReceiverConfig,
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
  deleteCandidatura,
  findCandidaturaByContactOnOfferta,
  findCandidaturaByExternalApplicationId,
  getCandidatura,
  updateCandidaturaStato,
  upsertCandidaturaFromReceiver,
} from "@/lib/recruiting/candidatureRepo";
import {
  validaContattoInput,
  validaNotaInput,
  validaNoteAttivita,
  validaProvaInput,
  validaEsitoProvaInput,
} from "@/lib/recruiting/attivita";
import {
  createContattoAttivita,
  createNotaAttivita,
  createProvaProgrammata,
  markCandidaturaVistaAttivita,
  updateContattoAttivita,
  updateProvaProgrammata,
  salvaEsitoProva,
} from "@/lib/recruiting/attivitaRepo";
import {
  validaColloquioCreateInput,
  validaColloquioUpdateInput,
  validaEsitoColloquioInput,
  validaSvolgimentoInput,
} from "@/lib/recruiting/colloqui";
import {
  annullaColloquio,
  chiudiColloquio,
  createColloquio,
  deleteColloquio,
  listSupervisoriTenantRecruiting,
  listUtentiTenantRecruiting,
  listColloquiByCandidatura,
  salvaValutazioneColloquio,
  updateColloquio,
} from "@/lib/recruiting/colloquiRepo";
import {
  listApplications,
  getCvOpenUrl,
} from "@/lib/recruiting/receiverClient";
import {
  IndeedSyncError,
  openIndeedCandidateCv,
  syncIndeedApplicationsForOfferta,
  type IndeedSyncResult,
} from "@/lib/recruiting/indeedApplySync";

function publicSyncError(e: unknown): Error {
  if (e instanceof IndeedSyncError) {
    return new Error(e.message);
  }
  return new Error("Sincronizzazione non riuscita");
}

/**
 * Sync manuale candidature Indeed dal Receiver aziendale per un'offerta.
 * Nessuno scheduler. Nessun CV salvato in Credixa.
 */
export async function syncIndeedApplicationsAction(
  offertaId: string
): Promise<IndeedSyncResult> {
  const user = await requireWritablePermission("recruiting:manage");
  const oid = String(offertaId || "").trim();
  try {
    // Multi-azienda: garantisce indeedJobId del tenant e allinea CreditCore prima del pull
    const offerta = await getOffertaLavoro(user.tenantId, oid);
    if (!offerta || offerta.tenantId !== user.tenantId) {
      throw new Error("Offerta non trovata");
    }
    if (offerta.stato === "PUBBLICATA") {
      await ensureOffertaIndeedJobId(user.tenantId, oid);
      await syncOffertaToCreditCoreSafe(
        (await getOffertaLavoro(user.tenantId, oid)) || offerta,
        { companyName: (user.tenantNome || "").trim() || undefined }
      );
    }

    const result = await syncIndeedApplicationsForOfferta(
      {
        tenantId: user.tenantId,
        offertaId: oid,
        userId: user.id,
      },
      {
        getOffertaLavoro,
        getReceiverConfig,
        listApplications,
        findByExternalApplicationId: findCandidaturaByExternalApplicationId,
        findByContactOnOfferta: findCandidaturaByContactOnOfferta,
        upsertFromReceiver: upsertCandidaturaFromReceiver,
        getCandidatura,
        getCvOpenUrl,
      }
    );
    revalidateRecruiting(oid);
    return result;
  } catch (e) {
    throw publicSyncError(e);
  }
}

/**
 * URL temporaneo CV dal Receiver. Non persiste l'URL né il file.
 */
export async function getIndeedCandidateCvUrlAction(
  candidaturaId: string
): Promise<{ openUrl: string; expiresAt: string | null; fileName: string | null }> {
  const user = await assertRecruitingAccess();
  try {
    return await openIndeedCandidateCv(
      {
        tenantId: user.tenantId,
        candidaturaId: String(candidaturaId || "").trim(),
      },
      {
        getCandidatura,
        getCvOpenUrl,
      }
    );
  } catch (e) {
    throw publicSyncError(e);
  }
}

function revalidateRecruiting(offertaId?: string) {
  revalidatePath("/recruiting");
  if (offertaId) {
    revalidatePath(`/recruiting/offerte/${offertaId}`);
  }
}

/** Garantisce indeedJobId e sync catalogo CreditCore (best-effort). */
async function afterOffertaSaved(
  tenantId: string,
  offertaId: string,
  companyName?: string | null
) {
  let offerta = await getOffertaLavoro(tenantId, offertaId);
  if (!offerta) return;
  if (offerta.stato === "PUBBLICATA") {
    offerta = await ensureOffertaIndeedJobId(tenantId, offertaId);
  }
  await syncOffertaToCreditCoreSafe(offerta, {
    companyName: (companyName || "").trim() || undefined,
  });
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
  const created = await createOffertaLavoro(user.tenantId, input);
  await afterOffertaSaved(user.tenantId, created.id, user.tenantNome);
  revalidateRecruiting(created.id);
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
  await afterOffertaSaved(user.tenantId, id, user.tenantNome);
  revalidateRecruiting(id);
}

export async function chiudiOffertaLavoroAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Offerta non indicata");
  await chiudiOffertaLavoro(user.tenantId, id);
  await afterOffertaSaved(user.tenantId, id, user.tenantNome);
  revalidateRecruiting(id);
}

export async function eliminaOffertaLavoroAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Offerta non indicata");
  await deleteOffertaLavoro(user.tenantId, id);
  await removeOffertaFromCreditCoreSafe(user.tenantId, id);
  revalidatePath("/recruiting");
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

/** Segna la candidatura come vista (esce dal tab «Nuove»). Idempotente. */
export async function markCandidaturaVistaAction(candidaturaId: string) {
  const user = await assertRecruitingAccess();
  const id = String(candidaturaId || "").trim();
  if (!id) return;
  await markCandidaturaVistaAttivita(user.tenantId, id, user.id);
  revalidatePath("/recruiting");
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
  const updated = await updateCandidaturaStato(user.tenantId, id, stato, user.id);
  revalidateRecruiting(updated.offertaId);
  revalidatePath(`/recruiting/offerte/${updated.offertaId}/${updated.id}`);
}

export async function eliminaCandidaturaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Candidatura non indicata");
  const deleted = await deleteCandidatura(user.tenantId, id);
  revalidateRecruiting(deleted.offertaId);
  revalidatePath(`/recruiting/offerte/${deleted.offertaId}`);
  revalidatePath(`/recruiting/offerte/${deleted.offertaId}/${deleted.id}`);
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
  const intervistatoreUserId = String(formData.get("intervistatoreUserId") || "");
  const utenti = await listUtentiTenantRecruiting(user.tenantId);
  const labelFromUser =
    utenti.find((u) => u.id === intervistatoreUserId.trim())?.name || "";
  const input = validaColloquioCreateInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    scheduledAt: String(formData.get("scheduledAt") || ""),
    modalita: String(formData.get("modalita") || ""),
    intervistatoreUserId,
    intervistatoreLabel: labelFromUser,
    notePreliminari: String(formData.get("notePreliminari") || ""),
  });
  const created = await createColloquio(user.tenantId, user.id, input);
  const candidatura = await getCandidatura(user.tenantId, created.candidaturaId);
  if (candidatura?.stato === "IN_VALUTAZIONE" || candidatura?.stato === "RICEVUTA") {
    await updateCandidaturaStato(user.tenantId, candidatura.id, "COLLOQUIO", user.id);
  }
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function creaProvaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const affiancatoreUserId = String(
    formData.get("affiancatoreUserId") || formData.get("intervistatoreUserId") || ""
  );
  const supervisori = await listSupervisoriTenantRecruiting(user.tenantId);
  const labelFromUser =
    supervisori.find((u) => u.id === affiancatoreUserId.trim())?.name || "";
  const input = validaProvaInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    scheduledAt: String(formData.get("scheduledAt") || ""),
    modalita: String(formData.get("modalita") || ""),
    intervistatoreUserId: affiancatoreUserId,
    intervistatoreLabel: labelFromUser,
    notePreliminari: String(formData.get("notePreliminari") || formData.get("note") || ""),
  });
  const candidatura = await getCandidatura(user.tenantId, input.candidaturaId);
  if (!candidatura) throw new Error("Candidatura non trovata");
  const colloqui = await listColloquiByCandidatura(user.tenantId, candidatura.id);
  const ultimo = [...colloqui].sort((a, b) => b.round - a.round)[0] ?? null;
  if (
    !ultimo?.esito ||
    !ultimo.valutazioneStelle ||
    !String(ultimo.noteSvolgimento || "").trim()
  ) {
    throw new Error(
      "Prima di programmare la prova registra esito, valutazione e parere sul colloquio"
    );
  }
  await createProvaProgrammata(user.tenantId, user.id, {
    candidaturaId: input.candidaturaId,
    scheduledAt: input.scheduledAt,
    note: input.note,
    modalita: input.modalita,
    intervistatoreLabel: input.intervistatoreLabel,
  });
  await updateCandidaturaStato(user.tenantId, candidatura.id, "PROVA", user.id);
  revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function aggiornaProvaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const provaId = String(formData.get("provaId") || formData.get("id") || "").trim();
  if (!provaId) throw new Error("Prova non indicata");
  const affiancatoreUserId = String(
    formData.get("affiancatoreUserId") || formData.get("intervistatoreUserId") || ""
  );
  const supervisori = await listSupervisoriTenantRecruiting(user.tenantId);
  const labelFromUser =
    supervisori.find((u) => u.id === affiancatoreUserId.trim())?.name || "";
  const input = validaProvaInput({
    candidaturaId: String(formData.get("candidaturaId") || ""),
    scheduledAt: String(formData.get("scheduledAt") || ""),
    modalita: String(formData.get("modalita") || ""),
    intervistatoreUserId: affiancatoreUserId,
    intervistatoreLabel: labelFromUser,
    notePreliminari: String(formData.get("notePreliminari") || formData.get("note") || ""),
  });
  await updateProvaProgrammata(user.tenantId, user.id, {
    id: provaId,
    candidaturaId: input.candidaturaId,
    scheduledAt: input.scheduledAt,
    note: input.note,
    modalita: input.modalita,
    intervistatoreLabel: input.intervistatoreLabel,
  });
  const candidatura = await getCandidatura(user.tenantId, input.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function salvaEsitoProvaAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const input = validaEsitoProvaInput({
    provaId: String(formData.get("provaId") || formData.get("id") || ""),
    esito: String(formData.get("esito") || ""),
    parere: String(formData.get("parere") || formData.get("noteSvolgimento") || ""),
    valutazioneStelle: String(formData.get("valutazioneStelle") || ""),
  });
  const updated = await salvaEsitoProva(user.tenantId, user.id, input);
  const candidatura = await getCandidatura(user.tenantId, updated.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function svolgiColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const svolgi = validaSvolgimentoInput({
    id: String(formData.get("id") || ""),
    noteSvolgimento: String(formData.get("noteSvolgimento") || ""),
    valutazioneStelle: String(formData.get("valutazioneStelle") || ""),
  });
  const esito = validaEsitoColloquioInput({
    id: svolgi.id,
    esito: String(formData.get("esito") || ""),
    // Unica nota di fase Colloquio: quella di svolgimento
    valutazione: String(
      formData.get("noteSvolgimento") || formData.get("valutazione") || ""
    ),
  });
  const notePreliminari = validaNoteAttivita(String(formData.get("notePreliminari") || ""));
  const updated = await salvaValutazioneColloquio(user.tenantId, user.id, {
    id: svolgi.id,
    notePreliminari,
    noteSvolgimento: svolgi.noteSvolgimento,
    valutazioneStelle: svolgi.valutazioneStelle,
    esito: esito.esito,
    valutazione: esito.valutazione,
  });
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

export async function aggiornaColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const intervistatoreUserId = String(formData.get("intervistatoreUserId") || "");
  const utenti = await listUtentiTenantRecruiting(user.tenantId);
  const labelFromUser =
    utenti.find((u) => u.id === intervistatoreUserId.trim())?.name || "";
  const input = validaColloquioUpdateInput({
    id: String(formData.get("id") || ""),
    scheduledAt: String(formData.get("scheduledAt") || ""),
    modalita: String(formData.get("modalita") || ""),
    intervistatoreUserId,
    intervistatoreLabel: labelFromUser,
    notePreliminari: String(formData.get("notePreliminari") || ""),
  });
  const updated = await updateColloquio(user.tenantId, user.id, input);
  const candidatura = await getCandidatura(user.tenantId, updated.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}

export async function eliminaColloquioAction(formData: FormData) {
  const user = await requireWritablePermission("recruiting:manage");
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Colloquio non indicato");
  const deleted = await deleteColloquio(user.tenantId, id);
  const candidatura = await getCandidatura(user.tenantId, deleted.candidaturaId);
  if (candidatura) revalidateCandidatura(candidatura.offertaId, candidatura.id);
}
