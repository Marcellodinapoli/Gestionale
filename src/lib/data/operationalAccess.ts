import "server-only";
import { getDatabaseProvider } from "@/lib/data/config";
import {
  getTenantsRepository,
  getUsersRepository,
  isConnectorProvider,
} from "@/lib/data/factory";
import { postazioniDb } from "@/lib/postazioniRepo";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/permissions";

export type AuthTenant = {
  id: string;
  slug: string;
  nome: string;
  active: boolean;
};

export type AuthUser = {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  formazioneOnly: boolean;
  supervisorId: string | null;
  postazioneId: string | null;
  postazioneFissa: boolean;
  sedeId: string | null;
  interno: string | null;
  prefissoChiamata: string | null;
  passwordChangedAt: Date | null;
};

export type AuthSessionUser = AuthUser & {
  tenantSlug: string;
  tenantNome: string;
  postazioneInterno: string | null;
  postazioneEmail: string | null;
  postazioneNome: string | null;
  sedeNome: string | null;
};

export async function findTenantBySlug(slug: string): Promise<AuthTenant | null> {
  if (isConnectorProvider()) {
    const tenant = await getTenantsRepository().getBySlug(slug);
    if (!tenant) return null;
    return tenant;
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    nome: tenant.nome,
    active: tenant.active !== false,
  };
}

export async function findTenantById(id: string): Promise<AuthTenant | null> {
  if (isConnectorProvider()) {
    const tenant = await getTenantsRepository().getById(id);
    if (!tenant) return null;
    return tenant;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) return null;
  return {
    id: tenant.id,
    slug: tenant.slug,
    nome: tenant.nome,
    active: tenant.active !== false,
  };
}

export async function findUserAuditContext(
  userId: string
): Promise<{ tenantId: string; tenantSlug: string } | null> {
  if (isConnectorProvider()) {
    return getUsersRepository().getAuditContext(userId);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, tenant: { select: { slug: true } } },
  });
  if (!user?.tenantId || !user.tenant?.slug) return null;
  return { tenantId: user.tenantId, tenantSlug: user.tenant.slug };
}

export async function findUserByEmail(
  tenantId: string,
  email: string
): Promise<AuthUser | null> {
  if (isConnectorProvider()) {
    const user = await getUsersRepository().findByEmail(tenantId, email);
    if (!user || !user.passwordHash) return null;
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      role: user.role as Role,
      active: user.active,
      formazioneOnly: Boolean(user.formazioneOnly),
      supervisorId: user.supervisorId ?? null,
      postazioneId: user.postazioneId ?? null,
      postazioneFissa: Boolean(user.postazioneFissa),
      sedeId: user.sedeId ?? null,
      interno: user.interno ?? null,
      prefissoChiamata: user.prefissoChiamata ?? null,
      passwordChangedAt: user.passwordChangedAt
        ? new Date(user.passwordChangedAt)
        : null,
    };
  }
  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (!user) return null;
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    passwordHash: String(user.passwordHash || ""),
    role: user.role as Role,
    active: user.active !== false,
    formazioneOnly: Boolean(user.formazioneOnly),
    supervisorId: user.supervisorId,
    postazioneId: user.postazioneId,
    postazioneFissa: Boolean(user.postazioneFissa),
    sedeId: user.sedeId,
    interno: user.interno,
    prefissoChiamata: user.prefissoChiamata,
    passwordChangedAt: user.passwordChangedAt,
  };
}

export async function findActivePostazione(
  tenantId: string,
  postazioneId: string,
  tenantSlug?: string
) {
  return postazioniDb({ tenantId, tenantSlug: tenantSlug ?? tenantId }).findFirst({
    where: { id: postazioneId, tenantId, active: true },
  });
}

export async function updateUserLogin(
  userId: string,
  data: {
    lastLoginAt: Date;
    postazioneId?: string | null;
    postazioneFissa?: boolean;
  }
) {
  if (isConnectorProvider()) {
    await getUsersRepository().updateLogin(userId, data);
    return;
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: data.lastLoginAt,
      ...(data.postazioneId !== undefined ? { postazioneId: data.postazioneId } : {}),
      ...(data.postazioneFissa !== undefined ? { postazioneFissa: data.postazioneFissa } : {}),
    },
  });
}

export async function loadSessionUser(
  userId: string,
  tenantId?: string
): Promise<AuthSessionUser | null> {
  if (isConnectorProvider()) {
    if (!tenantId) return null;
    const user = await getUsersRepository().getSession(tenantId, userId);
    if (!user || !user.active || !user.tenantActive) return null;
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash ?? "",
      role: user.role as Role,
      active: user.active,
      formazioneOnly: Boolean(user.formazioneOnly),
      supervisorId: user.supervisorId ?? null,
      postazioneId: user.postazioneId ?? null,
      postazioneFissa: Boolean(user.postazioneFissa),
      sedeId: user.sedeId ?? null,
      interno: user.interno?.trim() || user.postazioneInterno?.trim() || null,
      prefissoChiamata: user.prefissoChiamata?.trim() || null,
      passwordChangedAt: user.passwordChangedAt
        ? new Date(user.passwordChangedAt)
        : null,
      tenantSlug: user.tenantSlug,
      tenantNome: user.tenantNome,
      postazioneInterno: user.postazioneInterno ?? null,
      postazioneEmail: user.postazioneEmail ?? null,
      postazioneNome: user.postazioneNome ?? null,
      sedeNome: user.sedeNome ?? null,
    };
  }

  const user = await prisma.user.findFirst({
    where: tenantId ? { id: userId, tenantId } : { id: userId },
    include: {
      tenant: { select: { id: true, slug: true, nome: true, active: true } },
      postazione: { select: { interno: true, email: true, nome: true } },
      sede: { select: { id: true, nome: true } },
    },
  });
  if (!user || user.active === false || user.tenant?.active === false) return null;

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
    passwordHash: String(user.passwordHash || ""),
    role: user.role as Role,
    active: true,
    formazioneOnly: Boolean(user.formazioneOnly),
    supervisorId: user.supervisorId,
    postazioneId: user.postazioneId,
    postazioneFissa: Boolean(user.postazioneFissa),
    sedeId: user.sedeId,
    interno: user.interno?.trim() || user.postazione?.interno || null,
    prefissoChiamata: user.prefissoChiamata?.trim() || null,
    passwordChangedAt: user.passwordChangedAt,
    tenantSlug: user.tenant.slug,
    tenantNome: user.tenant.nome,
    postazioneInterno: user.postazione?.interno ?? null,
    postazioneEmail: user.postazione?.email ?? null,
    postazioneNome: user.postazione?.nome ?? null,
    sedeNome: user.sede?.nome ?? null,
  };
}

export function describeOperationalDataAccess() {
  return {
    provider: getDatabaseProvider(),
    authViaConnector: isConnectorProvider(),
  };
}
