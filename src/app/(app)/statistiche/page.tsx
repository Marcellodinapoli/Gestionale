import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { importBatchRepoFromUser } from "@/lib/importBatchRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { requireNavPage } from "@/lib/guard";
import { dataIt } from "@/lib/domain";
import { getGruppoLavoro, getGruppoLavoroForSupervisor } from "@/lib/gruppoLavoro";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import { isManutenzione, canViewRicaviIncassiAzienda } from "@/lib/permissions";
import {
  buildStatisticheGruppo,
  completaSezioniPerimetriConfigurate,
  allineaTotaleStatistiche,
  parseLottiFiltro,
  buildLottiPerPerimetroFiltro,
} from "@/lib/statisticheGruppo";
import { elencoPerimetriGruppoConfig } from "@/lib/affidiPerimetro";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import type { PerimetroLottiGruppoFiltro } from "@/lib/statisticheGruppoUi";
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

function defaultOggiIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
    cerca?: string;
  }>;
}) {
  const user = await requireNavPage("statistiche");
  const sp = await searchParams;
  const lottiSelezionati = parseLottiFiltro(sp.lotto);
  /** Griglia solo dopo scelta di almeno un lotto. */
  const showElenco = lottiSelezionati.length > 0;
  const affidoDaStr = sp.affidoDa || defaultOggiIso();
  const affidoAStr = sp.affidoA || defaultOggiIso();
  const affidoDa = parseDateInput(affidoDaStr);
  const affidoA = parseDateInput(affidoAStr);
  if (affidoA) affidoA.setHours(23, 59, 59, 999);

  const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sp.sede);
  const mostraRicavi = canViewRicaviFatturatiSede(user, sedeScopeId);
  const sedeUserIds = await userIdsInSede(user.tenantId, sedeScopeId);
  const sediOpts =
    user.role === "ADMIN" || user.role === "AMMINISTRAZIONE"
      ? await sediDbFromUser(user).findMany({
          where: { tenantId: user.tenantId, active: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        })
      : [];

  const canFilterGruppo = ["ADMIN", "AMMINISTRAZIONE"].includes(user.role);
  const isBackOfficeGruppo = user.role === "BACK_OFFICE" && !isManutenzione(user);

  const supervisoriAttivi = canFilterGruppo || isBackOfficeGruppo
    ? await usersDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          role: "SUPERVISOR",
          active: true,
          ...(canFilterGruppo && sedeScopeId ? { sedeId: sedeScopeId } : {}),
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

  const supervisorGruppoId =
    canFilterGruppo && gruppoIdEffettivo
      ? gruppoIdEffettivo
      : isBackOfficeGruppo && supervisoriAttivi.length
        ? supervisoriAttivi.some((s) => s.id === gruppoIdEffettivo)
          ? gruppoIdEffettivo!
          : supervisoriAttivi[0]!.id
        : undefined;

  let gruppo: Awaited<ReturnType<typeof getGruppoLavoro>>;

  if (supervisorGruppoId && (canFilterGruppo || isBackOfficeGruppo)) {
    gruppo = await getGruppoLavoroForSupervisor(user.tenantId, supervisorGruppoId);
  } else if (tutteLePratiche) {
    const allOps = await usersDbFromUser(user).findMany({
      where: { tenantId: user.tenantId, role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });
    gruppo = {
      supervisorId: null,
      supervisorName: null,
      gruppoNome: null,
      gruppoMandanti: [],
      members: allOps.map((o) => ({ ...o, internoVisibile: null })),
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
    : await mandantiDbFromUser(user).findMany({
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

  const mandantePerimetriRaw = new Map(
    mandantiAll.map((m) => [m.id, m.perimetri] as const)
  );

  let lottiPerPerimetro: PerimetroLottiGruppoFiltro[] = [];
  if (
    !isManutenzione(user) &&
    !nessunPerimetroGruppo &&
    sp.mandanteId
  ) {
    const lottiRows = await praticaDbFromUser(user).findMany({
      where: {
        ...scopeBase,
        mandanteId: sp.mandanteId,
        stato: { notIn: [...STATI_PRATICA_CHIUSA] },
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
      distinct: ["numeroMandante"],
      orderBy: { numeroMandante: "asc" },
    });

    const importBatches = await importBatchRepoFromUser(user).list(
      user.tenantSlug ?? user.tenantId,
      user.tenantId,
      { take: 200 }
    );
    const lottoPerimetroByKey = new Map(
      importBatches
        .filter((b) => b.lotto.trim() && b.perimetro.trim())
        .map((b) => [`${b.mandanteId}|${b.lotto.trim()}`, b.perimetro.trim()] as const)
    );

    lottiPerPerimetro = buildLottiPerPerimetroFiltro(
      sp.mandanteId,
      lottiRows,
      mandantePerimetriRaw.get(sp.mandanteId) ?? null,
      lottoPerimetroByKey
    );
  }

  const mandantiPerimetriOpts = mandantiAll.map((m) => ({ perimetri: m.perimetri }));

  const { sezioni: sezioniRaw, totale: totaleRaw } = showElenco
    ? await buildStatisticheGruppo(
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
              tenantSlug: user.tenantSlug ?? user.tenantId,
              tutteLePratiche: true,
              mandantiPerimetri: mandantiPerimetriOpts,
            }
          : {
              tenantId: user.tenantId,
              tenantSlug: user.tenantSlug ?? user.tenantId,
              extraWhere: periScope,
              richiedePerimetriGruppo: usaPerimetriGruppo,
              mandantiPerimetri: mandantiPerimetriOpts,
            }
      )
    : { sezioni: [], totale: null as Awaited<ReturnType<typeof buildStatisticheGruppo>>["totale"] | null };

  const sezioni = showElenco
    ? completaSezioniPerimetriConfigurate(
        sezioniRaw,
        perimetriConfig,
        mandantiAll.map((m) => ({ id: m.id, perimetri: m.perimetri }))
      )
    : [];
  const totale = showElenco && totaleRaw
    ? allineaTotaleStatistiche(sezioni, totaleRaw)
    : totaleRaw;

  const operatoriGruppo = gruppo.members.filter((m) => m.role === "OPERATOR");
  const subtitle = !showElenco
    ? sp.mandanteId
      ? "Scegli un lotto per aprire la griglia"
      : "Seleziona un mandato per vedere perimetri e lotti in lavorazione"
    : canFilterGruppo
      ? sp.gruppo
        ? `Gruppo di ${gruppo.supervisorName || "—"} · ${operatoriGruppo.map((m) => m.name).join(", ") || "nessun operatore"}`
        : "Tutti i gruppi"
      : isBackOfficeGruppo
        ? `Gruppo di ${gruppo.supervisorName || "—"} · ${operatoriGruppo.map((m) => m.name).join(", ") || "nessun operatore"}`
      : gruppo.supervisorName
        ? `Gruppo di ${gruppo.supervisorName} · ${operatoriGruppo.map((m) => m.name).join(", ") || gruppo.members.map((m) => m.name).join(", ")}`
    : `Gruppo · ${user.name}`;

  return (
    <div className="h-full min-h-0 min-w-0 max-w-full overflow-x-hidden overflow-y-auto pb-2">
      <PageHeader title="Statistiche" subtitle={subtitle} />

      {user.role === "ADMIN" || user.role === "AMMINISTRAZIONE" ? (
        <SedeRendimentoFilter
          sedi={sediOpts}
          sedeId={sedeScopeId}
          basePath="/statistiche"
          keepParams={
            sp.mandanteId
              ? {
                  affidoDa: affidoDaStr,
                  affidoA: affidoAStr,
                  mandanteId: sp.mandanteId,
                  ...(lottiSelezionati.length
                    ? { lotto: lottiSelezionati.join(","), cerca: "1" }
                    : {}),
                  gruppo: gruppoIdEffettivo,
                }
              : {}
          }
        />
      ) : null}

      {user.role === "AMMINISTRAZIONE" && !user.sedeId ? <MissingSedeBanner /> : null}
      {user.role === "AMMINISTRAZIONE" && !mostraRicavi ? (
        <RicaviAltreSediNascostiBanner sedeNomePropria={user.sedeNome} />
      ) : null}

      <Suspense fallback={null}>
        <StatisticheFiltriForm
          mandanti={mandanti}
          lottiPerPerimetro={lottiPerPerimetro}
          mandanteId={sp.mandanteId}
          lottiSelezionati={lottiSelezionati}
          grigliaAperta={showElenco}
        />
      </Suspense>

      {!showElenco ? (
        <p className="rounded-lg border border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
          {sp.mandanteId
            ? "Nessuna griglia aperta. Clicca un lotto sotto il perimetro di tuo interesse."
            : "Seleziona un mandato dall’elenco sopra: compariranno i perimetri e i lotti in lavorazione."}
        </p>
      ) : nessunPerimetroGruppo ? (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          Nessun perimetro impostato sul gruppo. Configuralo in Affidi per vedere le
          statistiche di tutti gli operatori del gruppo.
        </p>
      ) : sezioni.length && totale ? (
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
