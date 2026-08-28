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
  allineaTotaleStatistiche,
  parseLottiFiltro,
} from "@/lib/statisticheGruppo";
import { elencoPerimetriGruppoConfig } from "@/lib/affidiPerimetro";
import { parsePerimetriList, acronimoPerimetroLotto } from "@/lib/mandantePerimetri";
import type { LottoPerimetroFiltro } from "@/lib/statisticheGruppoUi";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import { PageHeader } from "@/components/ui";
import { StatisticheGriglia } from "@/components/statistiche/StatisticheGriglia";
import { StatisticheFiltriForm } from "@/components/statistiche/StatisticheFiltriForm";
import {
  MissingSedeBanner,
  RicaviAltreSediNascostiBanner,
} from "@/components/sedi/MissingSedeBanner";
import { SedeRendimentoFilter } from "@/components/sedi/SedeRendimentoFilter";
import {
  canViewRicaviFatturatiSede,
  intersectUserIds,
  sedeScopeForRendimento,
  userIdsInSede,
} from "@/lib/sedeScope";

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
    sede?: string;
  }>;
}) {
  const user = await requirePermission("statistiche:view");
  const sp = await searchParams;
  const affidoDaStr = sp.affidoDa || defaultAffidoDa();
  const affidoAStr = sp.affidoA || defaultAffidoA();
  const affidoDa = parseDateInput(affidoDaStr);
  const affidoA = parseDateInput(affidoAStr);
  if (affidoA) affidoA.setHours(23, 59, 59, 999);

  const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sp.sede);
  const mostraRicavi = canViewRicaviFatturatiSede(user, sedeScopeId);
  const sedeUserIds = await userIdsInSede(user.tenantId, sedeScopeId);
  const sediOpts =
    user.role === "ADMIN" || user.role === "AMMINISTRAZIONE"
      ? await prisma.sede.findMany({
          where: { tenantId: user.tenantId, active: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        })
      : [];

  const lottiSelezionati = parseLottiFiltro(sp.lotto);

  const canFilterGruppo = ["ADMIN", "AMMINISTRAZIONE"].includes(user.role);
  const supervisori = canFilterGruppo
    ? await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          role: "SUPERVISOR",
          active: true,
          ...(sedeScopeId ? { sedeId: sedeScopeId } : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, gruppoNome: true },
      })
    : [];

  const tutteLePratiche =
    (user.role === "ADMIN" || user.role === "AMMINISTRAZIONE") &&
    canFilterGruppo &&
    !sp.gruppo;
  /** Default gruppo solo se Amministrazione non ha scelto "tutti". */
  const gruppoIdEffettivo = sp.gruppo || undefined;

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

  if (sedeUserIds) {
    const filteredIds = intersectUserIds(gruppo.memberIds, sedeUserIds);
    const filteredMembers = gruppo.members.filter((m) => filteredIds.includes(m.id));
    gruppo = {
      ...gruppo,
      members: filteredMembers,
      memberIds: filteredIds,
    };
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
        select: { numeroMandante: true, mandanteId: true },
        distinct: ["mandanteId", "numeroMandante"],
        orderBy: [{ mandanteId: "asc" }, { numeroMandante: "asc" }],
      });

  const importBatches = isManutenzione(user)
    ? []
    : await prisma.importBatch.findMany({
        where: { tenantId: user.tenantId },
        select: { mandanteId: true, lotto: true, perimetro: true },
      });

  const lottoPerimetroByKey = new Map(
    importBatches
      .filter((b) => b.lotto.trim() && b.perimetro.trim())
      .map((b) => [`${b.mandanteId}|${b.lotto.trim()}`, b.perimetro.trim()] as const)
  );

  const mandantePerimetriRaw = new Map(
    mandantiAll.map((m) => [m.id, m.perimetri] as const)
  );

  const lottiOpzioniMap = new Map<string, LottoPerimetroFiltro>();

  const addLottoOpzione = (
    mandanteId: string,
    lotto: string,
    acronimoHint?: string | null,
    force = false
  ) => {
    const value = lotto.trim();
    if (!value) return;
    const chiaveImport = lottoPerimetroByKey.get(`${mandanteId}|${value}`) ?? null;
    const label = acronimoPerimetroLotto(
      mandantePerimetriRaw.get(mandanteId) ?? null,
      value,
      chiaveImport,
      acronimoHint
    );
    const prev = lottiOpzioniMap.get(value);
    if (prev && !force && prev.label !== value) return;
    lottiOpzioniMap.set(value, {
      value,
      label,
      title: label !== value ? `Lotto mandante ${value}` : undefined,
    });
  };

  if (!isManutenzione(user) && !nessunPerimetroGruppo) {
    for (const row of lottiRows) {
      const lotto = row.numeroMandante?.trim();
      if (!lotto) continue;
      addLottoOpzione(row.mandanteId, lotto);
    }
    for (const p of perimetriConfig) {
      if (p.perimetro === "—") continue;
      addLottoOpzione(
        p.mandanteId,
        p.perimetro,
        p.acronimo,
        Boolean(p.acronimo?.trim())
      );
    }
    for (const lotto of lottiSelezionati) {
      if (lottiOpzioniMap.has(lotto)) continue;
      for (const m of mandantiAll) {
        addLottoOpzione(m.id, lotto);
        const hit = lottiOpzioniMap.get(lotto);
        if (hit && hit.label !== lotto) break;
      }
    }
  }

  const lottiOpzioni = [...lottiOpzioniMap.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "it")
  );

  const mandantiPerimetriOpts = mandantiAll.map((m) => ({ perimetri: m.perimetri }));

  const { sezioni: sezioniRaw, totale: totaleRaw, praticheCount } = await buildStatisticheGruppo(
    gruppo,
    {
      affidoDa,
      affidoA,
      mandanteId: sp.mandanteId,
      lotti: lottiSelezionati,
    },
    tutteLePratiche && !sedeScopeId
      ? {
          tenantId: user.tenantId,
          tutteLePratiche: true,
          mandantiPerimetri: mandantiPerimetriOpts,
        }
      : {
          tenantId: user.tenantId,
          extraWhere: periScope,
          richiedePerimetriGruppo: usaPerimetriGruppo,
          mandantiPerimetri: mandantiPerimetriOpts,
        }
  );

  const sezioni = completaSezioniPerimetriConfigurate(
    sezioniRaw,
    perimetriConfig,
    mandantiAll.map((m) => ({ id: m.id, perimetri: m.perimetri }))
  );
  const totale = allineaTotaleStatistiche(sezioni, totaleRaw);

  const operatoriGruppo = gruppo.members.filter((m) => m.role === "OPERATOR");
  const subtitle = canFilterGruppo
    ? sp.gruppo
      ? `Gruppo di ${gruppo.supervisorName || "—"} · ${operatoriGruppo.map((m) => m.name).join(", ") || "nessun operatore"}`
      : "Tutti i gruppi"
    : gruppo.supervisorName
      ? `Gruppo di ${gruppo.supervisorName} · ${operatoriGruppo.map((m) => m.name).join(", ") || gruppo.members.map((m) => m.name).join(", ")}`
      : `Gruppo · ${user.name}`;

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-2">
      <PageHeader title="Statistiche" subtitle={subtitle} />

      {user.role === "ADMIN" || user.role === "AMMINISTRAZIONE" ? (
        <SedeRendimentoFilter
          sedi={sediOpts}
          sedeId={sedeScopeId}
          basePath="/statistiche"
          keepParams={{
            affidoDa: affidoDaStr,
            affidoA: affidoAStr,
            mandanteId: sp.mandanteId,
            lotto: lottiSelezionati.join(",") || undefined,
            gruppo: gruppoIdEffettivo,
          }}
        />
      ) : null}

      {user.role === "AMMINISTRAZIONE" && !user.sedeId ? <MissingSedeBanner /> : null}
      {user.role === "AMMINISTRAZIONE" && !mostraRicavi ? (
        <RicaviAltreSediNascostiBanner sedeNomePropria={user.sedeNome} />
      ) : null}

      <Suspense fallback={null}>
        <StatisticheFiltriForm
          mandanti={mandanti}
          lottiOpzioni={lottiOpzioni}
          affidoDa={affidoDaStr}
          affidoA={affidoAStr}
          mandanteId={sp.mandanteId}
          lottiSelezionati={lottiSelezionati}
          gruppoId={gruppoIdEffettivo}
          supervisori={supervisori}
          consentiTuttiGruppi={user.role === "ADMIN" || user.role === "AMMINISTRAZIONE"}
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
          nascondiImporti={!mostraRicavi}
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
