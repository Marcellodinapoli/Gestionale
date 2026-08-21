import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { euro, praticaWhere } from "@/lib/domain";
import { STATO_LABELS } from "@/lib/permissions";
import {
  buildPraticaCercaWhere,
  parseCampoRicercaPratica,
} from "@/lib/praticaCerca";

const LIMIT = 30;

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const campo = parseCampoRicercaPratica(url.searchParams.get("campo"));

  if (!campo) {
    return NextResponse.json({ error: "Campo ricerca non valido" }, { status: 400 });
  }

  const filtro = buildPraticaCercaWhere(campo, q);
  if (!filtro) {
    return NextResponse.json({ pratiche: [], total: 0, minChars: 2 });
  }

  const where = { AND: [praticaWhere(user), filtro] };
  const term = q.trim();

  const [total, rows] = await Promise.all([
    prisma.pratica.count({ where }),
    prisma.pratica.findMany({
      where,
      include: {
        debitore: true,
        mandante: { select: { codice: true } },
        assegnatario: { select: { name: true } },
        ...(campo === "note"
          ? {
              attivita: {
                where: { nota: { contains: term } },
                orderBy: { createdAt: "desc" as const },
                take: 1,
                select: { nota: true },
              },
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: LIMIT,
    }),
  ]);

  return NextResponse.json({
    pratiche: rows.map((p) => {
      const attMatch =
        campo === "note" && "attivita" in p && Array.isArray(p.attivita)
          ? p.attivita[0]?.nota
          : null;
      const notaAnteprima =
        attMatch ||
        (campo === "note" && p.note && p.note.includes(term) ? p.note : null);

      return {
        id: p.id,
        numero: p.numero,
        debitore: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
        telefono: p.debitore.telefono,
        mandante: p.mandante.codice,
        assegnatario: p.assegnatario?.name || null,
        stato: p.stato,
        statoLabel: STATO_LABELS[p.stato] || p.stato,
        residuo: p.residuo,
        residuoLabel: euro(p.residuo),
        notaAnteprima: notaAnteprima
          ? notaAnteprima.length > 80
            ? `${notaAnteprima.slice(0, 80)}…`
            : notaAnteprima
          : null,
      };
    }),
    total,
    truncated: total > LIMIT,
  });
}
