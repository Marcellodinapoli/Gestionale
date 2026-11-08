import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { provvigioniDbFromUser } from "@/lib/provvigioniRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { requireNavPage } from "@/lib/guard";
import { dataIt, euro } from "@/lib/domain";
import { provvigioneStatoLabel, provvigioniWhere } from "@/lib/provvigioni";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import {
  elencoPerimetriGruppoConfig,
  elencoPerimetriTuttiMandanti,
  parsePerimetroAffidi,
} from "@/lib/affidiPerimetro";
import {
  chiaviMatchPerimetro,
  etichettaPerimetro,
  numeroMandantePerimetro,
  parsePerimetri,
  parsePerimetriList,
  perimetroPerNome,
  resolvePerimetroPratica,
} from "@/lib/mandantePerimetri";
import {
  buildSezioniProvvigioni,
  importoProvvigioneInTotali,
} from "@/lib/provvigioniDisplay";
import { importiProvvigionePerModo } from "@/lib/provvigioneImportiModo";
import { metricheScaglioniPerPerimetro } from "@/lib/provvigioniScaglioniMetriche";
import {
  buildRigheImportoFisso,
  type OperatoreImportoFisso,
} from "@/lib/provvigioniImportoFisso";
import { parseCondizioneEconomica } from "@/lib/condizioneEconomica";
import {
  configProvvigioniMandanti,
  configProvvigioniPerimetriGruppo,
} from "@/lib/provvigioniPerimetro";
import { Card, PageHeader } from "@/components/ui";
import Link from "next/link";
import { X } from "lucide-react";
import { ProvvigioniTableAdmin } from "@/components/provvigioni/ProvvigioniTableAdmin";
import { ProvvigioniListaPerimetro } from "@/components/provvigioni/ProvvigioniListaPerimetro";
import { ProvvigioniFiltriAmministrazione } from "@/components/provvigioni/ProvvigioniFiltriAmministrazione";
import { ProvvigioniAggiornaButton } from "@/components/provvigioni/ProvvigioniAggiornaButton";
import { ProvvigioniMesePicker } from "@/components/provvigioni/ProvvigioniMesePicker";
import { ProvvigioniMeseCalendario } from "@/components/provvigioni/ProvvigioniMeseCalendario";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_PAGE_INPUT_CLASS,
  FILTRI_PAGE_SELECT_LG_CLASS,
  FILTRI_RESET_BUTTON_CLASS,
} from "@/components/filtri/filtriFieldStyles";
import { MissingSedeBanner, RicaviAltreSediNascostiBanner } from "@/components/sedi/MissingSedeBanner";
import { SedeRendimentoFilter } from "@/components/sedi/SedeRendimentoFilter";
import {
  canViewRicaviFatturatiSede,
  sedeScopeForRendimento,
  userIdsInSede,
} from "@/lib/sedeScope";
import { prismaCount } from "@/lib/prismaCount";
import { codiceScaricoPratica } from "@/lib/scarico";
import {
  isModoNonProvvigionabile,
  normalizeModoIncasso,
} from "@/lib/incassoFattura";

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
    stato: string;
    codiceScarico: string | null;
    debitore: { nome: string; cognome: string };
    mandante?: { codice?: string | null; perimetri?: string | null } | null;
  };
  incasso: {
    data: Date;
    fattura?: string | null;
    modo?: string | null;
    metodo?: string | null;
  };
}) {
  const fattura = (r.incasso?.fattura || "").trim();
  const modo = normalizeModoIncasso(r.incasso?.modo);
  const nonProvv = isModoNonProvvigionabile(modo);
  const importi = importiProvvigionePerModo({
    modo,
    baseImporto: r.baseImporto,
    metodo: r.incasso?.metodo || "bonifico",
    codiceScarico: r.pratica.codiceScarico,
    numeroMandante: r.pratica.numeroMandante,
    mandante: r.pratica.mandante ?? {},
  });
  const lotto = r.pratica.numeroMandante?.trim() || "";
  const hit = resolvePerimetroPratica(
    r.pratica.mandante?.perimetri ?? null,
    lotto || null
  );
  const perimetroKey = hit
    ? numeroMandantePerimetro(hit) || lotto || "—"
    : lotto || "—";
  const perimetroLabel = hit ? etichettaPerimetro(hit) || perimetroKey : perimetroKey;
  return {
    id: r.id,
    praticaId: r.praticaId,
    praticaNumero: r.pratica.numero,
    debitoreNome: `${r.pratica.debitore.nome} ${r.pratica.debitore.cognome}`,
    operatoreNome: r.operatore.name,
    data: dataIt(r.incasso.data),
    baseImporto: r.baseImporto,
    percentuale: importi.percentuale,
    importo: importi.importo,
    stato: r.stato,
    statoLabel: nonProvv ? "Non provv." : provvigioneStatoLabel(r.stato),
    perimetro: perimetroKey,
    perimetroLabel,
    codiceScarico:
      codiceScaricoPratica(r.pratica.stato, r.pratica.codiceScarico) ?? "—",
    modo,
    fattura: fattura || "—",
  };
}

