import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role, SessionUser } from "@/lib/permissions";
import { isPasswordExpired } from "@/lib/passwordRules";

const COOKIE = "gestionale_session";

function secret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (value) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return new TextEncoder().encode("dev-only-secret-not-for-prod");
}

function toIsoPasswordChangedAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export type SessionCreateInput = SessionUser & {
  passwordChangedAt?: Date | string | null;
};

export async function createSession(user: SessionCreateInput) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    supervisorId: user.supervisorId,
    tenantId: user.tenantId,
    formazioneOnly: Boolean(user.formazioneOnly),
    // Usato dal middleware per bloccare l'app se la password è scaduta.
    passwordChangedAt: toIsoPasswordChangedAt(user.passwordChangedAt),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Cookie di sessione: a chiusura browser va via → al prossimo accesso serve la password.
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

type SessionUserInternal = SessionUser & {
  passwordChangedAt: Date | string | null;
};

/**
 * Una sola lettura utente per richiesta (layout + page + password check).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret());
    const id = String(payload.id || "");
    if (!id) return null;
    const tenantId = payload.tenantId ? String(payload.tenantId) : undefined;

    const { loadSessionUser } = await import("@/lib/data/operationalAccess");
    const user = await loadSessionUser(id, tenantId);
    if (!user || user.active === false) return null;
    const session: SessionUserInternal = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      supervisorId: user.supervisorId,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      tenantNome: user.tenantNome,
      postazioneId: user.postazioneId,
      postazioneFissa: Boolean(user.postazioneFissa),
      interno: user.interno?.trim() || user.postazioneInterno || null,
      prefissoChiamata: user.prefissoChiamata?.trim() || null,
      postazioneEmail: user.postazioneEmail ?? null,
      postazioneNome: user.postazioneNome ?? null,
      sedeId: user.sedeId,
      sedeNome: user.sedeNome ?? null,
      formazioneOnly: user.formazioneOnly,
      passwordChangedAt: user.passwordChangedAt ?? null,
    };
    return session;
  } catch {
    return null;
  }
});

/** Usa i dati già caricati da getCurrentUser — nessun roundtrip extra. */
export async function isCurrentUserPasswordExpired(): Promise<boolean> {
  const user = (await getCurrentUser()) as SessionUserInternal | null;
  if (!user) return true;
  return isPasswordExpired(user.passwordChangedAt);
}
