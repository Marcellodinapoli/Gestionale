import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AssignPraticaInput,
  PraticaCreateInput,
  PraticaListFilter,
  PraticaListRequest,
  PraticaScope,
  PraticaUpdateInput,
  PraticheRepository,
} from "../contracts/pratiche";

export class PrismaPraticheRepository implements PraticheRepository {
  async getById(_tenantSlug: string, _tenantId: string, id: string, include?: PraticaListRequest["include"]) {
    const inc = buildPrismaInclude(include);
    return prisma.pratica.findUnique({ where: { id }, include: inc }) as Promise<Record<string, unknown> | null>;
  }

  async list(_req: PraticaListRequest): Promise<import("../contracts/pratiche").PraticaListResult> {
    throw new Error("use praticaDb().findMany in firestore mode");
  }

  async count(
    _req: Omit<PraticaListRequest, "page" | "pageSize" | "skip" | "take" | "sort" | "include">
  ): Promise<number> {
    throw new Error("use praticaDb().count in firestore mode");
  }

  async groupByNumeroMandante(
    _tenantSlug: string,
    _scope: PraticaScope,
    _filter?: PraticaListFilter
  ): Promise<Array<{ numeroMandante: string | null }>> {
    throw new Error("use praticaDb().groupBy in firestore mode");
  }

  async idsAffidoTemporaneo(_tenantSlug: string, tenantId: string) {
    const rows = await prisma.pratica.findMany({
      where: { tenantId, assegnatarioId: { not: null }, operatoreTitolareId: { not: null } },
      select: { id: true, assegnatarioId: true, operatoreTitolareId: true },
    });
    return rows
      .filter((r) => r.assegnatarioId && r.operatoreTitolareId && r.assegnatarioId !== r.operatoreTitolareId)
      .map((r) => r.id);
  }

  async idsImportoTotale(_tenantSlug: string, tenantId: string, da?: number, a?: number) {
    const rows = await prisma.pratica.findMany({
      where: { tenantId },
      select: { id: true, capitale: true, interessi: true, spese: true },
    });
    return rows
      .filter((r) => {
        const tot = (r.capitale || 0) + (r.interessi || 0) + (r.spese || 0);
        if (da != null && tot < da) return false;
        if (a != null && tot > a) return false;
        return true;
      })
      .map((r) => r.id);
  }

  async idsTotIncassato(_tenantSlug: string, tenantId: string, da?: number, a?: number) {
    const pratiche = await prisma.pratica.findMany({ where: { tenantId }, select: { id: true } });
    const incassi = await prisma.incasso.findMany({
      where: { pratica: { tenantId } },
      select: { praticaId: true, importo: true },
    });
    const sumBy = new Map<string, number>();
    for (const i of incassi) sumBy.set(i.praticaId, (sumBy.get(i.praticaId) || 0) + (i.importo || 0));
    return pratiche
      .filter((p) => {
        const tot = sumBy.get(p.id) || 0;
        if (da != null && tot < da) return false;
        if (a != null && tot > a) return false;
        return true;
      })
      .map((p) => p.id);
  }

  async nextNumero(_tenantSlug: string, tenantId: string) {
    const last = await prisma.pratica.findFirst({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: { numero: true },
    });
    const year = new Date().getFullYear();
    const match = last?.numero?.match(/(\d+)$/);
    const n = match ? Number(match[1]) + 1 : 1;
    return `PRC-${year}-${String(n).padStart(4, "0")}`;
  }

  async create(_tenantSlug: string, data: PraticaCreateInput) {
    return prisma.pratica.create({ data: data as unknown as Prisma.PraticaCreateInput }) as Promise<
      Record<string, unknown>
    >;
  }

  async update(_tenantSlug: string, _tenantId: string, id: string, data: PraticaUpdateInput) {
    return prisma.pratica.update({ where: { id }, data: data as Prisma.PraticaUpdateInput }) as Promise<
      Record<string, unknown>
    >;
  }

  async delete(_tenantSlug: string, _tenantId: string, id: string) {
    await prisma.pratica.delete({ where: { id } });
  }

  async assign(_tenantSlug: string, _tenantId: string, id: string, input: AssignPraticaInput) {
    const pratica = await prisma.pratica.findUnique({ where: { id } });
    if (!pratica) throw new Error("Pratica non trovata");
    if (input.tipo === "ripristina") {
      await prisma.pratica.update({ where: { id }, data: { assegnatarioId: input.titolareId ?? null } });
    } else if (input.tipo === "unassign") {
      await prisma.pratica.update({
        where: { id },
        data: { assegnatarioId: null, operatoreTitolareId: null, stato: "NUOVA" },
      });
    } else if (input.tipo === "temporaneo") {
      await prisma.pratica.update({
        where: { id },
        data: {
          assegnatarioId: input.assegnatarioId ?? null,
          operatoreTitolareId: input.titolareId ?? null,
          stato: pratica.stato === "NUOVA" ? "AFFIDATA" : pratica.stato,
        },
      });
    } else {
      await prisma.pratica.update({
        where: { id },
        data: {
          assegnatarioId: input.assegnatarioId ?? null,
          operatoreTitolareId: input.assegnatarioId ?? null,
          stato: pratica.stato === "NUOVA" ? "AFFIDATA" : pratica.stato,
        },
      });
    }
  }

  async updateStato(_tenantSlug: string, _tenantId: string, id: string, stato: string, promessaAt?: Date | null) {
    await prisma.pratica.update({
      where: { id },
      data: { stato, ...(promessaAt !== undefined ? { promessaAt } : {}) },
    });
  }

  async canAccess(): Promise<boolean> {
    throw new Error("use domain.canAccessPratica in firestore mode");
  }
}

function buildPrismaInclude(include?: PraticaListRequest["include"]) {
  if (!include?.length) return undefined;
  const inc: Record<string, unknown> = {};
  if (include.includes("debitore") || include.includes("debitoreRecapiti")) {
    inc.debitore = include.includes("debitoreRecapiti")
      ? { include: { recapiti: { orderBy: [{ tipo: "asc" }, { ordine: "asc" }] } } }
      : true;
  }
  if (include.includes("mandante")) inc.mandante = true;
  if (include.includes("assegnatario")) inc.assegnatario = { select: { name: true } };
  if (include.includes("rate")) inc.rate = { orderBy: { numeroRata: "asc" } };
  if (include.includes("incassi")) {
    inc.incassi = include.includes("incassiUser")
      ? { include: { user: { select: { name: true } } } }
      : true;
  }
  if (include.includes("garanti")) {
    inc.garanti = {
      orderBy: { ordine: "asc" },
      ...(include.includes("garantiRecapiti") ? { include: { recapiti: true } } : {}),
    };
  }
  if (include.includes("attivita")) {
    inc.attivita = { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } };
  }
  if (include.includes("fatture")) inc.fatture = true;
  if (include.includes("documenti")) inc.documenti = { take: 50 };
  if (include.includes("importBatch")) {
    inc.importBatch = { select: { id: true, perimetro: true, lotto: true, affidoIl: true } };
  }
  return inc;
}

export const prismaPraticheRepository = new PrismaPraticheRepository();