function praticaFiltroAmministrazione(
  mandanteId?: string,
  perimetro?: string,
  mandantePerimetriRaw?: string | null
): Prisma.PraticaWhereInput | undefined {
  const parts: Prisma.PraticaWhereInput[] = [];
  if (mandanteId) parts.push({ mandanteId });
  if (perimetro) {
    if (perimetro === "—") {
      parts.push({ OR: [{ numeroMandante: null }, { numeroMandante: "" }] });
    } else if (mandantePerimetriRaw) {
      const elenco = parsePerimetri(mandantePerimetriRaw);
      const hit = perimetroPerNome(elenco, perimetro);
      // Un solo perimetro configurato: i lotti pratica possono essere numerici (es. 1426001).
      if (hit && elenco.length === 1) {
        /* solo mandanteId */
      } else {
        const chiavi = chiaviMatchPerimetro(mandantePerimetriRaw, perimetro);
        if (chiavi.length === 1) {
          parts.push({ numeroMandante: chiavi[0]! });
        } else {
          parts.push({ numeroMandante: { in: chiavi } });
        }
      }
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
    cerca?: string;
  }>;
}) {
  const user = await requireNavPage("provigioni");
  const provvigioniModel = provvigioniDbFromUser(user);
  const {
    mese: meseRaw,
    mandante: mandanteId,
    gruppo: gruppoId,
    operatore: operatoreId,
    perimetro: perimetroRaw,
    sede: sedeRaw,
    cerca: cercaRaw,
  } = await searchParams;
  // Elenco solo dopo Filtra (cerca=1) o filtri espliciti in URL.
  const showElenco =
    cercaRaw === "1" ||
    Boolean(meseRaw || mandanteId || gruppoId || operatoreId || perimetroRaw);

  const { sedeId: sedeScopeId } = sedeScopeForRendimento(user, sedeRaw);
  const mostraRicavi = canViewRicaviFatturatiSede(user, sedeScopeId);
  // Amministrazione: elenco sempre sulla propria sede; "Tutte" = stessa sede (banner se non è la sede scelta nel filtro).
  const sedePerImporti =
    user.role === "AMMINISTRAZIONE"
      ? !user.sedeId
        ? "__nessuna__"
        : sedeScopeId && sedeScopeId !== user.sedeId
          ? "__nessuna__"
          : user.sedeId
      : sedeScopeId;

  const sedeUserIds = await userIdsInSede(user.tenantId, sedeScopeId);
  const sediOpts =
    user.role === "ADMIN" || user.role === "AMMINISTRAZIONE"
      ? await sediDbFromUser(user).findMany({
          where: { tenantId: user.tenantId, active: true },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true },
        })
      : [];

  const mesiOperatore =
    user.role === "OPERATOR"
      ? await (async () => {
          const scopeMesi = provvigioniWhere(user, {
            sedeId: sedePerImporti === "__nessuna__" ? "__no-sede__" : sedePerImporti,
          });
          const dateRows = await provvigioniModel.findMany({
            where: { ...scopeMesi, operatoreId: user.id },
            select: { createdAt: true, incasso: { select: { data: true } } },
          });
          const set = new Set<string>();
          const addMese = (d: Date) => {
            set.add(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
            );
          };
          for (const row of dateRows) {
            if (row.incasso?.data) addMese(row.incasso.data);
            if (row.createdAt) addMese(row.createdAt);
          }
          return [...set].sort((a, b) => b.localeCompare(a));
        })()
      : [];

  const ref = meseRaw ? new Date(`${meseRaw}-01T12:00:00`) : new Date();
  const da = inizioMese(ref);
  const a = fineMese(ref);
  const meseValue = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const meseLabel = ref.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const isAmministrazione = user.role === "AMMINISTRAZIONE";
  const isAdmin = user.role === "ADMIN";
  const isSupervisor = user.role === "SUPERVISOR";
  const isOperator = user.role === "OPERATOR";
  const canFilterWide = isAdmin || isAmministrazione;
  const vistaTabellaAdmin = canFilterWide || isSupervisor || isOperator;
  const needsMandantiFiltri = vistaTabellaAdmin;

  const operatori = canFilterWide
    ? await usersDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          role: { in: ["OPERATOR", "SUPERVISOR"] },
          active: true,
          ...(sedeScopeId ? { sedeId: sedeScopeId } : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, condizioneEconomica: true, importoFisso: true },
      })
    : [];

  const mandantiDb = needsMandantiFiltri
    ? await mandantiDbFromUser(user).findMany({
        where: { tenantId: user.tenantId },
        orderBy: { ragioneSociale: "asc" },
        select: {
          id: true,
          codice: true,
          ragioneSociale: true,
          perimetri: true,
        },
      })
    : [];

  const mandantiOptions = mandantiDb.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetriList(m.perimetri),
  }));

  const mandanti = mandantiOptions.map(({ id, codice, ragioneSociale }) => ({
    id,
    codice,
    ragioneSociale,
  }));

  const supervisori = canFilterWide
    ? await usersDbFromUser(user).findMany({
        where: {
          tenantId: user.tenantId,
          role: "SUPERVISOR",
          ...(sedeScopeId ? { sedeId: sedeScopeId } : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];

  let gruppoMandanti = parseGruppoMandanti(null);
  let membriGruppo: Array<{ id: string; name: string; role: string }> = [];

  if (canFilterWide && gruppoId) {
    const sup = await usersDbFromUser(user).findFirst({
      where: { id: gruppoId, tenantId: user.tenantId },
      select: { gruppoMandanti: true },
    });
    gruppoMandanti = parseGruppoMandanti(sup?.gruppoMandanti);
  } else if (isSupervisor || isOperator) {
    const gruppo = await getGruppoLavoro(user);
    gruppoMandanti = gruppo.gruppoMandanti;
    membriGruppo = gruppo.members;
  }

  let periScope: Prisma.PraticaWhereInput | null = null;
  if (gruppoMandanti.length) {
    periScope = await gruppoPerimetroScopeWhere(user.tenantId, gruppoMandanti);
  }

  /** Gruppo con mandanti/perimetri validi → filtri e scope ristretti; altrimenti mandati tenant (come Affidi). */
  const gruppoPerimetriOk = Boolean(gruppoMandanti.length && periScope);

  const perimetriRefs = canFilterWide
    ? elencoPerimetriTuttiMandanti(mandantiOptions)
    : gruppoPerimetriOk
      ? elencoPerimetriGruppoConfig(gruppoMandanti, mandantiOptions)
      : elencoPerimetriTuttiMandanti(mandantiOptions);

  const mandantiIdsGruppo = new Set(gruppoMandanti.map((a) => a.mandanteId));
  const mandantiPerFiltro =
    canFilterWide || !gruppoPerimetriOk
      ? mandanti
      : mandanti.filter((m) => mandantiIdsGruppo.has(m.id));

  const perimetroDecoded = parsePerimetroAffidi(perimetroRaw);
  const perimetroValido =
    mandanteId &&
    perimetroDecoded &&
    perimetriRefs.some((p) => p.mandanteId === mandanteId && p.perimetro === perimetroDecoded)
      ? perimetroDecoded
      : undefined;

  const perimetriRawMandanteFiltro = mandanteId
    ? mandantiDb.find((m) => m.id === mandanteId)?.perimetri ?? null
    : null;

  const operatoriTeamIds = membriGruppo
    .filter((m) => m.role === "OPERATOR")
    .map((m) => m.id);

  /** Supervisor: provvigioni degli operatori del gruppo (stessa membership della Home). */
  const scope: Prisma.ProvvigioneWhereInput =
    isSupervisor && operatoriTeamIds.length
      ? {
          AND: [
            { pratica: { tenantId: user.tenantId } },
            { operatoreId: { in: operatoriTeamIds } },
          ],
        }
      : provvigioniWhere(user, {
          sedeId: sedePerImporti === "__nessuna__" ? "__no-sede__" : sedePerImporti,
        });
  const praticaFiltroMandantePerimetro = praticaFiltroAmministrazione(
    mandanteId,
    perimetroValido,
    perimetriRawMandanteFiltro
  );

  const praticaExtra: Prisma.PraticaWhereInput = {
    ...(praticaFiltroMandantePerimetro || {}),
    ...(canFilterWide && periScope && gruppoId ? periScope : {}),
    ...(!canFilterWide && gruppoPerimetriOk && periScope ? periScope : {}),
  };

  const operatoriGruppo = membriGruppo.filter((m) =>
    isSupervisor ? m.role === "OPERATOR" || m.id === user.id : m.role === "OPERATOR"
  );
  const operatorIdsTeam = new Set(operatoriGruppo.map((m) => m.id));

  const operatoriPerFiltro = canFilterWide
    ? operatori.map((o) => ({ id: o.id, name: o.name }))
    : isSupervisor
      ? operatoriGruppo.map((o) => ({ id: o.id, name: o.name }))
      : [];

  const operatoreIdConsentito =
    isOperator
      ? user.id
      : operatoreId && sedeUserIds && !sedeUserIds.includes(operatoreId)
        ? undefined
        : operatoreId && isSupervisor && !operatorIdsTeam.has(operatoreId)
          ? undefined
          : operatoreId && canFilterWide && !operatori.some((o) => o.id === operatoreId)
            ? undefined
            : operatoreId;

  const operatoreClause: Prisma.ProvvigioneWhereInput = isOperator
    ? { operatoreId: user.id }
    : operatoreIdConsentito
      ? { operatoreId: operatoreIdConsentito }
      : canFilterWide && gruppoId
        ? { operatore: { OR: [{ id: gruppoId }, { supervisorId: gruppoId }] } }
        : {};

  const wherePeriodo: Prisma.ProvvigioneWhereInput = {
    AND: [
      scope,
      {
        OR: [
          { incasso: { data: { gte: da, lte: a } } },
          { createdAt: { gte: da, lte: a } },
        ],
      },
      ...(Object.keys(operatoreClause).length ? [operatoreClause] : []),
      ...(Object.keys(praticaExtra).length ? [{ pratica: praticaExtra }] : []),
    ],
  };

  const [righe, totali, maturate, liquidate, configsGruppo] =
    showElenco
      ? await Promise.all([
          provvigioniModel.findMany({
            where: wherePeriodo,
            include: {
              operatore: { select: { name: true } },
              pratica: {
                select: {
                  numero: true,
                  numeroMandante: true,
                  stato: true,
                  codiceScarico: true,
                  debitore: { select: { nome: true, cognome: true } },
                  mandante: { select: { codice: true, perimetri: true } },
                },
              },
              incasso: { select: { data: true, importo: true, metodo: true, fattura: true, modo: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
          provvigioniModel.aggregate({
            where: wherePeriodo,
            _sum: { importo: true },
            _count: true,
          }),
          provvigioniModel.aggregate({
            where: { ...wherePeriodo, stato: "MATURATA" },
            _sum: { importo: true },
          }),
          provvigioniModel.aggregate({
            where: { ...wherePeriodo, stato: "LIQUIDATA" },
            _sum: { importo: true },
          }),
          gruppoMandanti.length && (gruppoId || isSupervisor || isOperator)
            ? configProvvigioniPerimetriGruppo(user.tenantId, gruppoMandanti)
            : Promise.resolve([]),
        ])
      : [[], { _sum: { importo: 0 }, _count: 0 }, { _sum: { importo: 0 } }, { _sum: { importo: 0 } }, []];

  const operatoriPerFissoIds = new Set<string>();
  if (showElenco) {
    if (isOperator) {
      operatoriPerFissoIds.add(user.id);
    } else if (operatoreIdConsentito) {
      operatoriPerFissoIds.add(operatoreIdConsentito);
    } else if (isSupervisor) {
      for (const op of operatoriGruppo) operatoriPerFissoIds.add(op.id);
    } else if (canFilterWide) {
      for (const op of operatori) operatoriPerFissoIds.add(op.id);
    }
  }

  const operatoriFissoRaw =
    showElenco && operatoriPerFissoIds.size > 0
      ? await usersDbFromUser(user).findMany({
          where: {
            tenantId: user.tenantId,
            id: { in: [...operatoriPerFissoIds] },
            active: true,
          },
          select: {
            id: true,
            name: true,
            condizioneEconomica: true,
            importoFisso: true,
          },
        })
      : [];

  const operatoriFisso: OperatoreImportoFisso[] = operatoriFissoRaw.map((o) => ({
    id: o.id,
    name: o.name,
    condizioneEconomica: parseCondizioneEconomica(o.condizioneEconomica),
    importoFisso: o.importoFisso != null ? Number(o.importoFisso) : null,
  }));

  const fissoPerOperatore = new Map(
    operatoriFisso
      .filter((o) => o.condizioneEconomica === "FISSO_PROVV" && o.importoFisso != null)
      .map((o) => [o.id, o.importoFisso!])
  );
  const totaleFisso = [...fissoPerOperatore.values()].reduce((s, n) => s + n, 0);

  let configs = configsGruppo;

  if (
    showElenco &&
    (canFilterWide || isSupervisor || isOperator) &&
    mandanteId &&
    !gruppoId
  ) {
    configs = await configProvvigioniMandanti(user.tenantId, {
      mandanteIds: [mandanteId],
      soloPerimetro: perimetroValido,
    });
  }

  const righeMapped = righe.map(mapRigaProvvigione);
  const praticaFilterMetriche =
    Object.keys(praticaExtra).length > 0 ? praticaExtra : undefined;
  const metricheScaglioni =
    showElenco && configs.length
      ? await metricheScaglioniPerPerimetro(user, configs, praticaFilterMetriche)
      : new Map();
  const righeFisso = showElenco ? buildRigheImportoFisso(operatoriFisso, meseLabel) : [];
  const righeComplete = [...righeMapped, ...righeFisso];
  const sezioni = showElenco
    ? buildSezioniProvvigioni(righeComplete, configs, metricheScaglioni)
    : [];

  const totaleMese =
    righeMapped.reduce((s, r) => s + importoProvvigioneInTotali(r), 0) + totaleFisso;
  const totaleMaturate =
    righeMapped.reduce(
      (s, r) => s + importoProvvigioneInTotali(r, { stato: "MATURATA" }),
      0
    ) + totaleFisso;
  const totaleLiquidate = righeMapped.reduce(
    (s, r) => s + importoProvvigioneInTotali(r, { stato: "LIQUIDATA" }),
    0
  );
  const subtitle = !showElenco
    ? "Imposta i filtri e clicca Filtra per vedere l’elenco"
    : isOperator
      ? "Le tue provvigioni"
      : "Filtra per mandato, perimetro e operatore";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Provigioni" subtitle={subtitle} />

      {isAdmin || isAmministrazione ? (
        <SedeRendimentoFilter
          sedi={sediOpts}
          sedeId={sedeScopeId}
          basePath="/provigioni"
          keepParams={
            showElenco
              ? {
                  mese: meseValue,
                  mandante: mandanteId,
                  gruppo: gruppoId,
                  operatore: operatoreId,
                  perimetro: perimetroRaw,
                  cerca: "1",
                }
              : {}
          }
        />
      ) : null}

      {isAmministrazione && !user.sedeId ? <MissingSedeBanner /> : null}
      {isAmministrazione && !mostraRicavi ? (
        <RicaviAltreSediNascostiBanner sedeNomePropria={user.sedeNome} />
      ) : null}

      <form
        method="get"
        action="/provigioni"
        className="mb-3 flex shrink-0 flex-wrap items-end gap-2"
      >
        <input type="hidden" name="cerca" value="1" />
        {sedeScopeId ? <input type="hidden" name="sede" value={sedeScopeId} /> : null}
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Mese</span>
          {isOperator ? (
            <ProvvigioniMesePicker
              value={meseValue}
              inputKey={`mese-${meseValue}-${showElenco ? "1" : "0"}`}
              mesiDisponibili={mesiOperatore}
            />
          ) : (
            <ProvvigioniMeseCalendario
              value={meseValue}
              inputKey={`mese-${meseValue}-${showElenco ? "1" : "0"}`}
            />
          )}
        </label>
        {vistaTabellaAdmin ? (
          <ProvvigioniFiltriAmministrazione
            mandanti={mandantiPerFiltro}
            perimetri={perimetriRefs}
            operatori={operatoriPerFiltro}
            gruppi={canFilterWide ? supervisori : undefined}
            mandanteId={mandanteId}
            perimetro={perimetroValido}
            operatoreId={operatoreIdConsentito}
            gruppoId={gruppoId}
            mostraOperatore={!isOperator}
          />
        ) : null}
        <button type="submit" className={`h-10 ${FILTRI_APPLY_BUTTON_CLASS}`}>
          Filtra
        </button>
        {showElenco ? <ProvvigioniAggiornaButton /> : null}
        {showElenco ? (
          <Link
            href={sedeScopeId ? `/provigioni?sede=${encodeURIComponent(sedeScopeId)}` : "/provigioni"}
            className={`inline-flex h-10 items-center gap-1 ${FILTRI_RESET_BUTTON_CLASS}`}
          >
            <X className="h-4 w-4" />
            Reset
          </Link>
        ) : null}
      </form>

      {!showElenco ? (
        <p className="rounded-lg border border-[var(--line)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
          Nessun elenco caricato. Imposta mese o altri filtri e premi{" "}
          <span className="font-semibold text-[var(--navy)]">Filtra</span>.
        </p>
      ) : (
        <>
          <div className="mb-3 grid shrink-0 gap-3 sm:grid-cols-3">
            <Card title="Totale mese">
              <p className="text-2xl font-semibold">{euro(totaleMese)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {prismaCount(totali._count) + righeFisso.length} movimenti
                {totaleFisso > 0 ? ` · di cui ${euro(totaleFisso)} fisso` : ""}
              </p>
            </Card>
            <Card title="Maturate">
              <p className="text-2xl font-semibold text-[var(--accent)]">
                {euro(totaleMaturate)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">Da liquidare</p>
            </Card>
            <Card title="Liquidate">
              <p className="text-2xl font-semibold">{euro(totaleLiquidate)}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Già erogate</p>
            </Card>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {vistaTabellaAdmin ? (
              <ProvvigioniTableAdmin
                sezioni={sezioni}
                mostraSelezioneLiquidazione={canFilterWide}
              />
            ) : (
              <ProvvigioniListaPerimetro sezioni={sezioni} showOperatore />
            )}
          </div>
        </>
      )}
    </div>
  );
}
