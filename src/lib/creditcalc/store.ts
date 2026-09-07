import "server-only";
import { randomUUID } from "node:crypto";
import {
  firebaseFieldValue,
  getFirebaseFirestore,
} from "@/lib/firebase/admin";
import {
  COL_CONNECTIONS,
  COL_LINK_REQUESTS,
  COL_TENANT_CONNECTOR,
  LINK_REQUEST_TTL_MS,
  type CreditCalcConnection,
  type CreditCalcLinkRequest,
  type LinkRequestStatus,
} from "./types";

function db() {
  return getFirebaseFirestore();
}

function nowIso() {
  return new Date().toISOString();
}

export async function createLinkRequest(input: {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  gestionaleUserId: string;
  operatorName: string;
  operatorEmail: string;
  createdByUserId: string;
}): Promise<CreditCalcLinkRequest> {
  const linkRequestId = randomUUID();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + LINK_REQUEST_TTL_MS).toISOString();
  const doc: CreditCalcLinkRequest = {
    linkRequestId,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    gestionaleUserId: input.gestionaleUserId,
    operatorName: input.operatorName,
    operatorEmail: input.operatorEmail,
    createdByUserId: input.createdByUserId,
    status: "pending",
    createdAt,
    expiresAt,
    consumedAt: null,
    consumedByCreditCalcUserId: null,
  };
  await db().collection(COL_LINK_REQUESTS).doc(linkRequestId).set(doc);
  return doc;
}

export async function getLinkRequest(
  linkRequestId: string
): Promise<CreditCalcLinkRequest | null> {
  const snap = await db().collection(COL_LINK_REQUESTS).doc(linkRequestId).get();
  if (!snap.exists) return null;
  return snap.data() as CreditCalcLinkRequest;
}

/** Applica scadenza lazy se pending e expiresAt passato. */
export async function refreshLinkRequestStatus(
  req: CreditCalcLinkRequest
): Promise<CreditCalcLinkRequest> {
  if (req.status !== "pending") return req;
  if (new Date(req.expiresAt).getTime() > Date.now()) return req;
  const updated: CreditCalcLinkRequest = { ...req, status: "expired" };
  await db().collection(COL_LINK_REQUESTS).doc(req.linkRequestId).set(
    { status: "expired" },
    { merge: true }
  );
  return updated;
}

export async function revokeLinkRequest(
  linkRequestId: string
): Promise<CreditCalcLinkRequest | null> {
  const current = await getLinkRequest(linkRequestId);
  if (!current) return null;
  if (current.status !== "pending") return current;
  const updated: CreditCalcLinkRequest = { ...current, status: "revoked" };
  await db().collection(COL_LINK_REQUESTS).doc(linkRequestId).set(
    { status: "revoked" },
    { merge: true }
  );
  return updated;
}

export async function consumeLinkRequest(input: {
  linkRequestId: string;
  creditCalcUserId: string;
}): Promise<
  | { ok: true; request: CreditCalcLinkRequest; connection: CreditCalcConnection }
  | { ok: false; error: string; status: number }
> {
  const ref = db().collection(COL_LINK_REQUESTS).doc(input.linkRequestId);

  const consumed = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { ok: false as const, error: "Richiesta non trovata", status: 404 };
    }
    let req = snap.data() as CreditCalcLinkRequest;
    if (req.status === "pending" && new Date(req.expiresAt).getTime() <= Date.now()) {
      tx.set(ref, { status: "expired" }, { merge: true });
      req = { ...req, status: "expired" };
    }
    if (req.status === "expired") {
      return { ok: false as const, error: "QR scaduto", status: 410 };
    }
    if (req.status === "consumed") {
      return { ok: false as const, error: "QR già utilizzato", status: 409 };
    }
    if (req.status === "revoked") {
      return { ok: false as const, error: "QR revocato", status: 410 };
    }
    if (req.status !== "pending") {
      return { ok: false as const, error: "QR non valido", status: 400 };
    }

    const consumedAt = nowIso();
    tx.set(
      ref,
      {
        status: "consumed" satisfies LinkRequestStatus,
        consumedAt,
        consumedByCreditCalcUserId: input.creditCalcUserId,
      },
      { merge: true }
    );

    return {
      ok: true as const,
      request: {
        ...req,
        status: "consumed" as const,
        consumedAt,
        consumedByCreditCalcUserId: input.creditCalcUserId,
      },
    };
  });

  if (!consumed.ok) return consumed;

  const req = consumed.request;

  // Riattiva/aggiorna Connection esistente stesso tenant, altrimenti crea.
  const existingSnap = await db()
    .collection(COL_CONNECTIONS)
    .where("creditCalcUserId", "==", input.creditCalcUserId)
    .get();

  const existingDocs = existingSnap.docs.filter(
    (d) => (d.data() as CreditCalcConnection).tenantId === req.tenantId
  );

  const activeOrAny =
    existingDocs.find((d) => (d.data() as CreditCalcConnection).status === "active") ??
    existingDocs[0];

  const connectionId = activeOrAny ? activeOrAny.id : randomUUID();
  const prev = activeOrAny
    ? (activeOrAny.data() as CreditCalcConnection)
    : null;

  const connection: CreditCalcConnection = {
    connectionId,
    creditCalcUserId: input.creditCalcUserId,
    gestionaleUserId: req.gestionaleUserId,
    tenantId: req.tenantId,
    tenantSlug: req.tenantSlug,
    tenantName: req.tenantName,
    operatorName: req.operatorName,
    operatorEmail: req.operatorEmail,
    status: "active",
    createdAt: prev?.createdAt || nowIso(),
    revokedAt: null,
  };

  await db().collection(COL_CONNECTIONS).doc(connectionId).set(connection);
  return { ok: true, request: req, connection };
}

