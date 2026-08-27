import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";

/** Dati secondari scheda pratica (note, contabile) — caricati dopo il first paint. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Pratica non visibile" }, { status: 404 });
  }

  const pratica = await prisma.pratica.findUnique({
    where: { id },
    select: {
      id: true,
      attivita: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      incassi: {
        include: { user: { select: { name: true } } },
        orderBy: { data: "desc" },
      },
      fatture: { orderBy: { dataScadenza: "asc" } },
      documenti: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!pratica) {
    return NextResponse.json({ error: "Pratica non trovata" }, { status: 404 });
  }

  return NextResponse.json({
    attivita: pratica.attivita.map((a) => ({
      ...a,
      scheduledAt: a.scheduledAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    incassi: pratica.incassi.map((i) => ({
      ...i,
      data: i.data.toISOString(),
      dataScadenza: i.dataScadenza?.toISOString() ?? null,
    })),
    fatture: pratica.fatture.map((f) => ({
      ...f,
      dataFattura: f.dataFattura.toISOString(),
      dataScadenza: f.dataScadenza.toISOString(),
    })),
    documenti: pratica.documenti,
  });
}
