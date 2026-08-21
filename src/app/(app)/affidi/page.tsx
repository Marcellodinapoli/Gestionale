import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { praticaWhere } from "@/lib/domain";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { isManutenzione } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { GruppoOperatoriCard } from "@/components/affidi/GruppoOperatoriCard";
import { AffidiDaAffidareTable } from "@/components/affidi/AffidiDaAffidareTable";
import { AffidiFiltroOperatore } from "@/components/affidi/AffidiFiltroOperatore";
import { AffidiPraticheOperatore } from "@/components/affidi/AffidiPraticheOperatore";
import {
  AffidiCaricoOperatori,
  buildCaricoOperatori,
  etichettaCodaAffidi,
  filtraPraticheAffido,
  parseCodaAffidi,
} from "@/components/affidi/AffidiCaricoOperatori";
import Link from "next/link";
import { AltriGruppiToggle } from "@/components/affidi/AltriGruppiToggle";
import { GruppoInlineEditor } from "@/components/affidi/GruppoInlineEditor";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import { parseGruppoMandanti, etichettaGruppoMandanti } from "@/lib/gruppoMandanti";

export default async function AffidiPage({
  searchParams,
}: {
  searchParams: Promise<{ operatore?: string; coda?: string }>;
}) {
  const user = await requirePermission("pratiche:assign");
  const { operatore: operatoreRaw, coda: codaRaw } = await searchParams;

  const gruppo = await getGruppoLavoro(user);
  const vuoto = isManutenzione(user);

  const mandantiDb = vuoto
    ? []
    : await prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: { id: true, codice: true, ragioneSociale: true, perimetri: true },
      });

  const mandantiOptions = mandantiDb.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetri(m.perimetri).map((p) => ({ id: p.id, nome: p.nome })),
  }));

  const [operatori, tuttiOperatori] = await Promise.all([
    vuoto
      ? Promise.resolve([])
      : user.role === "SUPERVISOR"
      ? prisma.user.findMany({
          where: { tenantId: user.tenantId, supervisorId: user.id, active: true, role: "OPERATOR" },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true, acronimo: true },
        })
      : prisma.user.findMany({
          where: { tenantId: user.tenantId, role: { in: ["OPERATOR", "SUPERVISOR"] }, active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true, acronimo: true },
        }),
    vuoto
      ? Promise.resolve([])
      : user.role === "SUPERVISOR"
      ? prisma.user.findMany({
          where: { tenantId: user.tenantId, role: "OPERATOR", active: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            supervisorId: true,
            supervisor: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const membriCarico =
    user.role === "SUPERVISOR"
      ? gruppo.members
      : operatori;

  const memberIds = membriCarico.map((m) => m.id);

  const [daAssegnare, affidate] = await Promise.all([
    prisma.pratica.findMany({
      where: { ...praticaWhere(user), assegnatarioId: null },
      include: { debitore: true, mandante: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pratica.findMany({
      where: {
        ...praticaWhere(user),
        OR: [
          { assegnatarioId: { in: memberIds.length ? memberIds : ["__none__"] } },
          { operatoreTitolareId: { in: memberIds.length ? memberIds : ["__none__"] } },
        ],
      },
      include: {
        debitore: { select: { nome: true, cognome: true } },
        mandante: { select: { codice: true } },
        assegnatario: { select: { id: true, name: true } },
        operatoreTitolare: { select: { id: true, name: true } },
      },
      orderBy: { numero: "asc" },
    }),
  ]);

  const carico = buildCaricoOperatori(membriCarico, affidate);
  const selezionatoId =
    operatoreRaw && memberIds.includes(operatoreRaw) ? operatoreRaw : undefined;
  const coda = parseCodaAffidi(codaRaw);
  const selezionato = selezionatoId
    ? membriCarico.find((m) => m.id === selezionatoId)
    : undefined;
  const mostraElenco = Boolean(selezionatoId || coda);
  const praticheSelezionato = mostraElenco
    ? filtraPraticheAffido(affidate, { operatoreId: selezionatoId, coda })
    : [];
  const titoloElenco = [
    selezionato ? `Pratiche di ${selezionato.name}` : "Pratiche del gruppo",
    coda ? `· ${etichettaCodaAffidi(coda)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const subtitle =
    user.role === "SUPERVISOR"
      ? `Gruppo di ${user.name} · ${operatori.length} operatori · ${daAssegnare.length} da affidare`
      : user.role === "BACK_OFFICE"
        ? `Affidi definitivi e temporanei · ${operatori.length} operatori · ${daAssegnare.length} da affidare`
        : `Assegna le pratiche nuove e monitora il carico operatori`;

  const gruppiLavoro =
    user.role !== "SUPERVISOR"
      ? await prisma.user.findMany({
          where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true },
          select: {
            id: true,
            name: true,
            gruppoNome: true,
            gruppoMandanti: true,
            operators: {
              where: { tenantId: user.tenantId, active: true, role: "OPERATOR" },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : [];

  const altriGruppi =
    user.role === "SUPERVISOR"
      ? await prisma.user.findMany({
          where: { tenantId: user.tenantId, role: "SUPERVISOR", active: true, id: { not: user.id } },
          select: {
            id: true,
            name: true,
            gruppoNome: true,
            gruppoMandanti: true,
            operators: {
              where: { tenantId: user.tenantId, active: true, role: "OPERATOR" },
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto pb-4">
      <PageHeader title="Affidi" subtitle={subtitle} />

      {user.role !== "SUPERVISOR" && gruppiLavoro.length > 0 ? (
        <Card title="Gruppi di lavoro">
          <div className="space-y-3">
            {gruppiLavoro.map((sup) => (
              <div
                key={sup.id}
                className="rounded-lg border border-[var(--line)] bg-white p-3"
              >
                <div className="flex items-baseline gap-2">
                  {sup.gruppoNome ? (
                    <p className="text-sm font-semibold text-[var(--navy)]">
                      {sup.gruppoNome}
                    </p>
                  ) : (
                    <p className="text-sm italic text-[var(--muted)]">
                      Nome non assegnato
                    </p>
                  )}
                  <span className="text-[10px] text-[var(--muted)]">
                    Supervisor: {sup.name}
                  </span>
                </div>
                {sup.operators.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {sup.operators.map((op) => (
                      <span
                        key={op.id}
                        className="rounded-full border border-[var(--line)] bg-[#eef4f8] px-2.5 py-0.5 text-xs"
                      >
                        {op.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[10px] text-[var(--muted)]">Nessun operatore nel gruppo</p>
                )}
                {(() => {
                  const labels = etichettaGruppoMandanti(
                    parseGruppoMandanti(sup.gruppoMandanti),
                    mandantiOptions
                  );
                  return labels.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {labels.map((label) => (
                        <span
                          key={label}
                          className="rounded-full border border-[#c5d4e3] bg-white px-2 py-px text-[10px] text-[var(--navy)]"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card title={
        user.role === "SUPERVISOR" && gruppo.gruppoNome
          ? `Carico operatori · ${gruppo.gruppoNome}`
          : "Carico operatori · code in lavorazione"
      }>
        {user.role === "SUPERVISOR" ? (
          <GruppoInlineEditor
            supervisorId={user.id}
            membri={gruppo.members}
            gruppoNome={gruppo.gruppoNome}
            gruppoMandanti={gruppo.gruppoMandanti}
            mandanti={mandantiOptions}
            tuttiOperatori={tuttiOperatori.map((o) => ({
              id: o.id,
              name: o.name,
              supervisorId: o.supervisorId,
              supervisorName: o.supervisor?.name ?? null,
            }))}
            altriGruppi={altriGruppi}
          />
        ) : null}
        {!carico.length ? (
          <p className="text-sm text-[var(--muted)]">Nessun operatore nel gruppo.</p>
        ) : (
          <>
            <AffidiFiltroOperatore
              operatori={membriCarico}
              selezionatoId={selezionatoId}
              coda={coda}
            />
            <AffidiCaricoOperatori
              carico={carico}
              selezionatoId={selezionatoId}
              coda={coda}
            />
            {mostraElenco ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                <Link href="/affidi" className="underline">
                  Chiudi dettaglio
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Clicca un numero o un operatore per aprire le pratiche corrispondenti.
              </p>
            )}
          </>
        )}
      </Card>

      {mostraElenco ? (
        <Card title={titoloElenco}>
          <AffidiPraticheOperatore
            nome={titoloElenco}
            pratiche={praticheSelezionato}
            showAssegnatario={!selezionatoId}
            operatori={operatori}
          />
        </Card>
      ) : null}

      <Card title="Da affidare">
        {!daAssegnare.length ? (
          <p className="text-sm text-[var(--muted)]">Nessuna pratica da affidare.</p>
        ) : (
          <AffidiDaAffidareTable
            operatori={operatori}
            pratiche={daAssegnare.map((p) => ({
              id: p.id,
              numero: p.numero,
              stato: p.stato,
              residuo: p.residuo,
              debitoreNome: `${p.debitore.nome} ${p.debitore.cognome}`,
            }))}
          />
        )}
      </Card>
    </div>
  );
}