export async function listConnectionsForCreditCalcUser(
  creditCalcUserId: string
): Promise<CreditCalcConnection[]> {
  const snap = await db()
    .collection(COL_CONNECTIONS)
    .where("creditCalcUserId", "==", creditCalcUserId)
    .get();
  const items = snap.docs
    .map((d) => d.data() as CreditCalcConnection)
    .filter((c) => c.status === "active");
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return items;
}

export async function getConnectionById(
  connectionId: string
): Promise<CreditCalcConnection | null> {
  const snap = await db().collection(COL_CONNECTIONS).doc(connectionId).get();
  if (!snap.exists) return null;
  return snap.data() as CreditCalcConnection;
}

/**
 * Verifica ownership: Firebase UID → Connection attiva.
 * Ignora qualsiasi tenantId/gestionaleUserId inviato dal client.
 */
export async function requireOwnedActiveConnection(
  creditCalcUserId: string,
  connectionId: string
): Promise<
  | { ok: true; connection: CreditCalcConnection }
  | { ok: false; error: string; status: number }
> {
  const connection = await getConnectionById(connectionId);
  if (!connection || connection.status !== "active") {
    return { ok: false, error: "Collegamento non trovato", status: 404 };
  }
  if (connection.creditCalcUserId !== creditCalcUserId) {
    return { ok: false, error: "Collegamento non autorizzato", status: 403 };
  }
  return { ok: true, connection };
}

export async function revokeConnection(
  creditCalcUserId: string,
  connectionId: string
): Promise<
  | { ok: true; connection: CreditCalcConnection }
  | { ok: false; error: string; status: number }
> {
  const owned = await requireOwnedActiveConnection(creditCalcUserId, connectionId);
  if (!owned.ok) return owned;
  const updated: CreditCalcConnection = {
    ...owned.connection,
    status: "revoked",
    revokedAt: nowIso(),
  };
  await db().collection(COL_CONNECTIONS).doc(connectionId).set(updated);
  return { ok: true, connection: updated };
}

export type TenantConnectorConfig = {
  tenantId: string;
  connectorBaseUrl: string;
  /** Opzionale: override API key (altrimenti CONNECTOR_API_KEY globale). */
  connectorApiKey?: string | null;
  updatedAt?: string;
};

export async function getTenantConnectorConfig(
  tenantId: string
): Promise<TenantConnectorConfig | null> {
  const snap = await db().collection(COL_TENANT_CONNECTOR).doc(tenantId).get();
  if (!snap.exists) return null;
  return snap.data() as TenantConnectorConfig;
}

export async function upsertTenantConnectorConfig(
  config: TenantConnectorConfig
): Promise<void> {
  const FieldValue = firebaseFieldValue();
  await db()
    .collection(COL_TENANT_CONNECTOR)
    .doc(config.tenantId)
    .set(
      {
        ...config,
        updatedAt: nowIso(),
        _updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

/** Estrae solo il nonce/UUID da payload QR (URL o testo grezzo). */
export function parseLinkRequestIdFromQr(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const uuidRe =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const fromPath = trimmed.match(
    /(?:pair|link|creditcalc)[/:]([0-9a-f-]{36})/i
  );
  if (fromPath?.[1]) return fromPath[1].toLowerCase();
  const m = trimmed.match(uuidRe);
  return m ? m[0].toLowerCase() : null;
}
