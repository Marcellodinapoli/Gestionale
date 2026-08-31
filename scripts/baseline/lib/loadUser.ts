import type { SessionUser } from "@/lib/permissions";
import { prisma } from "./instrumentedPrisma";

export async function loadSessionUser(
  tenantSlug = "demo",
  email = "admin@gestionale.local"
): Promise<SessionUser> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant non trovato: ${tenantSlug}`);

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    include: {
      tenant: { select: { id: true, slug: true, nome: true, active: true } },
      sede: { select: { id: true, nome: true } },
      postazione: { select: { interno: true, email: true, nome: true } },
    },
  });
  if (!user) throw new Error(`Utente non trovato: ${email}@${tenantSlug}`);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as SessionUser["role"],
    supervisorId: user.supervisorId,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug ?? tenantSlug,
    tenantNome: user.tenant?.nome ?? null,
    postazioneId: user.postazioneId,
    postazioneFissa: Boolean(user.postazioneFissa),
    interno: user.interno?.trim() || user.postazione?.interno || null,
    prefissoChiamata: user.prefissoChiamata?.trim() || null,
    postazioneEmail: user.postazione?.email ?? null,
    postazioneNome: user.postazione?.nome ?? null,
    sedeId: user.sedeId,
    sedeNome: user.sede?.nome ?? null,
    formazioneOnly: user.formazioneOnly,
  };
}

export async function loadFirstPraticaId(tenantId: string): Promise<string | null> {
  const rows = await prisma.pratica.findMany({
    where: { tenantId },
    select: { id: true },
    take: 1,
  });
  return rows[0]?.id ?? null;
}

/** Utenti demo creati da seed-firebase.ts */
export const DEMO_USERS_BY_ROLE: Record<string, string> = {
  ADMIN: "admin@gestionale.local",
  OPERATOR: "operatore@gestionale.local",
  SUPERVISOR: "supervisor@gestionale.local",
  AMMINISTRAZIONE: "amministrazione@gestionale.local",
  BACK_OFFICE: "backoffice@gestionale.local",
};

export async function loadDemoUsersByRole(
  tenantSlug = "demo"
): Promise<Partial<Record<keyof typeof DEMO_USERS_BY_ROLE, SessionUser>>> {
  const out: Partial<Record<keyof typeof DEMO_USERS_BY_ROLE, SessionUser>> = {};
  for (const [role, email] of Object.entries(DEMO_USERS_BY_ROLE)) {
    try {
      out[role as keyof typeof DEMO_USERS_BY_ROLE] = await loadSessionUser(tenantSlug, email);
    } catch {
      /* utente assente nel tenant */
    }
  }
  return out;
}
