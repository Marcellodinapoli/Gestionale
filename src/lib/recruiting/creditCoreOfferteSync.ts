import "server-only";

import { getFirebaseFirestore } from "@/lib/firebase/admin";
import type { OffertaLavoroRecord } from "@/lib/recruiting/offerte";

const COLLECTION = "job_offers";
const SOURCE = "gestionale";

/** Doc id stabile e non collidente con vecchie offerte azienda CreditJob. */
export function creditCoreOffertaDocId(tenantId: string, offertaId: string): string {
  const tid = String(tenantId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const oid = String(offertaId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return `gestionale_${tid}_${oid}`;
}

function workModeFromOfferta(modalita: string): string {
  switch (modalita) {
    case "REMOTO":
      return "remote";
    case "IBRIDO":
      return "hybrid";
    default:
      return "presence";
  }
}

function scheduleLabel(orario: string): string | null {
  switch (String(orario || "").trim().toUpperCase()) {
    case "FULL_TIME":
      return "Full time";
    case "PART_TIME":
      return "Part time";
    case "TURNO":
      return "Turni";
    default:
      return String(orario || "").trim() || null;
  }
}

function contractLabel(tipo: string): string | null {
  switch (String(tipo || "").trim().toUpperCase()) {
    case "TEMPO_INDETERMINATO":
      return "Tempo indeterminato";
    case "TEMPO_DETERMINATO":
      return "Tempo determinato";
    case "APPRENDISTATO":
      return "Apprendistato";
    case "STAGE":
      return "Stage";
    case "COLLABORAZIONE":
      return "Collaborazione / progetto";
    default:
      return String(tipo || "").trim() || null;
  }
}

function modeLabel(modalita: string): string {
  switch (modalita) {
    case "REMOTO":
      return "Da remoto";
    case "IBRIDO":
      return "Ibrido";
    default:
      return "In presenza";
  }
}

/** Highlight card: benefit + condizioni rapide (no PII). */
function buildQuickNews(offerta: OffertaLavoroRecord): string[] {
  const out: string[] = [];
  const sched = scheduleLabel(offerta.orario);
  if (sched) out.push(sched);
  const contr = contractLabel(offerta.tipoContratto);
  if (contr) out.push(contr);
  out.push(modeLabel(offerta.modalitaLavoro));
  if (offerta.numeroPosizioni > 1) {
    out.push(`${offerta.numeroPosizioni} posizioni`);
  }
  const benefitLines = String(offerta.benefit || "")
    .split(/\r?\n|;|•/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const b of benefitLines) {
    if (out.length >= 6) break;
    out.push(b.length > 40 ? `${b.slice(0, 40)}…` : b);
  }
  return out;
}

function defaultExpiryDate(from: Date): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + 60);
  return d;
}

/**
 * Pubblica / aggiorna / nasconde l'offerta su CreditCore (Firestore job_offers).
 * Solo metadati annuncio — nessun CV / dato candidato.
 */
export async function syncOffertaToCreditCore(
  offerta: OffertaLavoroRecord,
  opts?: { companyName?: string }
): Promise<void> {
  const db = getFirebaseFirestore();
  const docId = creditCoreOffertaDocId(offerta.tenantId, offerta.id);
  const online = offerta.stato === "PUBBLICATA";
  const indeedJobId = String(offerta.indeedJobId || "").trim();
  const createdAt = offerta.createdAt || new Date();
  const expiryDate = defaultExpiryDate(createdAt);

  const payload: Record<string, unknown> = {
    source: SOURCE,
    tenantId: offerta.tenantId,
    offertaId: offerta.id,
    indeedJobId: indeedJobId || null,
    title: offerta.titolo,
    /** Identità azienda publisher su Indeed / CreditCore (1 tenant = 1 company). */
    companyId: offerta.tenantId,
    companyName: (opts?.companyName || "").trim() || offerta.tenantId,
    /** Alias espliciti per bridge multi-azienda → Indeed employer account. */
    publisherTenantId: offerta.tenantId,
    publisherCompanyId: offerta.tenantId,
    location: offerta.luogo,
    description: offerta.descrizione,
    tasks: offerta.attivitaPrincipali || null,
    skills: offerta.competenze || null,
    benefits: offerta.benefit || null,
    salary: offerta.retribuzione || null,
    positions: offerta.numeroPosizioni,
    workMode: workModeFromOfferta(offerta.modalitaLavoro),
    schedule: offerta.orario || null,
    scheduleLabel: scheduleLabel(offerta.orario),
    contractType: offerta.tipoContratto || null,
    contractLabel: contractLabel(offerta.tipoContratto),
    requirements: offerta.requisiti || null,
    quickNews: buildQuickNews(offerta),
    expiryDate,
    status: "approved",
    online,
    updatedAt: new Date(),
    createdAt,
  };

  await db.collection(COLLECTION).doc(docId).set(payload, { merge: true });
}

export async function removeOffertaFromCreditCore(
  tenantId: string,
  offertaId: string
): Promise<void> {
  const db = getFirebaseFirestore();
  const docId = creditCoreOffertaDocId(tenantId, offertaId);
  await db.collection(COLLECTION).doc(docId).delete();
}

/** Best-effort: non blocca il salvataggio SQL se Firebase non è configurato. */
export async function syncOffertaToCreditCoreSafe(
  offerta: OffertaLavoroRecord,
  opts?: { companyName?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await syncOffertaToCreditCore(offerta, opts);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "creditcore_offerta_sync_failed",
        tenantId: offerta.tenantId,
        offertaId: offerta.id,
        error: msg,
      })
    );
    return { ok: false, error: msg };
  }
}

export async function removeOffertaFromCreditCoreSafe(
  tenantId: string,
  offertaId: string
): Promise<void> {
  try {
    await removeOffertaFromCreditCore(tenantId, offertaId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "creditcore_offerta_remove_failed",
        tenantId,
        offertaId,
        error: msg,
      })
    );
  }
}
