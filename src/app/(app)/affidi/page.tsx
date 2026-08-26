import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { praticaScopeWhere, resolveGruppoPerimetroContext } from "@/lib/gruppoPerimetroScope";
import { getGruppoLavoro } from "@/lib/gruppoLavoro";
import { isManutenzione } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { AffidiDaAffidareTable } from "@/components/affidi/AffidiDaAffidareTable";
import { AffidiFiltroOperatore } from "@/components/affidi/AffidiFiltroOperatore";
import { AffidiPraticheOperatore } from "@/components/affidi/AffidiPraticheOperatore";
import { AffidiPerimetroOverview } from "@/components/affidi/AffidiPerimetroOverview";
import { AffidiFiltriBackOffice } from "@/components/affidi/AffidiFiltriBackOffice";
import {
  AffidiCaricoOperatori,
  buildCaricoOperatori,
  buildAffidiHref,
  etichettaCodaAffidi,
  filtraPraticheAffido,
  parseCodaAffidi,
} from "@/components/affidi/AffidiCaricoOperatori";
import Link from "next/link";
import { Suspense } from "react";
import { GruppoInlineEditor } from "@/components/affidi/GruppoInlineEditor";
import { AffidiIndietroLink } from "@/components/affidi/AffidiIndietroLink";
import { AffidiScrollAffida } from "@/components/affidi/AffidiScrollAffida";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { parseGruppoMandanti, etichettaGruppoMandanti } from "@/lib/gruppoMandanti";
import {
  elencoPerimetriGruppoConfig,
  elencoPerimetriTuttiMandanti,
  filtraPratichePerPerimetro,
  parsePerimetroAffidi,
} from "@/lib/affidiPerimetro";

function mapPraticaAffidabile(
  p: {
    id: string;
    numero: string;
    stato: string;
    residuo: number;
    assegnatarioId: string | null;
    operatoreTitolareId: string | null;
    debitore: { nome: string; cognome: string };
    assegnatario: { name: string } | null;
    operatoreTitolare: { name: string } | null;
  }
) {
  return {
    id: p.id,
    numero: p.numero,
    stato: p.stato,
    residuo: p.residuo,
    debitoreNome: `${p.debitore.nome} ${p.debitore.cognome}`,
    assegnatarioId: p.assegnatarioId,
    assegnatarioNome: p.assegnatario?.name ?? null,
    operatoreTitolareId: p.operatoreTitolareId,
    operatoreTitolareNome: p.operatoreTitolare?.name ?? null,
  };
}

function ordinaPraticheAffidabili<
  T extends { assegnatarioId: string | null; numero: string }
>(pratiche: T[]) {
  return [...pratiche].sort((a, b) => {
    const aNuova = a.assegnatarioId ? 1 : 0;
    const bNuova = b.assegnatarioId ? 1 : 0;
    if (aNuova !== bNuova) return aNuova - bNuova;
    return a.numero.localeCompare(b.numero, "it");
  });
}

