import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeReceiverCandidate } from "@/lib/recruiting/receiver";
import { ingestReceiverCandidatePush } from "@/lib/recruiting/receiverPushIngest";

export const runtime = "nodejs";

function loadSourceSecretsJson(): string {
  const fromEnv = String(process.env.RECEIVER_SOURCE_SECRETS_JSON || "").trim();
  if (fromEnv) return fromEnv;
  // Dev monorepo: riusa receiver/.env se presente
  for (const rel of ["receiver/.env", "../receiver/.env"]) {
    const p = resolve(process.cwd(), rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith("RECEIVER_SOURCE_SECRETS_JSON=")) continue;
      return t.slice("RECEIVER_SOURCE_SECRETS_JSON=".length).trim();
    }
  }
  return "";
}

function loadSourceSecretsMap(): Record<string, string> {
  const raw = loadSourceSecretsJson();
  if (!raw) return {};
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) {
      const tid = String(k || "").trim();
      const secret = String(v || "").trim();
      if (tid && secret) out[tid] = secret;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Secret SOURCE per tenant (multi-azienda).
 * Ogni azienda deve avere la propria voce in RECEIVER_SOURCE_SECRETS_JSON.
 * RECEIVER_SOURCE_KEY globale è deprecato e ignorato se la mappa ha voci.
 */
function sourceKeyForTenant(tenantId: string): string | null {
  const tid = tenantId.trim();
  if (!tid) return null;
  const map = loadSourceSecretsMap();
  const fromMap = String(map[tid] || "").trim();
  if (fromMap) return fromMap;

  // Legacy single-tenant: solo se la mappa è vuota
  if (Object.keys(map).length === 0) {
    const single = String(process.env.RECEIVER_SOURCE_KEY || "").trim();
    return single || null;
  }
  return null;
}

function unauthorized(message: string) {
  return NextResponse.json({ error: "AUTH_FAILED", message }, { status: 401 });
}

/**
 * Push istantaneo Receiver → Credixa dopo ingest/update SOURCE.
 * Auth: X-Source-Tenant-Id + X-Receiver-Source-Key (stesso secret SOURCE del Receiver).
 */
export async function POST(req: Request) {
  const tenantId = String(req.headers.get("x-source-tenant-id") || "").trim();
  const key = String(req.headers.get("x-receiver-source-key") || "").trim();
  if (!tenantId || !key) {
    return unauthorized("Header autenticazione mancanti");
  }
  const expected = sourceKeyForTenant(tenantId);
  if (!expected || expected !== key) {
    return unauthorized("Secret SOURCE non valido");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_BODY", message: "JSON non valido" },
      { status: 400 }
    );
  }

  try {
    const candidate = normalizeReceiverCandidate(body);
    const sourceName =
      body &&
      typeof body === "object" &&
      "source" in body &&
      (body as { source?: unknown }).source != null
        ? String((body as { source?: unknown }).source)
        : "receiver-push";

    const result = await ingestReceiverCandidatePush({
      tenantId,
      candidate,
      sourceName,
    });

    return NextResponse.json({
      ok: true,
      tenantId,
      outcome: result.outcome,
      candidaturaId: result.candidaturaId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingest fallito";
    const status = /non trovata|obbligatori/i.test(message) ? 400 : 500;
    console.error("[recruiting.receiver-push]", { tenantId, message });
    return NextResponse.json(
      { error: "INGEST_FAILED", message, tenantId },
      { status }
    );
  }
}
