import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { praticaWhere } from "@/lib/domain";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import {
  conteggiVoceLavorazione,
  loadLavorazioneStore,
  voceToPraticheHrefLavorate,
  voceToPraticheHrefTotale,
  type VoceLavorazioneSuggerita,
} from "@/lib/lavorazioneSuggerita";
import { usersDbFromUser } from "@/lib/usersRepo";

export async function POST(req: Request) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  if (!can(user, "lavorazione:view")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  let body: { voce?: VoceLavorazioneSuggerita; supervisorId?: string; dataPiano?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const voce = body.voce;
  const supervisorId = body.supervisorId?.trim();
  const dataPiano = body.dataPiano?.trim() || new Date().toISOString().slice(0, 10);
  if (!voce || !supervisorId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  if (user.role === "SUPERVISOR" && user.id !== supervisorId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const sup = await usersDbFromUser(user).findFirst({
    where: { id: supervisorId, tenantId: user.tenantId, role: "SUPERVISOR", active: true },
    select: { id: true, gruppoMandanti: true },
  });
  if (!sup) {
    return NextResponse.json({ error: "Supervisor non trovato" }, { status: 404 });
  }

  const operatoriGruppo = await usersDbFromUser(user).findMany({
    where: {
      tenantId: user.tenantId,
      supervisorId,
      active: true,
      role: "OPERATOR",
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const memberIds = [supervisorId, ...operatoriGruppo.map((o) => o.id)];
  const gruppoMandanti = parseGruppoMandanti(sup.gruppoMandanti);

  let periScope: Prisma.PraticaWhereInput | null = null;
  if (gruppoMandanti.length) {
    periScope = await gruppoPerimetroScopeWhere(user.tenantId, gruppoMandanti);
  }

  const scopeParts: Prisma.PraticaWhereInput[] = [praticaWhere(user)];
  if (periScope) scopeParts.push(periScope);
  const scope: Prisma.PraticaWhereInput =
    scopeParts.length === 1 ? scopeParts[0]! : { AND: scopeParts };

  const operatoreId = user.role === "OPERATOR" ? user.id : undefined;

  const { store } = await loadLavorazioneStore(supervisorId, user.tenantId);
  const pianoSalvato = store.piani.find((p) => p.data === dataPiano);
  const salvatoAt = pianoSalvato?.salvatoAt;

  const baseOpts = {
    scope,
    memberIds,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    dataPiano,
    salvatoAt,
    operatoreId,
  };

  const { totale, lavorate } = await conteggiVoceLavorazione(voce, {
    ...baseOpts,
    totaleSoloFiltro: !operatoreId,
  });

  const operatori =
    user.role === "OPERATOR"
      ? []
      : await Promise.all(
          operatoriGruppo.map(async (op) => {
            const c = await conteggiVoceLavorazione(voce, {
              ...baseOpts,
              operatoreId: op.id,
            });
            return {
              id: op.id,
              name: op.name,
              totale: c.totale,
              lavorate: c.lavorate,
              hrefTotale: voceToPraticheHrefTotale(voce, dataPiano, op.id),
              hrefLavorate: voceToPraticheHrefLavorate(voce, dataPiano, op.id),
            };
          })
        );

  return NextResponse.json({
    totale,
    lavorate,
    hrefTotale: voceToPraticheHrefTotale(voce, dataPiano, operatoreId),
    hrefLavorate: voceToPraticheHrefLavorate(voce, dataPiano, operatoreId),
    operatori,
  });
}
