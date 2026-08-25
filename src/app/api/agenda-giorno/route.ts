import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { can, isManutenzione } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { praticaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { parseDataAgenda, formatDataAgenda } from "@/lib/agendaVista";

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (isManutenzione(user) || !can(user, "agenda:view")) {
    return NextResponse.json({ data: formatDataAgenda(new Date()), voci: [] });
  }

  const baseScope = await praticaScopeWhere(user);

  const url = new URL(req.url);
  const giorno = parseDataAgenda(url.searchParams.get("data"));
  const start = new Date(giorno);
  start.setHours(0, 0, 0, 0);
  const end = new Date(giorno);
  end.setHours(23, 59, 59, 999);

  const [pratiche, impegni] = await Promise.all([
    prisma.pratica.findMany({
      where: {
        AND: [baseScope, { memoAt: { gte: start, lte: end } }],
      },
      include: { debitore: true, assegnatario: { select: { name: true } } },
      orderBy: { memoAt: "asc" },
      take: 100,
    }),
    prisma.impegnoAgenda.findMany({
      where: {
        userId: user.id,
        completato: false,
        memoAt: { gte: start, lte: end },
      },
      orderBy: { memoAt: "asc" },
      take: 100,
    }),
  ]);

  const voci = [
    ...pratiche.map((p) => ({
      kind: "pratica" as const,
      id: p.id,
      memoAt: p.memoAt!.toISOString(),
      label: `${p.numero} · ${p.debitore.nome} ${p.debitore.cognome}`,
      dettaglio: p.assegnatario?.name ? `Affidata a: ${p.assegnatario.name}` : null,
    })),
    ...impegni.map((i) => ({
      kind: "libero" as const,
      id: i.id,
      memoAt: i.memoAt.toISOString(),
      label: i.titolo,
      dettaglio: i.nota,
    })),
  ].sort((a, b) => new Date(a.memoAt).getTime() - new Date(b.memoAt).getTime());

  return NextResponse.json({
    data: formatDataAgenda(giorno),
    voci,
  });
}
