import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { praticaWhere } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { parseGruppoMandanti } from "@/lib/gruppoMandanti";
import { gruppoPerimetroScopeWhere } from "@/lib/codiciMandantePerimetro";
import {
  conteggiLavorazioneSuggerita,
  loadLavorazioneStore,
  getPiano,
  elencoDatePiano,
  conteggiAffidatePerCodicePerimetro,
  buildPerimetriRigaLavorazione,
} from "@/lib/lavorazioneSuggerita";
import { codiciPerMandantePerimetro } from "@/lib/codiciMandantePerimetro";
import { formatDataIso, parseDataIso } from "@/lib/lavorateOggi";
import { PageHeader } from "@/components/ui";
import { LavorazioneSuggeritaBar } from "@/components/lavorazione/LavorazioneSuggeritaBar";
import { LavorazionePianoNav } from "@/components/lavorazione/LavorazionePianoNav";
import { LavorazionePianiSalvati } from "@/components/lavorazione/LavorazionePianiSalvati";
import { LavorazionePageClient } from "@/components/lavorazione/LavorazionePageClient";

export default async function LavorazionePage({
  searchParams,
}: {
  searchParams: Promise<{ gruppo?: string; giorno?: string; modifica?: string }>;
}) {
  const user = await requirePermission("lavorazione:view");
  const { gruppo: gruppoId, giorno: giornoRaw, modifica } = await searchParams;
  const inModifica = modifica === "1";
  const oggi = formatDataIso(new Date());
  const dataPiano = parseDataIso(giornoRaw) ? giornoRaw!.trim() : oggi;

  const canEdit = user.role === "SUPERVISOR" || user.role === "ADMIN";
  const canPickGruppo = user.role === "ADMIN";

  const supervisori = canPickGruppo
    ? await prisma.user.findMany({
        where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, gruppoNome: true },
      })
    : [];

  let gruppo = await getGruppoLavoro(user);
  const targetSupervisorId = canPickGruppo
    ? gruppoId || supervisori[0]?.id
    : gruppo.supervisorId;

  if (canPickGruppo && targetSupervisorId) {
    const sup = await prisma.user.findFirst({
      where: { id: targetSupervisorId, tenantId: user.tenantId, role: "SUPERVISOR" },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        gruppoNome: true,
        gruppoMandanti: true,
      },
    });
    const operators = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        supervisorId: targetSupervisorId,
        active: true,
        role: "OPERATOR",
      },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });
    if (sup) {
      gruppo = {
        supervisorId: sup.id,
        supervisorName: sup.name,
        gruppoNome: sup.gruppoNome,
        gruppoMandanti: parseGruppoMandanti(sup.gruppoMandanti),
        members: [
          { id: sup.id, name: sup.name, role: sup.role, email: sup.email },
          ...operators,
        ],
        memberIds: [sup.id, ...operators.map((o) => o.id)],
      };
    }
  }

  const supervisorId = targetSupervisorId ?? gruppo.supervisorId ?? user.id;
  const { store, supervisor } = await loadLavorazioneStore(supervisorId, user.tenantId);

  const operatoriGruppo = gruppo.members.filter((m) => m.role === "OPERATOR");

  const piano = getPiano(store, dataPiano);
  const vociConfig = piano.voci;
  const datePiani = elencoDatePiano(store);

  let periScope: Prisma.PraticaWhereInput | null = null;
  if (gruppo.gruppoMandanti.length) {
    periScope = await gruppoPerimetroScopeWhere(user.tenantId, gruppo.gruppoMandanti);
  }

  const scopeParts: Prisma.PraticaWhereInput[] = [praticaWhere(user)];
  if (periScope) scopeParts.push(periScope);
  const scope: Prisma.PraticaWhereInput =
    scopeParts.length === 1 ? scopeParts[0]! : { AND: scopeParts };

  const operatoreId = user.role === "OPERATOR" ? user.id : undefined;
  const mostraOperatori = user.role !== "OPERATOR";

  const gruppoPerimetroOpts = gruppo.gruppoMandanti.length
    ? { gruppoMandanti: gruppo.gruppoMandanti }
    : undefined;

  const [mandantiListRaw, lottiRows, righeCodiciPerimetro, affidatePerCodice] =
    await Promise.all([
      prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: { id: true, codice: true, ragioneSociale: true },
      }),
      prisma.pratica.findMany({
        where: scope,
        distinct: ["numeroMandante"],
        select: { numeroMandante: true },
      }),
      codiciPerMandantePerimetro(user, gruppoPerimetroOpts),
      conteggiAffidatePerCodicePerimetro(scope),
    ]);

  const perimetriRiga = buildPerimetriRigaLavorazione(
    righeCodiciPerimetro,
    affidatePerCodice
  );

  const mandantiList =
    gruppo.gruppoMandanti.length
      ? mandantiListRaw.filter((m) =>
          gruppo.gruppoMandanti.some((a) => a.mandanteId === m.id)
        )
      : mandantiListRaw;

  const lotti = [
    ...new Set(
      lottiRows
        .map((r) => r.numeroMandante?.trim())
        .filter((v): v is string => Boolean(v))
    ),
  ].sort((a, b) => a.localeCompare(b, "it"));

  const conteggiOpts = {
    scope,
    memberIds: gruppo.memberIds,
    tenantId: user.tenantId,
    dataPiano,
    salvatoAt: piano.salvatoAt,
    operatoreId,
    operatori: mostraOperatori
      ? operatoriGruppo.map((o) => ({ id: o.id, name: o.name }))
      : undefined,
  };

  const voci = await conteggiLavorazioneSuggerita(vociConfig, conteggiOpts);

  const canEditPiano =
    canEdit && (user.role === "SUPERVISOR" ? user.id === supervisorId : true);
  const pianoSalvato = datePiani.includes(dataPiano);
  const canEditFields = canEditPiano && (!pianoSalvato || inModifica);
  const giornoDopoElimina =
    datePiani.length > 0
      ? [...datePiani].sort((a, b) => b.localeCompare(a))[0]!
      : oggi;

  const modificaHref = (() => {
    const sp = new URLSearchParams();
    sp.set("giorno", dataPiano);
    sp.set("modifica", "1");
    if (canPickGruppo && supervisorId) sp.set("gruppo", supervisorId);
    return `/lavorazione?${sp.toString()}`;
  })();

  const annullaModificaHref = inModifica
    ? (() => {
        const sp = new URLSearchParams();
        sp.set("giorno", dataPiano);
        if (canPickGruppo && supervisorId) sp.set("gruppo", supervisorId);
        return `/lavorazione?${sp.toString()}`;
      })()
    : undefined;

  const pianiSalvati = store.piani
    .filter((p) => datePiani.includes(p.data))
    .sort((a, b) => b.data.localeCompare(a.data));

  const pianiSalvatiConConteggi = await Promise.all(
    pianiSalvati.map(async (piano) => ({
      data: piano.data,
      voci: await conteggiLavorazioneSuggerita(piano.voci, {
        scope,
        memberIds: gruppo.memberIds,
        tenantId: user.tenantId,
        dataPiano: piano.data,
        salvatoAt: piano.salvatoAt,
        operatori: operatoriGruppo.map((o) => ({ id: o.id, name: o.name })),
      }),
    }))
  );

  const subtitle =
    user.role === "OPERATOR"
      ? "Lavorazioni suggerite per non lasciare pratiche dormienti e per il fine di raggiungere le migliori performance"
      : user.role === "SUPERVISOR"
        ? gruppo.gruppoNome
          ? `Piano lavorazione · ${gruppo.gruppoNome}`
          : "Configura le lavorazioni suggerite per il team"
        : supervisor?.gruppoNome
          ? `Gruppo ${supervisor.gruppoNome} · ${supervisor?.name}`
          : "Lavorazioni suggerite per gruppo";

  return (
    <LavorazionePageClient>
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <PageHeader title="Suggerimenti di lavorazione" subtitle={subtitle} />

      {canPickGruppo && supervisori.length ? (
        <form className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="giorno" value={dataPiano} />
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Gruppo</span>
            <select
              name="gruppo"
              defaultValue={gruppoId || supervisorId}
              className="h-10 min-w-[200px] rounded-lg border border-[var(--line)] px-3 text-sm"
            >
              {supervisori.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.gruppoNome || s.name}
                </option>
              ))}
            </select>
          </label>
          <button className="h-10 rounded-lg border border-[var(--line)] bg-white px-4 text-sm">
            Filtra
          </button>
        </form>
      ) : null}

      <LavorazionePianoNav
        dataPiano={dataPiano}
        datePiani={datePiani}
        gruppoId={canPickGruppo ? supervisorId : undefined}
        canEdit={canEdit && (user.role === "SUPERVISOR" ? user.id === supervisorId : true)}
      />

      <LavorazioneSuggeritaBar
        voci={voci}
        operatoriGruppo={operatoriGruppo}
        mostraOperatori={mostraOperatori}
        operatoreCorrenteId={user.role === "OPERATOR" ? user.id : undefined}
        canEdit={canEditFields}
        canModifica={canEditPiano && pianoSalvato && !inModifica}
        modificaHref={modificaHref}
        annullaModificaHref={annullaModificaHref}
        eliminaRedirectGiorno={!pianoSalvato ? giornoDopoElimina : undefined}
        gruppoId={canPickGruppo ? supervisorId : undefined}
        supervisorId={supervisorId}
        dataPiano={dataPiano}
        pianoSalvato={pianoSalvato}
        supervisorName={
          user.role === "OPERATOR" ? supervisor?.name ?? gruppo.supervisorName : supervisor?.name
        }
        gruppoNome={gruppo.gruppoNome}
        mandanti={mandantiList}
        lotti={lotti}
        perimetriRiga={perimetriRiga}
      />

      {canEditPiano ? (
        <LavorazionePianiSalvati
          piani={
            inModifica
              ? pianiSalvatiConConteggi
              : pianiSalvatiConConteggi.filter((p) => p.data !== dataPiano)
          }
          operatoriGruppo={operatoriGruppo}
          supervisorId={supervisorId}
          supervisorName={supervisor?.name}
          gruppoNome={gruppo.gruppoNome}
          gruppoId={canPickGruppo ? supervisorId : undefined}
          dataCorrente={dataPiano}
          inModifica={inModifica}
          mandanti={mandantiList}
          lotti={lotti}
          perimetriRiga={perimetriRiga}
        />
      ) : null}
    </div>
    </LavorazionePageClient>
  );
}
