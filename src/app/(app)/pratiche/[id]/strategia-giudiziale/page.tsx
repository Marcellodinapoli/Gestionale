import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { canAccessPratica, dataIt, euro } from "@/lib/domain";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { attivitaDbFromUser } from "@/lib/attivitaRepo";
import { getPraticaGiudizialeByPraticaId } from "@/lib/giudiziale/praticaGiudizialeRepo";
import {
  labelMotivo,
  labelStatoAvvio,
} from "@/lib/giudiziale/avvioGiudiziale";
import {
  labelEsitoGiudiziale,
  labelStatoProcedura,
  labelStrategiaScelta,
} from "@/lib/giudiziale/strategiaGiudiziale";
import { GiudizialeNavTabs } from "@/components/giudiziale/GiudizialeNavTabs";
import { StrategiaProceduraForm } from "@/components/giudiziale/StrategiaProceduraForm";
import { PageHeader } from "@/components/ui";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";

export default async function StrategiaGiudizialePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("legal:view");
  const { id } = await params;
  if (!(await canAccessPratica(user, id))) notFound();

  const pratica = await praticaDbFromUser(user).findUnique({
    where: { id },
    include: {
      debitore: { select: { nome: true, cognome: true } },
      mandante: { select: { codice: true, ragioneSociale: true } },
    },
  });
  if (!pratica) notFound();

  const giudiziale = await getPraticaGiudizialeByPraticaId(user, id);

  const eventiAttivita = await attivitaDbFromUser(user).findMany({
    where: { praticaId: id, tipo: "GIUDIZIALE" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true } } },
  });

  const debitoreNome =
    `${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim() || "—";
  const residuo = pratica.residuo || 0;
  const conclusa = giudiziale?.statoAvvio === "CONCLUSA_CON_ESITO";
  const strategiaDisponibile = [
    "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
    "IN_PROCEDURA",
    "CONCLUSA_CON_ESITO",
    "PROCEDURA_AVVIATA",
  ].includes(giudiziale?.statoAvvio || "");
  const formReadOnly = conclusa || !strategiaDisponibile;
  return (
    <div className="h-full min-h-0">
      <PraticaContabileShell
        praticaId={pratica.id}
        numero={pratica.numero}
        debitore={debitoreNome}
      >
        <div className="space-y-4">
          <GiudizialeNavTabs
            praticaId={pratica.id}
            attivo="strategia"
          />

          <PageHeader
            title="Strategia / procedura"
            subtitle={`Pratica ${pratica.numero} · ${debitoreNome} · Pianificazione e gestione dell'azione giudiziale`}
          />

          <section className="grid gap-2 rounded-lg border border-[var(--line)] bg-[#eef4f8] p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                Mandante
              </div>
              <div>
                {pratica.mandante.codice} — {pratica.mandante.ragioneSociale}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                Residuo
              </div>
              <div className="font-semibold tabular-nums">{euro(residuo)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                Stato giudiziale
              </div>
              <div className="font-semibold text-[var(--navy)]">
                {giudiziale ? labelStatoAvvio(giudiziale.statoAvvio) : "Non avviata"}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                Motivo passaggio
              </div>
              <div>
                {giudiziale?.motivoPassaggio
                  ? labelMotivo(giudiziale.motivoPassaggio)
                  : "—"}
              </div>
            </div>
          </section>

          {giudiziale?.strategiaScelta || giudiziale?.esitoGiudiziale ? (
            <section className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-3 text-sm sm:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Strategia
                </div>
                <div className="font-semibold text-[var(--navy)]">
                  {labelStrategiaScelta(giudiziale.strategiaScelta)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Stato procedura
                </div>
                <div>{labelStatoProcedura(giudiziale.statoProcedura)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Esito
                </div>
                <div className="font-semibold">
                  {labelEsitoGiudiziale(giudiziale.esitoGiudiziale)}
                </div>
              </div>
            </section>
          ) : null}

          {conclusa ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Procedura conclusa
              {giudiziale?.esitoRegistratoAt
                ? ` il ${dataIt(new Date(giudiziale.esitoRegistratoAt))}`
                : ""}
              . Solo consultazione.
            </p>
          ) : null}

          {!conclusa && !strategiaDisponibile ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Strategia non ancora abilitata al salvataggio. Completa prima{" "}
              <Link
                href={`/pratiche/${pratica.id}/valutazione-legale`}
                className="font-semibold underline"
              >
                Valutazione
              </Link>{" "}
              (puoi comunque consultare il form).
            </p>
          ) : null}

          <StrategiaProceduraForm
            praticaId={pratica.id}
            readOnly={formReadOnly}
            initial={{
              strategiaScelta: giudiziale?.strategiaScelta,
              proceduraDaSeguire: giudiziale?.proceduraDaSeguire,
              professionistaIncaricato: giudiziale?.professionistaIncaricato,
              attivitaProceduraJson: giudiziale?.attivitaProceduraJson,
              agendaScadenze: giudiziale?.agendaScadenze,
              documentiDaProdurre: giudiziale?.documentiDaProdurre,
              statoProcedura: giudiziale?.statoProcedura,
              eventiStorico: giudiziale?.eventiStorico,
              costiSostenuti: giudiziale?.costiSostenuti,
              esitoGiudiziale: giudiziale?.esitoGiudiziale,
              noteLegaliOperatori: giudiziale?.noteLegaliOperatori,
            }}
          />

          {eventiAttivita.length > 0 ? (
            <section className="rounded-lg border border-[var(--line)] bg-white p-3">
              <h3 className="text-sm font-bold text-[var(--navy)]">
                Storico eventi giudiziali
              </h3>
              <ul className="mt-2 space-y-2 text-sm">
                {eventiAttivita.map((ev) => (
                  <li
                    key={ev.id}
                    className="border-b border-[var(--line)]/50 pb-2 last:border-0"
                  >
                    <div className="text-[11px] text-[var(--muted)]">
                      {dataIt(new Date(ev.createdAt))}
                      {ev.user?.name ? ` · ${ev.user.name}` : ""}
                    </div>
                    <div className="text-[var(--navy)]">{ev.nota}</div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/pratiche/${pratica.id}`}
              className="inline-flex h-9 items-center rounded-lg border border-[#7d94a8] bg-white px-3 text-sm font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
            >
              Torna alla pratica
            </Link>
          </div>
        </div>
      </PraticaContabileShell>
    </div>
  );
}
