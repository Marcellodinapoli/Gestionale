import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessPratica,
  normalizeCf,
  praticaIdsCollegatePerCf,
} from "@/lib/domain";
import { isPraticaChiusa } from "@/lib/praticaCollegata";

function mapVoce(
  p: {
    id: string;
    numero: string;
    stato: string;
    residuo: number;
    scadenza: Date | null;
    updatedAt: Date;
    debitore: { cognome: string; nome: string };
    mandante: { codice: string; ragioneSociale: string };
  },
  cf: string | null
) {
  return {
    id: p.id,
    numero: p.numero,
    nome: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
    cf,
    stato: p.stato,
    mandante: p.mandante.codice,
    mandanteNome: p.mandante.ragioneSociale,
    residuo: p.residuo,
    scadenza: p.scadenza?.toISOString() || null,
    updatedAt: p.updatedAt.toISOString(),
    accessibile: true,
  };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const praticaId = new URL(req.url).searchParams.get("id") || "";
  if (!praticaId) return NextResponse.json({ error: "Pratica mancante" }, { status: 400 });
  if (!(await canAccessPratica(user, praticaId))) {
    return NextResponse.json({ error: "Pratica non visibile" }, { status: 404 });
  }

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    include: { debitore: true, mandante: true },
  });
  if (!pratica) return NextResponse.json({ error: "Pratica non trovata" }, { status: 404 });

  const cf = normalizeCf(pratica.debitore.codiceFiscale) || null;

  const [idsStessoMandante, idsTuttiMandanti] = await Promise.all([
    praticaIdsCollegatePerCf(pratica.id, { stessoMandante: true }),
    praticaIdsCollegatePerCf(pratica.id, { stessoMandante: false }),
  ]);

  const altreIds = idsStessoMandante.filter((id) => id !== pratica.id);
  const chiuseIds = idsTuttiMandanti.filter((id) => id !== pratica.id);
  const fetchIds = [...new Set([...altreIds, ...chiuseIds])];

  const rows = fetchIds.length
    ? await prisma.pratica.findMany({
        where: { id: { in: fetchIds } },
        include: { debitore: true, mandante: true },
        orderBy: { numero: "asc" },
      })
    : [];

  const byId = new Map(rows.map((p) => [p.id, p]));

  // F9: stesso mandante, fase in lavorazione (non chiusa)
  const altre = altreIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .filter((p) => !isPraticaChiusa(p!.stato))
    .map((p) => mapVoce(p!, cf));

  // F10: tutti i mandanti, fase chiusa
  const altreChiuse = chiuseIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .filter((p) => isPraticaChiusa(p!.stato))
    .map((p) => mapVoce(p!, cf));

  return NextResponse.json({
    corrente: mapVoce(pratica, cf),
    altre,
    altreChiuse,
  });
}
