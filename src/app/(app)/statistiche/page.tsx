import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { dataIt } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import { isManutenzione, canViewRicaviIncassiAzienda } from "@/lib/permissions";
import {
  buildStatisticheGruppo,
  completaSezioniPerimetriConfigurate,
  parseLottiFiltro,
} from "@/lib/statisticheGruppo";
import { elencoPerimetriGruppoConfig } from "@/lib/affidiPerimetro";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import { PageHeader } from "@/components/ui";
import { StatisticheGriglia } from "@/components/statistiche/StatisticheGriglia";
import { StatisticheFiltriForm } from "@/components/statistiche/StatisticheFiltriForm";

function defaultAffidoDa() {
  return "2026-08-04";
}

function defaultAffidoA() {
  return "2026-08-31";
}

function parseDateInput(value?: string | null) {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function StatistichePage({
  searchParams,
}: {
  searchParams: Promise<{
    affidoDa?: string;
    affidoA?: string;
    mandanteId?: string;
    lotto?: string;
    gruppo?: string;
  }>;
}) {
  const user = await requirePermission("statistiche:view");
  const sp = await searchParams;
  const affidoDaStr = sp.affidoDa || defaultAffidoDa();
  const affidoAStr = sp.affidoA || defaultAffidoA();
  const affidoDa = parseDateInput(affidoDaStr);
  const affidoA = parseDateInput(affidoAStr);
  if (affidoA) affidoA.setHours(23, 59, 59, 999);

  const lottiSelezionati = parseLottiFiltro(sp.lotto);

  const canFilterGruppo = ["ADMIN", "AMMINISTRAZIONE"].includes(user.role);
  const supervisori = canFilterGruppo
    ? await prisma.user.findMany({
        where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, gruppoNome: true },
      })
    : [];

  const tutteLePratiche = user.role === "ADMIN" && canFilterGruppo && !sp.gruppo;
  /** AMMINISTRAZIONE: obbligo gruppo (default primo supervisor), no vista tutta l'azienda. */
  const gruppoIdEffettivo =
    sp.gruppo || (user.role === "AMMINISTRAZIONE" ? supervisori[0]?.id : undefined);

  let gruppo: Awaited<ReturnType<typeof getGruppoLavoro>>;

  if (canFilterGruppo && gruppoIdEffettivo) {
    const supId = gruppoIdEffettivo;
    const operators = await prisma.user.findMany({
      where: { tenantId: user.tenantId, supervisorId: supId, active: true, role: "OPERATOR" },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });
    const sup = await prisma.user.findFirst({
      where: { id: supId, tenantId: user.tenantId },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        gruppoNome: true,
        gruppoMandanti: true,
      },
    });
    const members = [
      ...(sup ? [{ id: sup.id, name: sup.name, role: sup.role, email: sup.email }] : []),
      ...operators,
    ];
    gruppo = {
      supervisorId: supId,
      supervisorName: sup?.name ?? null,
      gruppoNome: sup?.gruppoNome ?? null,
      gruppoMandanti: parseGruppoMandanti(sup?.gruppoMandanti),
      members,
      memberIds: members.map((m) => m.id),
    };
  } else if (tutteLePratiche) {
    const allOps = await prisma.user.findMany({
      where: { tenantId: user.tenantId, role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });
    gruppo = {
      supervisorId: null,
      supervisorName: null,
      gruppoNome: null,
      gruppoMandanti: [],
      members: allOps,
      memberIds: allOps.map((o) => o.id),
    };
  } else {
    gruppo = await getGruppoLavoro(user);
  }

  /** Operatore/supervisor (e admin su un gruppo): solo perimetri del gruppo; sempre tutti i membri. */
  const usaPerimetriGruppo = !tutteLePratiche;

  let periScope: Prisma.PraticaWhereInput | null = null;
  let nessunPerimetroGruppo = false;
  if (usaPerimetriGruppo) {
    if (!gruppo.gruppoMandanti.length) {
      nessunPerimetroGruppo = true;
    } else {
      periScope = await gruppoPerimetroScopeWhere(user.tenantId, gruppo.gruppoMandanti);
      if (!periScope) nessunPerimetroGruppo = true;
    }
  }

  const mandantiAll = isManutenzione(user)
    ? []
    : await prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
      });

  const mandantiOptions = mandantiAll.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetriList(m.perimetri),
  }));

  const mandanti =
    usaPerimetriGruppo && gruppo.gruppoMandanti.length
      ? mandantiAll.filter((m) =>
          gruppo.gruppoMandanti.some((a) => a.mandanteId === m.id)
        )
      : mandantiAll;

  const perimetriConfig = usaPerimetriGruppo
    ? elencoPerimetriGruppoConfig(gruppo.gruppoMandanti, mandantiOptions)
    : [];

  const scopeMembri: Prisma.PraticaWhereInput = {
    assegnatarioId: { in: gruppo.memberIds },
  };

  const scopeBase: Prisma.PraticaWhereInput = tutteLePratiche
    ? { tenantId: user.tenantId }
    : nessunPerimetroGruppo
      ? { id: "__nessun-perimetro-gruppo__" }
      : { AND: [scopeMembri, periScope!] };

  // Lotti disponibili: solo perimetri del gruppo (in lavorazione)
  const lottiRows = isManutenzione(user) || nessunPerimetroGruppo
    ? []
    : await prisma.pratica.findMany({
        where: {
          ...scopeBase,
          stato: { notIn: [...STATI_PRATICA_CHIUSA] },
          ...(sp.mandanteId ? { mandanteId: sp.mandanteId } : {}),
          ...(affidoDa || affidoA
            ? {
                dataAffido: {
                  ...(affidoDa ? { gte: affidoDa } : {}),
                  ...(affidoA ? { lte: affidoA } : {}),
                },
              }
            : {}),
          numeroMandante: { not: null },
        },
        select: { numeroMandante: true },
        distinct: ["numeroMandante"],
        orderBy: { numeroMandante: "asc" },
      });

  const lottiDisponibili = isManutenzione(user) || nessunPerimetroGruppo
    ? []
    : perimetriConfig.length
      ? perimetriConfig.map((p) => p.perimetro).filter((p) => p !== "—")
      : [
          ...new Set(
            lottiRows
              .map((r) => r.numeroMandante?.trim())
              .filter((x): x is string => Boolean(x))
          ),
        ].sort((a, b) => a.localeCompare(b, "it"));

  const { sezioni: sezioniRaw, totale, praticheCount } = await buildStatisticheGruppo(
    gruppo,
    {
      affidoDa,
      affidoA,
      mandanteId: sp.mandanteId,
      lotti: lottiSelezionati,
    },
    tutteLePratiche
      ? { tenantId: user.tenantId, tutteLePratiche: true }
      : {
          extraWhere: periScope,
          richiedePerimetriGruppo: true,
        }
  );

  const sezioni = completaSezioniPerimetriConfigurate(sezioniRaw, perimetriConfig);

  const operatoriGruppo = gruppo.members.filter((m) => m.role === "OPERATOR");
  const subtitle = canFilterGruppo
    ? sp.gruppo || user.role === "AMMINISTRAZIONE"
      ? `Gruppo di ${gruppo.supervisorName || "—"} · ${operatoriGruppo.map((m) => m.name).join(", ") || "nessun operatore"}`
      : "Tutti i gruppi"
    : gruppo.supervisorName
      ? `Gruppo di ${gruppo.supervisorName} · ${operatoriGruppo.map((m) => m.name).join(", ") || gruppo.members.map((m) => m.name).join(", ")}`
      : `Gruppo · ${user.name}`;

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-2">
      <PageHeader title="Statistiche" subtitle={subtitle} />

      <Suspense fallback={null}>
        <StatisticheFiltriForm
          mandanti={mandanti}
          lottiDisponibili={lottiDisponibili}
          affidoDa={affidoDaStr}
          affidoA={affidoAStr}
          mandanteId={sp.mandanteId}
          lottiSelezionati={lottiSelezionati}
          gruppoId={gruppoIdEffettivo}
          supervisori={supervisori}
          consentiTuttiGruppi={user.role === "ADMIN"}
        />
      </Suspense>

      {nessunPerimetroGruppo ? (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          Nessun perimetro impostato sul gruppo. Configuralo in Affidi per vedere le
          statistiche di tutti gli operatori del gruppo.
        </p>
      ) : sezioni.length ? (
        <StatisticheGriglia
          sezioni={sezioni}
          totale={totale}
          dataReport={dataIt(new Date())}
          affidoDa={affidoDa ? dataIt(affidoDa) : affidoDaStr}
          affidoA={affidoA ? dataIt(affidoA) : affidoAStr}
          mostraTotaliAzienda={canViewRicaviIncassiAzienda(user)}
        />
      ) : (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          Nessuna pratica nel periodo e nei filtri selezionati (perimetri del gruppo ·
          tutti gli operatori).
        </p>
      )}
    </div>
  );
}
