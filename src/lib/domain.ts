import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import {
  type FiltroCollegata,
  praticaMatchFiltro,
} from "@/lib/praticaCollegata";

/** Filtro che non restituisce mai record: account manutenzione vede la UI senza dati. */
export function nessunDatoWhere() {
  return { id: "__nessun-dato__" };
}

export function praticaWhere(user: SessionUser): Prisma.PraticaWhereInput {
  if (isManutenzione(user)) return nessunDatoWhere();
  const tenantScope: Prisma.PraticaWhereInput = { tenantId: user.tenantId };
  if (user.role === "ADMIN" || user.role === "BACK_OFFICE" || user.role === "AMMINISTRAZIONE") {
    return tenantScope;
  }
  if (user.role === "OPERATOR") {
    return {
      AND: [
        tenantScope,
        { OR: [{ assegnatarioId: user.id }, { operatoreTitolareId: user.id }] },
      ],
    };
  }
  if (user.role === "SUPERVISOR") {
    return {
      AND: [
        tenantScope,
        {
          OR: [
            { assegnatarioId: user.id },
            { assegnatario: { supervisorId: user.id } },
            { operatoreTitolareId: user.id },
            { operatoreTitolare: { supervisorId: user.id } },
            { assegnatarioId: null },
          ],
        },
      ],
    };
  }
  return {
    AND: [
      tenantScope,
      {
        OR: [
          { assegnatarioId: user.id },
          { assegnatario: { supervisorId: user.id } },
          { operatoreTitolareId: user.id },
          { operatoreTitolare: { supervisorId: user.id } },
        ],
      },
    ],
  };
}

export function normalizeCf(value?: string | null) {
  return (value || "").replace(/[\s]/g, "").toUpperCase();
}

export async function debitoreIdsStessoCf(
  codiceFiscale: string | null | undefined,
  fallbackId: string,
  tenantId?: string
) {
  const cf = normalizeCf(codiceFiscale);
  if (!cf) return [fallbackId];
  const rows = await prisma.debitore.findMany({
    where: {
      codiceFiscale: { not: null },
      ...(tenantId ? { tenantId } : {}),
    },
    select: { id: true, codiceFiscale: true },
  });
  const ids = rows
    .filter((r) => normalizeCf(r.codiceFiscale) === cf)
    .map((r) => r.id);
  if (!ids.includes(fallbackId)) ids.push(fallbackId);
  return ids;
}

export async function praticaIdsCollegatePerCf(
  praticaId: string,
  opts?: { stessoMandante?: boolean }
) {
  const stessoMandante = opts?.stessoMandante ?? true;
  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: {
      id: true,
      tenantId: true,
      mandanteId: true,
      debitore: { select: { codiceFiscale: true } },
      garanti: { select: { codiceFiscale: true } },
    },
  });
  if (!pratica) return [];

  const cfs = new Set<string>();
  const cfDebitore = normalizeCf(pratica.debitore.codiceFiscale);
  if (cfDebitore) cfs.add(cfDebitore);
  for (const g of pratica.garanti) {
    const cf = normalizeCf(g.codiceFiscale);
    if (cf) cfs.add(cf);
  }

  if (!cfs.size) return [pratica.id];

  const [debitori, garanti] = await Promise.all([
    prisma.debitore.findMany({
      where: { tenantId: pratica.tenantId, codiceFiscale: { not: null } },
      select: { id: true, codiceFiscale: true },
    }),
    prisma.garante.findMany({
      where: {
        codiceFiscale: { not: null },
        pratica: { tenantId: pratica.tenantId },
      },
      select: { praticaId: true, codiceFiscale: true },
    }),
  ]);

  const debitoreIds = debitori
    .filter((d) => cfs.has(normalizeCf(d.codiceFiscale)))
    .map((d) => d.id);
  const daGarante = garanti
    .filter((g) => cfs.has(normalizeCf(g.codiceFiscale)))
    .map((g) => g.praticaId);

  const or: Prisma.PraticaWhereInput[] = [{ id: pratica.id }];
  if (debitoreIds.length) or.push({ debitoreId: { in: debitoreIds } });
  if (daGarante.length) or.push({ id: { in: daGarante } });

  const rows = await prisma.pratica.findMany({
    where: {
      tenantId: pratica.tenantId,
      ...(stessoMandante ? { mandanteId: pratica.mandanteId } : {}),
      OR: or,
    },
    select: { id: true },
    orderBy: { numero: "asc" },
  });
  return rows.map((r) => r.id);
}

export async function praticheStessoDebitoreIds(
  praticaId: string,
  filtro: FiltroCollegata
) {
  const ids = await praticaIdsCollegatePerCf(praticaId, {
    stessoMandante: filtro === "aperta",
  });
  if (!ids.length) return [];

  const rows = await prisma.pratica.findMany({
    where: { id: { in: ids } },
    select: { id: true, stato: true },
    orderBy: { numero: "asc" },
  });

  return rows
    .filter((p) => praticaMatchFiltro(p.stato, filtro))
    .map((p) => p.id);
}

export async function canAccessPratica(user: SessionUser, praticaId: string) {
  const found = await prisma.pratica.findFirst({
    where: { id: praticaId, AND: [praticaWhere(user)] },
    select: { id: true },
  });
  if (found) return true;

  const collegataIds = await praticaIdsCollegatePerCf(praticaId, {
    stessoMandante: false,
  });
  if (collegataIds.length < 2) return false;

  const sibling = await prisma.pratica.findFirst({
    where: {
      id: { in: collegataIds },
      AND: [praticaWhere(user)],
    },
    select: { id: true },
  });
  return Boolean(sibling);
}

export async function writeAudit(input: {
  userId?: string | null;
  tenantId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  dettaglio?: string | null;
}) {
  let tenantId = input.tenantId || null;
  if (!tenantId && input.userId) {
    const u = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { tenantId: true },
    });
    tenantId = u?.tenantId ?? null;
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: input.userId || null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId || null,
      dettaglio: input.dettaglio || null,
    },
  });
}

export function importoIt(value: number) {
  return (value || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function dataItShort(value?: Date | string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

export function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

export function dateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function datetimeLocalValue(value?: Date | string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

export function dataIt(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function dataOraIt(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ripartiIncasso(
  importo: number,
  pratica: { capitale: number; interessi: number; spese: number },
  giaPagato: { capitale: number; interessi: number; spese: number }
) {
  const speseRes = Math.max(0, pratica.spese - giaPagato.spese);
  const intRes = Math.max(0, pratica.interessi - giaPagato.interessi);
  const capRes = Math.max(0, pratica.capitale - giaPagato.capitale);
  let rest = Math.max(0, importo);
  const spese = Math.min(rest, speseRes);
  rest -= spese;
  const interessi = Math.min(rest, intRes);
  rest -= interessi;
  const capitale = Math.min(rest, capRes);
  return { capitale, interessi, spese, usato: capitale + interessi + spese };
}