export default async function AffidiPage({
  searchParams,
}: {
  searchParams: Promise<{
    operatore?: string;
    coda?: string;
    mandato?: string;
    perimetro?: string;
  }>;
}) {
  const user = await requirePermission("pratiche:assign");
  const {
    operatore: operatoreRaw,
    coda: codaRaw,
    mandato: mandatoRaw,
    perimetro: perimetroRaw,
  } = await searchParams;

  const gruppo = await getGruppoLavoro(user);
  const vuoto = isManutenzione(user);
  const isSupervisor = user.role === "SUPERVISOR";
  const isBackOffice = user.role === "BACK_OFFICE";
  const isVistaGruppo = isSupervisor || isBackOffice;

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
    perimetri: parsePerimetriList(m.perimetri),
  }));

  const [operatori, tuttiOperatori, periCtx] = await Promise.all([
    vuoto
      ? Promise.resolve([])
      : isSupervisor
        ? prisma.user.findMany({
            where: {
              tenantId: user.tenantId,
              supervisorId: user.id,
              active: true,
              role: "OPERATOR",
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, role: true, acronimo: true },
          })
        : prisma.user.findMany({
            where: {
              tenantId: user.tenantId,
              role: { in: ["OPERATOR", "SUPERVISOR"] },
              active: true,
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, role: true, acronimo: true },
          }),
    vuoto
      ? Promise.resolve([])
      : isSupervisor
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
    isSupervisor ? resolveGruppoPerimetroContext(user) : Promise.resolve(null),
  ]);

  const membriCarico = isSupervisor ? gruppo.members : operatori;
  const memberIds = membriCarico.map((m) => m.id);
  const idsOperatoriFiltro = isSupervisor ? memberIds : operatori.map((o) => o.id);
  const baseScope = await praticaScopeWhere(user);

  const praticheScope = await prisma.pratica.findMany({
    where: { AND: [baseScope] },
    select: {
      id: true,
      numero: true,
      stato: true,
      residuo: true,
      scadenza: true,
      codiceScarico: true,
      mandanteId: true,
      numeroMandante: true,
      assegnatarioId: true,
      operatoreTitolareId: true,
      debitoreId: true,
      debitore: { select: { nome: true, cognome: true } },
      mandante: { select: { codice: true } },
      assegnatario: { select: { id: true, name: true } },
      operatoreTitolare: { select: { id: true, name: true } },
    },
    orderBy: { numero: "asc" },
  });
  const praticheAffidabili = praticheScope;
  const daAssegnare = praticheScope.filter((p) => p.assegnatarioId == null);
  const affidate = praticheScope.filter((p) => p.assegnatarioId != null);

  const carico = buildCaricoOperatori(membriCarico, affidate);
  const selezionatoId =
    operatoreRaw && idsOperatoriFiltro.includes(operatoreRaw) ? operatoreRaw : undefined;
  const coda = parseCodaAffidi(codaRaw);
  const selezionato = selezionatoId
    ? membriCarico.find((m) => m.id === selezionatoId) ??
      operatori.find((m) => m.id === selezionatoId)
    : undefined;

  const perimetriDisponibili = isSupervisor
    ? elencoPerimetriGruppoConfig(gruppo.gruppoMandanti, mandantiOptions)
    : isBackOffice
      ? elencoPerimetriTuttiMandanti(mandantiOptions)
      : [];
  const perimetroDecoded = parsePerimetroAffidi(perimetroRaw);
  const refPerimetro =
    isVistaGruppo && mandatoRaw && perimetroDecoded
      ? perimetriDisponibili.find(
          (r) => r.mandanteId === mandatoRaw && r.perimetro === perimetroDecoded
        )
      : undefined;

  const filtraPerMandante = <T extends { mandanteId: string }>(rows: T[]) =>
    isBackOffice && mandatoRaw && !refPerimetro
      ? rows.filter((r) => r.mandanteId === mandatoRaw)
      : rows;

  const perimetriOverview =
    isBackOffice && mandatoRaw && !refPerimetro
      ? perimetriDisponibili.filter((r) => r.mandanteId === mandatoRaw)
      : perimetriDisponibili;

  const navPerimetro = refPerimetro
    ? { mandato: refPerimetro.mandanteId, perimetro: refPerimetro.perimetro }
    : undefined;

  const affidatePerimetro = refPerimetro
    ? filtraPratichePerPerimetro(affidate, refPerimetro)
    : filtraPerMandante(affidate);
  const daAssegnarePerimetro = refPerimetro
    ? filtraPratichePerPerimetro(daAssegnare, refPerimetro)
    : filtraPerMandante(daAssegnare);
  const praticheAffidabiliPerimetro = refPerimetro
    ? filtraPratichePerPerimetro(praticheAffidabili, refPerimetro)
    : filtraPerMandante(praticheAffidabili);
  const caricoPerimetro = refPerimetro
    ? buildCaricoOperatori(membriCarico, affidatePerimetro)
    : buildCaricoOperatori(membriCarico, filtraPerMandante(affidate));

  const mostraElenco = Boolean(selezionatoId || coda) && (Boolean(refPerimetro) || isBackOffice);
  const praticheSelezionato = mostraElenco
    ? filtraPraticheAffido(affidatePerimetro, { operatoreId: selezionatoId, coda })
    : [];
  const titoloElenco = [
    refPerimetro
      ? `${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro}`
      : isBackOffice && mandatoRaw
        ? mandantiOptions.find((m) => m.id === mandatoRaw)?.codice
        : null,
    selezionato
      ? `Pratiche di ${selezionato.name}`
      : refPerimetro
        ? "Pratiche del perimetro"
        : isBackOffice
          ? "Pratiche filtrate"
          : "Pratiche del gruppo",
    coda ? `· ${etichettaCodaAffidi(coda)}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const subtitle = isSupervisor
    ? refPerimetro
      ? `${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro} · ${operatori.length} operatori · ${daAssegnarePerimetro.length} da affidare`
      : `Gruppo di ${user.name} · ${perimetriDisponibili.length} perimetri · ${operatori.length} operatori · ${daAssegnare.length} da affidare`
    : isBackOffice
      ? refPerimetro
        ? `${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro} · ${operatori.length} operatori · ${daAssegnarePerimetro.length} da affidare`
        : mandatoRaw
          ? `${mandantiOptions.find((m) => m.id === mandatoRaw)?.codice ?? "Mandato"} · ${perimetriOverview.length} perimetri · ${daAssegnarePerimetro.length} da affidare`
          : `${mandantiOptions.length} mandati · ${perimetriDisponibili.length} perimetri · ${daAssegnare.length} da affidare`
      : `Assegna le pratiche nuove e monitora il carico operatori`;

  const praticheAffidabiliOverview = refPerimetro
    ? praticheAffidabiliPerimetro
    : filtraPerMandante(praticheAffidabili);
  const daAssegnareOverview = refPerimetro ? daAssegnarePerimetro : filtraPerMandante(daAssegnare);

  const gruppiLavoro =
    !isVistaGruppo
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

  const altriGruppi = isSupervisor
    ? await prisma.user.findMany({
        where: {
          tenantId: user.tenantId,
          role: "SUPERVISOR",
          active: true,
          id: { not: user.id },
        },
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

  if (isVistaGruppo) {
    return (
      <div className="h-full min-h-0 space-y-4 overflow-y-auto pb-4">
        <PageHeader title="Affidi" subtitle={subtitle} />

        <Suspense fallback={null}>
          <AffidiIndietroLink />
          <AffidiScrollAffida />
        </Suspense>

        {isBackOffice ? (
          <Card title="Filtri">
            <AffidiFiltriBackOffice
              mandanti={mandantiOptions}
              perimetri={perimetriDisponibili}
              operatori={operatori}
              mandatoId={mandatoRaw}
              perimetro={refPerimetro?.perimetro}
              operatoreId={selezionatoId}
              coda={codaRaw}
            />
            <p className="mt-2 text-xs text-[var(--muted)]">
              Tutti i mandati e perimetri del tenant. Filtra per mandato, perimetro o operatore.
            </p>
          </Card>
        ) : (
          <Card
            title={
              gruppo.gruppoNome
                ? `Gruppo di lavoro · ${gruppo.gruppoNome}`
                : "Gruppo di lavoro"
            }
          >
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
            <p className="mt-2 text-xs text-[var(--muted)]">
              Gli affidi riguardano solo pratiche nei mandati/perimetri assegnati al gruppo e gli
              operatori sotto {user.name}.
            </p>
          </Card>
        )}

        {isSupervisor && periCtx?.nessunPerimetroGruppo ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Nessun mandato/perimetro configurato sul gruppo: non compaiono pratiche da affidare.
            Configura mandanti e perimetri con <strong>Modifica gruppo</strong>.
          </p>
        ) : null}

        {refPerimetro ? (
          <>
            <Card
              id="affida"
              title={`Affida / riaffida · ${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro}`}
            >
              {!praticheAffidabiliPerimetro.length ? (
                <p className="text-sm text-[var(--muted)]">Nessuna pratica nel perimetro.</p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    {daAssegnarePerimetro.length} non assegnate ·{" "}
                    {praticheAffidabiliPerimetro.length - daAssegnarePerimetro.length} già affidate
                    (definitivo o temporaneo). Scegli tipo affido e operatore per ogni pratica o
                    usa la selezione massiva.
                  </p>
                  <AffidiDaAffidareTable
                    operatori={operatori}
                    pratiche={ordinaPraticheAffidabili(praticheAffidabiliPerimetro).map(
                      mapPraticaAffidabile
                    )}
                  />
                </>
              )}
            </Card>

            <Card title={`Carico operatori · ${refPerimetro.mandanteCodice} · ${refPerimetro.perimetro}`}>
              {!caricoPerimetro.length ? (
                <p className="text-sm text-[var(--muted)]">Nessun operatore.</p>
              ) : (
                <>
                  <AffidiFiltroOperatore
                    operatori={membriCarico}
                    selezionatoId={selezionatoId}
                    coda={codaRaw}
                    nav={navPerimetro}
                  />
                  <AffidiCaricoOperatori
                    carico={caricoPerimetro}
                    selezionatoId={selezionatoId}
                    coda={coda}
                    nav={navPerimetro}
                  />
                  {mostraElenco ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      <Link href={buildAffidiHref(navPerimetro)} className="underline">
                        Chiudi dettaglio pratiche
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Clicca un numero o un operatore per le pratiche di questo perimetro.
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
          </>
        ) : (
          <>
            {!refPerimetro && isBackOffice && (selezionatoId || coda) ? (
              <Card title="Carico operatori">
                <AffidiFiltroOperatore
                  operatori={operatori}
                  selezionatoId={selezionatoId}
                  coda={codaRaw}
                  nav={mandatoRaw ? { mandato: mandatoRaw } : undefined}
                />
                <AffidiCaricoOperatori
                  carico={caricoPerimetro}
                  selezionatoId={selezionatoId}
                  coda={coda}
                  nav={mandatoRaw ? { mandato: mandatoRaw } : undefined}
                />
              </Card>
            ) : null}

            {mostraElenco && !refPerimetro ? (
              <Card title={titoloElenco}>
                <AffidiPraticheOperatore
                  nome={titoloElenco}
                  pratiche={praticheSelezionato}
                  showAssegnatario={!selezionatoId}
                  operatori={operatori}
                />
              </Card>
            ) : null}

            <Card title="Affidi per mandato e perimetro">
              <AffidiPerimetroOverview
                refs={perimetriOverview}
                daAssegnare={daAssegnareOverview}
                affidate={filtraPerMandante(affidate)}
                membri={membriCarico}
              />
            </Card>

            <Card title="Affida / riaffida pratiche">
              {!praticheAffidabiliOverview.length ? (
                <p className="text-sm text-[var(--muted)]">
                  {isBackOffice
                    ? "Nessuna pratica con i filtri selezionati."
                    : "Nessuna pratica nei perimetri del gruppo."}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    {daAssegnareOverview.length} non assegnate ·{" "}
                    {praticheAffidabiliOverview.length - daAssegnareOverview.length} già affidate
                    (definitivo o temporaneo). Puoi riaffidare anche quelle già in carico: seleziona
                    tipo affido e operatore.
                  </p>
                  <AffidiDaAffidareTable
                    operatori={operatori}
                    pratiche={ordinaPraticheAffidabili(praticheAffidabiliOverview).map(
                      mapPraticaAffidabile
                    )}
                  />
                </>
              )}
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 space-y-4 overflow-y-auto pb-4">
      <PageHeader title="Affidi" subtitle={subtitle} />

      {gruppiLavoro.length > 0 ? (
        <Card title="Gruppi di lavoro">
          <div className="space-y-3">
            {gruppiLavoro.map((sup) => (
              <div
                key={sup.id}
                className="rounded-lg border border-[var(--line)] bg-white p-3"
              >
                <div className="flex items-baseline gap-2">
                  {sup.gruppoNome ? (
                    <p className="text-sm font-semibold text-[var(--navy)]">{sup.gruppoNome}</p>
                  ) : (
                    <p className="text-sm italic text-[var(--muted)]">Nome non assegnato</p>
                  )}
                  <span className="text-[10px] text-[var(--muted)]">Supervisor: {sup.name}</span>
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

      <Card title="Carico operatori · code in lavorazione">
        {!carico.length ? (
          <p className="text-sm text-[var(--muted)]">Nessun operatore nel gruppo.</p>
        ) : (
          <>
            <AffidiFiltroOperatore
              operatori={membriCarico}
              selezionatoId={selezionatoId}
              coda={codaRaw}
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

      <Card title="Affida / riaffida pratiche">
        {!praticheAffidabili.length ? (
          <p className="text-sm text-[var(--muted)]">Nessuna pratica nel perimetro.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-[var(--muted)]">
              {daAssegnare.length} non assegnate ·{" "}
              {praticheAffidabili.length - daAssegnare.length} già affidate (definitivo o
              temporaneo). Puoi riaffidare anche quelle già in carico.
            </p>
            <AffidiDaAffidareTable
              operatori={operatori}
              pratiche={ordinaPraticheAffidabili(praticheAffidabili).map(mapPraticaAffidabile)}
            />
          </>
        )}
      </Card>
    </div>
  );
}
