import { NextResponse } from "next/server";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { requireApiUser } from "@/lib/guard";
import { canAccessPratica } from "@/lib/domain";
import { loadPraticaNote } from "@/lib/praticaNoteLoad";

export const dynamic = "force-dynamic";

/** Connector/Firestore possono restituire Date o già stringhe ISO. */
function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string") return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toIsoRequired(value: unknown): string {
  return toIso(value) ?? new Date(0).toISOString();
}

/** Dati secondari scheda pratica (note, contabile) — caricati dopo il first paint. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  const praticaModel = praticaDbFromUser(user);

  const { id } = await ctx.params;
  if (!(await canAccessPratica(user, id))) {
    return NextResponse.json({ error: "Pratica non visibile" }, { status: 404 });
  }

  const [attivita, pratica] = await Promise.all([
    loadPraticaNote(user, id),
    praticaModel.findUnique({
      where: { id },
      select: {
        id: true,
        incassi: {
          include: { user: { select: { name: true } } },
          orderBy: { data: "desc" },
        },
        fatture: { orderBy: { dataScadenza: "asc" } },
        documenti: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
  ]);
  if (!pratica) {
    return NextResponse.json({ error: "Pratica non trovata" }, { status: 404 });
  }

  const incassi = Array.isArray(pratica.incassi) ? pratica.incassi : [];
  const fatture = Array.isArray(pratica.fatture) ? pratica.fatture : [];

  return NextResponse.json(
    {
      attivita,
      incassi: incassi.map((i) => {
        const row = i as Record<string, unknown> & {
          user?: { name?: string | null } | null;
          userName?: string | null;
        };
        return {
          ...i,
          data: toIsoRequired(row.data),
          dataScadenza: toIso(row.dataScadenza),
          user: row.user?.name || row.userName
            ? { name: String(row.user?.name || row.userName) }
            : null,
        };
      }),
      fatture: fatture.map((f) => {
        const row = f as Record<string, unknown>;
        return {
          ...f,
          dataFattura: toIsoRequired(row.dataFattura),
          dataScadenza: toIsoRequired(row.dataScadenza),
        };
      }),
      documenti: pratica.documenti ?? [],
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
