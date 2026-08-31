import type { Prisma } from "@prisma/client";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";

export type RegistrazioniFilterOpts = {
  operatore?: string;
  q?: string;
  da?: string;
  a?: string;
};

function createdAtRange(da?: string, a?: string): Prisma.RegistrazioneChiamataWhereInput {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (da) createdAt.gte = new Date(`${da}T00:00:00`);
  if (a) {
    const end = new Date(`${a}T00:00:00`);
    end.setHours(23, 59, 59, 999);
    createdAt.lte = end;
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
}

function searchWhere(query: string): Prisma.RegistrazioneChiamataWhereInput {
  return {
    OR: [
      { pratica: { numero: { contains: query } } },
      { pratica: { debitore: { cognome: { contains: query } } } },
      { pratica: { debitore: { nome: { contains: query } } } },
      { operatore: { name: { contains: query } } },
    ],
  };
}

/** Where per elenco registrazioni in base a ruolo e filtri. */
export async function registrazioniWhere(
  user: SessionUser,
  opts: RegistrazioniFilterOpts & { memberIds?: string[]; externalOperatore?: boolean }
): Promise<Prisma.RegistrazioneChiamataWhereInput> {
  const { operatore, q, da, a, memberIds = [], externalOperatore = false } = opts;
  const query = (q || "").trim();

  const parts: Prisma.RegistrazioneChiamataWhereInput[] = [];

  if (user.role === "BACK_OFFICE") {
    parts.push({ evidenzaBackOffice: true });
  }

  if (operatore) {
    parts.push({ operatoreId: operatore });
    if (user.role === "SUPERVISOR" && externalOperatore) {
      parts.push({ pratica: { tenantId: user.tenantId } });
    } else {
      parts.push({ pratica: await praticaScopeWhere(user) });
    }
  } else if (user.role === "SUPERVISOR" && memberIds.length) {
    parts.push({ operatoreId: { in: memberIds } });
    parts.push({ pratica: await praticaScopeWhere(user) });
  } else {
    parts.push({ pratica: await praticaScopeWhere(user) });
  }

  parts.push(createdAtRange(da, a));
  if (query) parts.push(searchWhere(query));

  return { AND: parts };
}

/** Verifica accesso a una singola registrazione (streaming audio). */
export async function registrazioneAccessible(
  user: SessionUser,
  rec: { operatoreId: string; praticaId: string; pratica: { tenantId: string } }
): Promise<boolean> {
  if (rec.pratica.tenantId !== user.tenantId) return false;

  if (user.role === "BACK_OFFICE" || user.role === "ADMIN" || user.role === "AMMINISTRAZIONE") {
    return true;
  }

  if (user.role === "SUPERVISOR") {
    const gruppo = await getGruppoLavoro(user);
    if (!gruppo.memberIds.includes(rec.operatoreId)) {
      return true;
    }
    const scope = await praticaScopeWhere(user);
    const praticaModel = praticaDbFromUser(user);
    const hit = await praticaModel.findFirst({
      where: { AND: [scope, { id: rec.praticaId }] },
      select: { id: true },
    });
    return Boolean(hit);
  }

  const scope = await praticaScopeWhere(user);
  const praticaModel = praticaDbFromUser(user);
  const hit = await praticaModel.findFirst({
    where: { AND: [scope, { id: rec.praticaId }] },
    select: { id: true },
  });
  return Boolean(hit);
}
