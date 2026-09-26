/**
 * Accettazione invito ADMIN — logica Neon riusabile da route e test.
 * Nessun "server-only" (importabile da scripts).
 */
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { QueryResultRow } from "@neondatabase/serverless";
import { getNeonPool } from "@/lib/neon/pool";
import { isNeonConfigured } from "@/lib/neon/client";
import { validatePasswordComplexity } from "@/lib/passwordRules";

export type AcceptInviteResult = {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
};

export type AcceptInviteErrorCode =
  | "INVITE_INVALID"
  | "PASSWORD_MISMATCH"
  | "PASSWORD_WEAK"
  | "USER_EXISTS";

export class AcceptInviteError extends Error {
  readonly code: AcceptInviteErrorCode;
  constructor(code: AcceptInviteErrorCode, message: string) {
    super(message);
    this.name = "AcceptInviteError";
    this.code = code;
  }
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

type TxQuery = <R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => Promise<{ rows: R[]; rowCount: number }>;

async function withTx<T>(fn: (q: TxQuery) => Promise<T>): Promise<T> {
  const client = await getNeonPool().connect();
  try {
    await client.query("BEGIN");
    const q = (async (text: string, params: unknown[] = []) => {
      const res = await client.query(text, params);
      return { rows: res.rows as QueryResultRow[], rowCount: res.rowCount ?? 0 };
    }) as TxQuery;
    const result = await fn(q);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Accetta invito monouso: consuma TokenHash in TX e crea User ADMIN.
 * Non cambia Status del tenant.
 */
export async function acceptInvite(
  token: string,
  password: string,
  passwordConfirm: string
): Promise<AcceptInviteResult> {
  if (!isNeonConfigured()) {
    throw new Error("NEON_DATABASE_URL non configurato");
  }
  const rawToken = String(token || "").trim();
  if (!rawToken) {
    throw new AcceptInviteError("INVITE_INVALID", "Invito non valido o scaduto");
  }
  if (password !== passwordConfirm) {
    throw new AcceptInviteError("PASSWORD_MISMATCH", "Le password non coincidono");
  }
  const complexity = validatePasswordComplexity(password);
  if (complexity) {
    throw new AcceptInviteError("PASSWORD_WEAK", complexity);
  }

  const tokenHash = hashInviteToken(rawToken);
  const passwordHash = await bcrypt.hash(password, 10);

  return withTx(async (q) => {
    const locked = await q<{
      Id: string;
      TenantId: string;
      Email: string;
      Role: string;
      ExpiresAt: Date | string;
      UsedAt: Date | string | null;
    }>(
      `SELECT "Id", "TenantId", "Email", "Role", "ExpiresAt", "UsedAt"
       FROM "TenantInvites"
       WHERE "TokenHash" = $1
       FOR UPDATE`,
      [tokenHash]
    );

    const invite = locked.rows[0];
    if (!invite) {
      throw new AcceptInviteError("INVITE_INVALID", "Invito non valido o scaduto");
    }
    if (invite.UsedAt != null) {
      throw new AcceptInviteError("INVITE_INVALID", "Invito non valido o scaduto");
    }
    const expiresAt = new Date(invite.ExpiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      throw new AcceptInviteError("INVITE_INVALID", "Invito non valido o scaduto");
    }

    const tenantId = String(invite.TenantId);
    const email = String(invite.Email || "").trim().toLowerCase();
    const role = String(invite.Role || "ADMIN").trim().toUpperCase() || "ADMIN";
    if (!email) {
      throw new AcceptInviteError("INVITE_INVALID", "Invito non valido o scaduto");
    }

    const existing = await q(
      `SELECT "Id" FROM "Users"
       WHERE "TenantId" = $1::uuid AND lower("Email") = lower($2)
       LIMIT 1`,
      [tenantId, email]
    );
    if (existing.rows[0]) {
      throw new AcceptInviteError(
        "USER_EXISTS",
        "Account già esistente per questo invito"
      );
    }

    const consumed = await q(
      `UPDATE "TenantInvites"
       SET "UsedAt" = now()
       WHERE "Id" = $1::uuid AND "UsedAt" IS NULL`,
      [String(invite.Id)]
    );
    if (consumed.rowCount !== 1) {
      throw new AcceptInviteError("INVITE_INVALID", "Invito non valido o scaduto");
    }

    const userId = randomUUID();
    await q(
      `INSERT INTO "Users" (
         "Id", "TenantId", "Email", "Name", "PasswordHash", "PasswordChangedAt", "Role",
         "Active", "FormazioneOnly", "PostazioneFissa", "CondizioneEconomica",
         "ConsulenteEsterno", "CreditCalcEnabled", "CreatedAt"
       ) VALUES (
         $1::uuid, $2::uuid, lower($3), $4, $5, now(), $6,
         true, false, false, 'NESSUNA', false, false, now()
       )`,
      [userId, tenantId, email, "Amministratore", passwordHash, role]
    );

    return { userId, tenantId, email, role };
  });
}
