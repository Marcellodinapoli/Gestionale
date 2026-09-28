import "server-only";

import { getFirebaseFirestore } from "@/lib/firebase/admin";
import type { OffertaLavoroRecord } from "@/lib/recruiting/offerte";
import { creditCoreOffertaDocId } from "@/lib/recruiting/creditCoreIds";

const COLLECTION = "job_offers";
const SOURCE = "gestionale";

export { creditCoreOffertaDocId } from "@/lib/recruiting/creditCoreIds";

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
 *
 * @param opts.forcePendingApproval — forza status=pending (ripubblicazione / nuova richiesta BO)
 */
export async function syncOffertaToCreditCore(
  offerta: OffertaLavoroRecord,
  opts?: { companyName?: string; forcePendingApproval?: boolean }
): Promise<void> {
  const db = getFirebaseFirestore();
  const docId = creditCoreOffertaDocId(offerta.tenantId, offerta.id);
  const onlineDesired = offerta.stato === "PUBBLICATA";
  const indeedJobId = String(offerta.indeedJobId || "").trim();
  const createdAt = offerta.createdAt || new Date();
  const expiryDate = defaultExpiryDate(createdAt);

  const ref = db.collection(COLLECTION).doc(docId);
  const existing = await ref.get();
  const prev = existing.exists ? (existing.data() as Record<string, unknown>) : null;
  const prevStatus = String(prev?.status || "").toLowerCase();

  /**
   * Approvazione BO obbligatoria prima di andare online su CreditCore.
   * - forcePendingApproval (riapri / sync se bloccata) → pending / offline
   * - nuova offerta / pending → pending / offline
   * - già approved e ancora PUBBLICATA → approved / online (aggiorna contenuti)
   * - blocked/rejected senza force → resta così (offline)
   * - CHIUSA/BOZZA → offline (doc non cancellato; solo «Elimina» rimuove)
   */
  let status: string;
  let online: boolean;
  if (!onlineDesired) {
    online = false;
    // Chiusa/bozza: resta offline; non lasciare «pending» se era già gestita.
    if (prevStatus === "pending" || !prevStatus) status = "pending";
    else status = prevStatus;
  } else if (opts?.forcePendingApproval || !existing.exists || !prevStatus) {
    status = "pending";
    online = false;
  } else if (prevStatus === "approved") {
    status = "approved";
    online = true;
  } else if (prevStatus === "pending") {
    status = "pending";
    online = false;
  } else if (prevStatus === "blocked" || prevStatus === "rejected") {
    status = prevStatus;
    online = false;
  } else {
    status = "pending";
    online = false;
  }

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
    status,
    online,
    updatedAt: new Date(),
    createdAt: prev?.createdAt || createdAt,
  };

  // Provenienza cambio stato (non sovrascrivere se lo status resta uguale).
  const statusChanged = !existing.exists || prevStatus !== status;
  if (statusChanged) {
    payload.statusSource = "gestionale";
    payload.statusActor = (opts?.companyName || "").trim() || offerta.tenantId;
    payload.statusChangedAt = new Date();
  }

  await ref.set(payload, { merge: true });
}

export async function removeOffertaFromCreditCore(
  tenantId: string,
  offertaId: string
): Promise<void> {
  const db = getFirebaseFirestore();
  const docId = creditCoreOffertaDocId(tenantId, offertaId);
  await db.collection(COLLECTION).doc(docId).delete();
}

export type CreditCoreOffertaStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "blocked"
  | "unknown";

/** Chi ha cambiato per ultimo lo status su CreditCore. */
export type CreditCoreStatusSource = "gestionale" | "creditcore_bo" | "unknown";

export type CreditCoreOffertaSnapshot = {
  status: CreditCoreOffertaStatus;
  online: boolean;
  statusSource: CreditCoreStatusSource;
  statusActor: string | null;
  statusChangedAt: string | null;
};

function normalizeCreditCoreStatus(raw: unknown): CreditCoreOffertaStatus {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected" || s === "blocked") {
    return s;
  }
  return "unknown";
}

function normalizeStatusSource(raw: unknown): CreditCoreStatusSource {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "gestionale" || s === "creditcore_bo") return s;
  return "unknown";
}

function tsToIso(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "object" && raw !== null && "toDate" in raw) {
    try {
      const d = (raw as { toDate: () => Date }).toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Snapshot approvazione BO CreditCore (status + online + provenienza azione).
 * Best-effort: se Firebase non è disponibile → mappa vuota.
 */
export async function getCreditCoreOfferteSnapshots(
  tenantId: string,
  offertaIds: string[]
): Promise<Record<string, CreditCoreOffertaSnapshot>> {
  const ids = [...new Set(offertaIds.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const db = getFirebaseFirestore();
    const refs = ids.map((id) =>
      db.collection(COLLECTION).doc(creditCoreOffertaDocId(tenantId, id))
    );
    const snaps = await db.getAll(...refs);
    const out: Record<string, CreditCoreOffertaSnapshot> = {};
    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i]!;
      const oid = ids[i]!;
      if (!snap.exists) {
        out[oid] = {
          status: "unknown",
          online: false,
          statusSource: "unknown",
          statusActor: null,
          statusChangedAt: null,
        };
        continue;
      }
      const data = snap.data() as Record<string, unknown> | undefined;
      out[oid] = {
        status: normalizeCreditCoreStatus(data?.status),
        online: data?.online === true,
        statusSource: normalizeStatusSource(data?.statusSource),
        statusActor: String(data?.statusActor || "").trim() || null,
        statusChangedAt: tsToIso(data?.statusChangedAt),
      };
    }
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        event: "creditcore_offerta_status_read_failed",
        tenantId,
        error: msg,
      })
    );
    return {};
  }
}

/** Compat: solo status (usato da sync). */
export async function getCreditCoreOfferteStatusMap(
  tenantId: string,
  offertaIds: string[]
): Promise<Record<string, CreditCoreOffertaStatus>> {
  const snaps = await getCreditCoreOfferteSnapshots(tenantId, offertaIds);
  const out: Record<string, CreditCoreOffertaStatus> = {};
  for (const [id, s] of Object.entries(snaps)) {
    out[id] = s.status;
  }
  return out;
}

/** Best-effort: non blocca il salvataggio SQL se Firebase non è configurato. */
export async function syncOffertaToCreditCoreSafe(
  offerta: OffertaLavoroRecord,
  opts?: { companyName?: string; forcePendingApproval?: boolean }
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
