import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { isConnectorProvider } from "@/lib/data/factory";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { euro } from "@/lib/domain";
import { praticaCercaScopeWhere } from "@/lib/gruppoPerimetroScope";
import { STATO_LABELS } from "@/lib/permissions";
import {
  STATO_OPERATIVO_LABELS,
  statoOperativoPratica,
  type StatoOperativo,
} from "@/lib/statoOperativoPratica";
import {
  buildPraticaCercaWhere,
  parseCampoRicercaPratica,
} from "@/lib/praticaCerca";

const LIMIT = 30;

function labelStatoRicerca(p: {
  stato: string;
  assegnatarioId?: string | null;
  scadenza?: Date | string | null;
  codiceScaricoBk?: string | null;
}) {
  const op = statoOperativoPratica({
    stato: p.stato,
    assegnatarioId: p.assegnatarioId,
    scadenza: p.scadenza,
    codiceScaricoBk: p.codiceScaricoBk,
  });
  if (op in STATO_OPERATIVO_LABELS) {
    return STATO_OPERATIVO_LABELS[op as StatoOperativo];
  }
  return STATO_LABELS[op] || STATO_LABELS[p.stato] || op;
}

export async function GET(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const praticaModel = praticaDbFromUser(user);

  const baseScope = await praticaCercaScopeWhere(user);

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const campo = parseCampoRicercaPratica(url.searchParams.get("campo"));

  if (!campo) {
    return NextResponse.json({ error: "Campo ricerca non valido" }, { status: 400 });
  }

  if (q.trim().length < 2) {
    return NextResponse.json({ pratiche: [], total: 0, minChars: 2 });
  }

  const term = q.trim();
  // Connector: sentinel dedicato (evita OR debitore/garante tradotto in AND).
  // Prisma/SQLite: where Prisma classico.
  const filtro = isConnectorProvider()
    ? ({ cercaPratica: { campo, q: term } } as Record<string, unknown>)
    : buildPraticaCercaWhere(campo, term);
  if (!filtro) {
    return NextResponse.json({ pratiche: [], total: 0, minChars: 2 });
  }

  const where = { AND: [baseScope, filtro] };

  const [total, rows] = await Promise.all([
    praticaModel.count({ where }),
    praticaModel.findMany({
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

      const statoOp = statoOperativoPratica({
        stato: p.stato,
        assegnatarioId: p.assegnatarioId,
        scadenza: p.scadenza,
        codiceScaricoBk: p.codiceScaricoBk,
      });

      return {
        id: p.id,
        numero: p.numero,
        debitore: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
        telefono: p.debitore.telefono,
        mandante: p.mandante.codice,
        assegnatario: p.assegnatario?.name || null,
        stato: statoOp,
        statoLabel: labelStatoRicerca(p),
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
