import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Role, SessionUser } from "@/lib/permissions";

const COOKIE = "gestionale_session";
const PASSWORD_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.SESSION_SECRET || "dev-only-secret-not-for-prod";
  return new TextEncoder().encode(value);
}

function passwordExpired(passwordChangedAt: Date | null | undefined) {
  if (!passwordChangedAt) return true;
  return Date.now() - passwordChangedAt.getTime() >= PASSWORD_MAX_AGE_MS;
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
  passwordChangedAt: Date | null;
};

/**
 * Una sola lettura utente per richiesta (layout + page + password check).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = String(payload.id || "");
    if (!id) return null;
    const tenantId = payload.tenantId ? String(payload.tenantId) : undefined;
    const user = await prisma.user.findFirst({
      where: tenantId ? { id, tenantId } : { id },
      include: {
        tenant: { select: { id: true, slug: true, nome: true, active: true } },
        postazione: { select: { interno: true, email: true, nome: true } },
        sede: { select: { id: true, nome: true } },
      },
    });
    if (!user || user.active === false) return null;
    if (user.tenant?.active === false) return null;
    const session: SessionUserInternal = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      supervisorId: user.supervisorId,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      tenantNome: user.tenant.nome,
      postazioneId: user.postazioneId,
      postazioneFissa: Boolean(user.postazioneFissa),
      interno: user.interno?.trim() || user.postazione?.interno || null,
      prefissoChiamata: user.prefissoChiamata?.trim() || null,
      postazioneEmail: user.postazione?.email ?? null,
      postazioneNome: user.postazione?.nome ?? null,
      sedeId: user.sedeId,
      sedeNome: user.sede?.nome ?? null,
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
  return passwordExpired(user.passwordChangedAt);
}
