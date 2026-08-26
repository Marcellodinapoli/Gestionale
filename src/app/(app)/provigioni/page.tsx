import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { dataIt, euro } from "@/lib/domain";
import { provvigioneStatoLabel, provvigioniWhere } from "@/lib/provvigioni";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import { elencoPerimetriTuttiMandanti, parsePerimetroAffidi } from "@/lib/affidiPerimetro";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { buildSezioniProvvigioni } from "@/lib/provvigioniDisplay";
import {
  configProvvigioniMandanti,
  configProvvigioniPerimetriGruppo,
} from "@/lib/provvigioniPerimetro";
import { Card, PageHeader } from "@/components/ui";
import { ProvvigioniTableAdmin } from "@/components/provvigioni/ProvvigioniTableAdmin";
import { ProvvigioniListaPerimetro } from "@/components/provvigioni/ProvvigioniListaPerimetro";
import { ProvvigioniRiepilogoOperatori } from "@/components/provvigioni/ProvvigioniRiepilogoOperatori";
import { ProvvigioniFiltriAmministrazione } from "@/components/provvigioni/ProvvigioniFiltriAmministrazione";
import { MissingSedeBanner, RicaviAltreSediNascostiBanner } from "@/components/sedi/MissingSedeBanner";
import { SedeRendimentoFilter } from "@/components/sedi/SedeRendimentoFilter";
import {
  canViewRicaviFatturatiSede,
  sedeScopeForRendimento,
  userIdsInSede,
} from "@/lib/sedeScope";
import { prismaCount } from "@/lib/prismaCount";

