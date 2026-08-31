import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role, SessionUser } from "@/lib/permissions";
import { isPasswordExpired } from "@/lib/passwordPolicy";

const COOKIE = "gestionale_session";

function secret() {
  const value = process.env.SESSION_SECRET || "dev-only-secret-not-for-prod";
  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    supervisorId: user.supervisorId,
    tenantId: user.tenantId,
    formazioneOnly: Boolean(user.formazioneOnly),
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
    maxAge: 60 * 60 * 12,
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
