import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isManutenzione, type SessionUser } from "@/lib/permissions";
import {
  type FiltroCollegata,
  praticaMatchFiltro,
} from "@/lib/praticaCollegata";

export {
  importoIt,
  dataItShort,
  euro,
  dateInputValue,
  datetimeLocalValue,
  parseDateOnly,
  dataIt,
  dataOraIt,
  ripartiIncasso,
} from "@/lib/domainFormat";

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

/** Varianti CF per query mirata (evita scan dell’intera collection). */
function cfQueryVariants(values: Array<string | null | undefined>) {
  const out = new Set<string>();
  for (const raw of values) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    out.add(trimmed);
    out.add(trimmed.toUpperCase());
    out.add(trimmed.toLowerCase());
    const n = normalizeCf(trimmed);
    if (n) out.add(n);
  }
  return [...out].slice(0, 30);
}

export async function debitoreIdsStessoCf(
  codiceFiscale: string | null | undefined,
  fallbackId: string,
  tenantId?: string
) {
  const cf = normalizeCf(codiceFiscale);
  if (!cf) return [fallbackId];
  const variants = cfQueryVariants([codiceFiscale, cf]);
  const rows = await prisma.debitore.findMany({
    where: {
      codiceFiscale: { in: variants },
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
  opts?: {
    stessoMandante?: boolean;
    /** Evita un secondo findUnique se la pratica è già caricata. */
    seed?: {
      id: string;
      tenantId: string;
      mandanteId: string;
      debitore: { codiceFiscale: string | null };
      garanti?: Array<{ codiceFiscale: string | null }>;
    };
  }
) {
  const stessoMandante = opts?.stessoMandante ?? true;
  const pratica =
    opts?.seed && opts.seed.id === praticaId
      ? opts.seed
      : await prisma.pratica.findUnique({
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

  const rawCfs = [
    pratica.debitore.codiceFiscale,
    ...(pratica.garanti ?? []).map((g) => g.codiceFiscale),
  ];
  const cfs = new Set<string>();
  for (const raw of rawCfs) {
    const cf = normalizeCf(raw);
    if (cf) cfs.add(cf);
  }

  if (!cfs.size) return [pratica.id];

  const variants = cfQueryVariants(rawCfs);

  const [debitori, garanti] = await Promise.all([
    prisma.debitore.findMany({
      where: {
        tenantId: pratica.tenantId,
        codiceFiscale: { in: variants },
      },
      select: { id: true, codiceFiscale: true },
    }),
    prisma.garante.findMany({
      where: { codiceFiscale: { in: variants } },
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