function inizioMese(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function fineMese(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function mapRigaProvvigione(r: {
  id: string;
  praticaId: string;
  baseImporto: number;
  percentuale: number;
  importo: number;
  stato: string;
  operatore: { name: string };
  pratica: {
    numero: string;
    numeroMandante: string | null;
    debitore: { nome: string; cognome: string };
  };
  incasso: { data: Date };
}) {
  return {
    id: r.id,
    praticaId: r.praticaId,
    praticaNumero: r.pratica.numero,
    debitoreNome: `${r.pratica.debitore.nome} ${r.pratica.debitore.cognome}`,
    operatoreNome: r.operatore.name,
    data: dataIt(r.incasso.data),
    baseImporto: r.baseImporto,
    percentuale: r.percentuale,
    importo: r.importo,
    stato: r.stato,
    statoLabel: provvigioneStatoLabel(r.stato),
    perimetro: r.pratica.numeroMandante?.trim() || "—",
  };
}

function praticaFiltroAmministrazione(
  mandanteId?: string,
  perimetro?: string
): Prisma.PraticaWhereInput | undefined {
  const parts: Prisma.PraticaWhereInput[] = [];
  if (mandanteId) parts.push({ mandanteId });
  if (perimetro) {
    if (perimetro === "—") {
      parts.push({ OR: [{ numeroMandante: null }, { numeroMandante: "" }] });
    } else {
      parts.push({ numeroMandante: perimetro });
    }
  }
  if (!parts.length) return undefined;
  return parts.length === 1 ? parts[0]! : { AND: parts };
}

export default async function ProvigioniPage({
  searchParams,
}: {
  searchParams: Promise<{
    mese?: string;
    mandante?: string;
    gruppo?: string;
    operatore?: string;
    perimetro?: string;
    sede?: string;
  }>;
}) {
  const user = await requirePermission("provigioni:view");
  const {
    mese: meseRaw,
    mandante: mandanteId,
    gruppo: gruppoId,
    operatore: operatoreId,
    perimetro: perimetroRaw,
    sede: sedeRaw,
  } = await searchParams;

  const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sedeRaw);
  const mostraRicavi = canViewRicaviFatturatiSede(user, sedeScopeId);
  // Amministrazione: importi solo sulla propria sede; se filtro "tutte"/altra sede → niente ricavi.
  const sedePerImporti =
    user.role === "AMMINISTRAZIONE"
      ? mostraRicavi
        ? sedeScopeId || user.sedeId
        : "__nessuna__"
      : sedeScopeId;

  const sedeUserIds = await userIdsInSede(user.tenantId, sedeScopeId);
  const sediOpts =
    user.role === "ADMIN" || user.role === "AMMINISTRAZIONE"
      ? await prisma.sede.findMany({
          where: { tenantId: user.tenantId, active: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        })
      : [];

  const ref = meseRaw ? new Date(`${meseRaw}-01T12:00:00`) : new Date();
  const da = inizioMese(ref);
  const a = fineMese(ref);
  const meseValue = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;

  const isAmministrazione = user.role === "AMMINISTRAZIONE";
  const isAdmin = user.role === "ADMIN";
  const canFilter = isAdmin || isAmministrazione;

  const operatori = canFilter
    ? await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          role: { in: ["OPERATOR", "SUPERVISOR"] },
          active: true,
          ...(sedeScopeId ? { sedeId: sedeScopeId } : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const mandantiDb = canFilter
    ? await prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { ragioneSociale: "asc" },
        select: {
          id: true,
          codice: true,
          ragioneSociale: true,
          ...(isAmministrazione ? { perimetri: true as const } : {}),
        },
      })
    : [];

  const mandanti = mandantiDb.map(({ id, codice, ragioneSociale }) => ({
    id,
    codice,
    ragioneSociale,
  }));

  const supervisori = isAdmin || isAmministrazione
    ? await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          role: "SUPERVISOR",
          ...(sedeScopeId ? { sedeId: sedeScopeId } : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  const perimetriRefs = isAmministrazione
    ? elencoPerimetriTuttiMandanti(
        mandantiDb.map((m) => ({
          id: m.id,
          codice: m.codice,
          ragioneSociale: m.ragioneSociale,
          perimetri: parsePerimetriList(
            "perimetri" in m ? (m.perimetri as string) : "[]"
          ),
        }))
      )
    : [];

  const perimetroDecoded = parsePerimetroAffidi(perimetroRaw);
  const perimetroValido =
    mandanteId &&
    perimetroDecoded &&
    perimetriRefs.some((p) => p.mandanteId === mandanteId && p.perimetro === perimetroDecoded)
      ? perimetroDecoded
      : undefined;

  let gruppoMandanti = parseGruppoMandanti(null);
  let avvisoPerimetri = false;
  let membriGruppo: Array<{ id: string; name: string; role: string }> = [];

  if (isAdmin && gruppoId) {
    const sup = await prisma.user.findFirst({
      where: { id: gruppoId, tenantId: user.tenantId },
      select: { gruppoMandanti: true },
    });
    gruppoMandanti = parseGruppoMandanti(sup?.gruppoMandanti);
  } else if (!canFilter) {
    const gruppo = await getGruppoLavoro(user);
    gruppoMandanti = gruppo.gruppoMandanti;
    membriGruppo = gruppo.members;
    if (!gruppoMandanti.length) avvisoPerimetri = true;
  }

  let periScope: Prisma.PraticaWhereInput | null = null;
  if (gruppoMandanti.length) {
    periScope = await gruppoPerimetroScopeWhere(user.tenantId, gruppoMandanti);
    if (!periScope && !canFilter) avvisoPerimetri = true;
  } else if (!canFilter) {
    avvisoPerimetri = true;
  }

  const scope = provvigioniWhere(user, {
    sedeId: sedePerImporti === "__nessuna__" ? "__no-sede__" : sedePerImporti,
  });
  const praticaAmministrazione = isAmministrazione
    ? praticaFiltroAmministrazione(mandanteId, perimetroValido)
    : undefined;

  const praticaExtra: Prisma.PraticaWhereInput = isAmministrazione
    ? { ...(praticaAmministrazione || {}) }
    : {
        ...(mandanteId ? { mandanteId } : {}),
        ...(periScope && (!canFilter || gruppoId) ? periScope : {}),
      };

  const operatoriGruppo = membriGruppo.filter((m) =>
    user.role === "SUPERVISOR" ? m.role === "OPERATOR" || m.id === user.id : m.role === "OPERATOR"
  );
  const operatorIdsTeam = membriGruppo.filter((m) => m.role === "OPERATOR").map((m) => m.id);

  const operatoreEffettivo =
    operatoreId && sedeUserIds && !sedeUserIds.includes(operatoreId)
      ? "__nessuno__"
      : operatoreId;

  const wherePeriodo: Prisma.ProvvigioneWhereInput = {
    ...scope,
    createdAt: { gte: da, lte: a },
    ...(operatoreEffettivo
      ? { operatoreId: operatoreEffettivo }
      : isAdmin && gruppoId
        ? { operatore: { OR: [{ id: gruppoId }, { supervisorId: gruppoId }] } }
        : {}),
    ...(Object.keys(praticaExtra).length ? { pratica: praticaExtra } : {}),
  };

  const whereTeamSenzaOperatore: Prisma.ProvvigioneWhereInput = {
    ...scope,
    createdAt: { gte: da, lte: a },
    ...(gruppoId
      ? { operatore: { OR: [{ id: gruppoId }, { supervisorId: gruppoId }] } }
      : {}),
    ...(Object.keys(praticaExtra).length ? { pratica: praticaExtra } : {}),
  };

  const [righe, totali, maturate, liquidate, configsGruppo, totMie, totOperatori, groupByOperatore, groupByOperatoreStato] =
    await Promise.all([
      prisma.provvigione.findMany({
        where: wherePeriodo,
        include: {
          operatore: { select: { name: true } },
          pratica: {
            include: {
              debitore: { select: { nome: true, cognome: true } },
            },
          },
          incasso: { select: { data: true, importo: true, metodo: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.provvigione.aggregate({
        where: wherePeriodo,
        _sum: { importo: true },
        _count: true,
      }),
      prisma.provvigione.aggregate({
        where: { ...wherePeriodo, stato: "MATURATA" },
        _sum: { importo: true },
      }),
      prisma.provvigione.aggregate({
        where: { ...wherePeriodo, stato: "LIQUIDATA" },
        _sum: { importo: true },
      }),
      !isAmministrazione && gruppoMandanti.length
        ? configProvvigioniPerimetriGruppo(user.tenantId, gruppoMandanti)
        : Promise.resolve([]),
      user.role === "SUPERVISOR"
        ? prisma.provvigione.aggregate({
            where: { ...wherePeriodo, operatoreId: user.id },
            _sum: { importo: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { importo: 0 }, _count: 0 }),
      user.role === "SUPERVISOR" && operatorIdsTeam.length
        ? prisma.provvigione.aggregate({
            where: { ...wherePeriodo, operatoreId: { in: operatorIdsTeam } },
            _sum: { importo: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { importo: 0 }, _count: 0 }),
      user.role === "SUPERVISOR" && operatoriGruppo.length
        ? prisma.provvigione.groupBy({
            by: ["operatoreId"],
            where: whereTeamSenzaOperatore,
            _sum: { importo: true },
            _count: true,
          })
        : Promise.resolve([]),
      user.role === "SUPERVISOR" && operatoriGruppo.length
        ? prisma.provvigione.groupBy({
            by: ["operatoreId", "stato"],
            where: whereTeamSenzaOperatore,
            _sum: { importo: true },
          })
        : Promise.resolve([]),
    ]);

  let configs = configsGruppo;

  if (isAmministrazione) {
    configs = await configProvvigioniMandanti(user.tenantId, {
      mandanteIds: mandanteId ? [mandanteId] : undefined,
      soloPerimetro: perimetroValido,
    });
  } else if (canFilter && mandanteId && !gruppoId) {
    configs = await configProvvigioniMandanti(user.tenantId, {
      mandanteIds: [mandanteId],
    });
  }

  const righeMapped = righe.map(mapRigaProvvigione);
  const sezioni = buildSezioniProvvigioni(righeMapped, configs);

  const riepilogoOperatori =
    user.role === "SUPERVISOR"
      ? operatoriGruppo
          .map((op) => {
            const tot = groupByOperatore.find((g) => g.operatoreId === op.id);
            const mat = groupByOperatoreStato.find(
              (g) => g.operatoreId === op.id && g.stato === "MATURATA"
            );
            const liq = groupByOperatoreStato.find(
              (g) => g.operatoreId === op.id && g.stato === "LIQUIDATA"
            );
            return {
              id: op.id,
              name: op.name,
              importo: tot?._sum.importo ?? 0,
              count: prismaCount(tot?._count),
              maturate: mat?._sum.importo ?? 0,
              liquidate: liq?._sum.importo ?? 0,
              isSelf: op.id === user.id,
            };
          })
          .sort(
            (a, b) =>
              b.importo - a.importo || a.name.localeCompare(b.name, "it")
          )
      : [];

  const subtitle =
    user.role === "OPERATOR"
      ? "Le tue provvigioni · perimetri del gruppo"
      : user.role === "SUPERVISOR"
        ? `Team · ${operatoriGruppo.map((m) => m.name).join(", ") || user.name} · perimetri del gruppo`
        : isAmministrazione
          ? "Filtra per mandato, perimetro e operatore"
          : "Tutte le provvigioni · filtra per mandante e gruppo";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Provigioni" subtitle={subtitle} />

      {isAdmin || isAmministrazione ? (
        <SedeRendimentoFilter
          sedi={sediOpts}
          sedeId={sedeScopeId}
          basePath="/provigioni"
          keepParams={{
            mese: meseValue,
            mandante: mandanteId,
            gruppo: gruppoId,
            operatore: operatoreId,
            perimetro: perimetroRaw,
          }}
        />
      ) : null}

      {isAmministrazione && !user.sedeId ? <MissingSedeBanner /> : null}
      {isAmministrazione && !mostraRicavi ? (
        <RicaviAltreSediNascostiBanner sedeNomePropria={user.sedeNome} />
      ) : null}

      {avvisoPerimetri ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nessun perimetro configurato per il gruppo. Configura mandante e perimetri in{" "}
          <strong>Affidi → Modifica gruppo</strong> per filtrare le provvigioni sui perimetri
          gestiti.
        </p>
      ) : null}

      <form className="mb-3 flex shrink-0 flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Mese</span>
          <input
            type="month"
            name="mese"
            defaultValue={meseValue}
            className="h-10 rounded-lg border border-[var(--line)] px-3 text-sm"
          />
        </label>
        {user.role === "SUPERVISOR" && operatoriGruppo.length > 0 ? (
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Operatore</span>
            <select
              name="operatore"
              defaultValue={operatoreId || ""}
              className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              <option value="">Tutti il team</option>
              {operatoriGruppo.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.id === user.id ? " (tu)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {isAmministrazione ? (
          <ProvvigioniFiltriAmministrazione
            mandanti={mandanti}
            perimetri={perimetriRefs}
            operatori={operatori}
            mandanteId={mandanteId}
            perimetro={perimetroValido}
            operatoreId={operatoreId}
          />
        ) : null}
        {isAdmin ? (
          <>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Mandante</span>
              <select
                name="mandante"
                defaultValue={mandanteId || ""}
                className="h-10 min-w-[180px] rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                <option value="">Tutte</option>
                {mandanti.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codice} · {m.ragioneSociale}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Operatore</span>
              <select
                name="operatore"
                defaultValue={operatoreId || ""}
                className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                <option value="">Tutti</option>
                {operatori.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Gruppo</span>
              <select
                name="gruppo"
                defaultValue={gruppoId || ""}
                className="h-10 min-w-[160px] rounded-lg border border-[var(--line)] px-3 text-sm"
              >
                <option value="">Tutti</option>
                {supervisori.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <button className="h-10 rounded-lg border border-[var(--line)] bg-white px-4 text-sm">
          Filtra
        </button>
      </form>

      <div
        className={`mb-3 grid shrink-0 gap-3 ${
          user.role === "SUPERVISOR" ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-3"
        }`}
      >
        <Card title={user.role === "SUPERVISOR" ? "Totale team" : "Totale mese"}>
          <p className="text-2xl font-semibold">{euro(totali._sum.importo || 0)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {prismaCount(totali._count)} movimenti
          </p>
        </Card>
        {user.role === "SUPERVISOR" ? (
          <>
            <Card title="Tue provvigioni">
              <p className="text-2xl font-semibold text-[var(--navy)]">
                {euro(totMie._sum.importo || 0)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {prismaCount(totMie._count)} movimenti
              </p>
            </Card>
            <Card title="Operatori del gruppo">
              <p className="text-2xl font-semibold text-[var(--navy)]">
                {euro(totOperatori._sum.importo || 0)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {prismaCount(totOperatori._count)} movimenti
              </p>
            </Card>
          </>
        ) : null}
        <Card title="Maturate">
          <p className="text-2xl font-semibold text-[var(--accent)]">
            {euro(maturate._sum.importo || 0)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Da liquidare</p>
        </Card>
        <Card title="Liquidate">
          <p className="text-2xl font-semibold">{euro(liquidate._sum.importo || 0)}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">Già erogate</p>
        </Card>
      </div>

      {user.role === "SUPERVISOR" ? (
        <ProvvigioniRiepilogoOperatori
          items={riepilogoOperatori}
          mese={meseValue}
          operatoreSelezionato={operatoreId}
        />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {canFilter ? (
          <ProvvigioniTableAdmin sezioni={sezioni} />
        ) : (
          <ProvvigioniListaPerimetro
            sezioni={sezioni}
            showOperatore={user.role !== "OPERATOR"}
          />
        )}
      </div>
    </div>
  );
}
