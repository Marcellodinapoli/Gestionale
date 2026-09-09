import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { canAccessPratica, euro } from "@/lib/domain";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { getPraticaGiudizialeByPraticaId } from "@/lib/giudiziale/praticaGiudizialeRepo";
import {
  labelMotivo,
  labelStatoAvvio,
} from "@/lib/giudiziale/avvioGiudiziale";
import { GiudizialeNavTabs } from "@/components/giudiziale/GiudizialeNavTabs";
import { ValutazioneLegaleForm } from "@/components/giudiziale/ValutazioneLegaleForm";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";
import { PageHeader } from "@/components/ui";

export default async function ValutazioneLegalePage({
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

  const debitoreNome =
    `${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim() || "—";
  const residuo = pratica.residuo || 0;
  const archiviata = giudiziale?.statoAvvio === "ARCHIVIATA_SENZA_AZIONE";
  const valutazioneBloccata =
    archiviata ||
    giudiziale?.statoAvvio === "IN_PROCEDURA" ||
    giudiziale?.statoAvvio === "CONCLUSA_CON_ESITO";
  const valutazioneDisponibile = [
    "IN_ATTESA_VALUTAZIONE_LEGALE",
    "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
    "IN_PROCEDURA",
    "CONCLUSA_CON_ESITO",
    "PROCEDURA_AVVIATA",
  ].includes(giudiziale?.statoAvvio || "");

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
            attivo="valutazione"
          />

          <PageHeader
            title="Valutazione legale"
            subtitle={`Pratica ${pratica.numero} · ${debitoreNome}`}
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

          {archiviata ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Fase giudiziale archiviata senza azione: la valutazione non è modificabile.
            </p>
          ) : null}

          {!archiviata && !valutazioneDisponibile ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Valutazione non ancora richiesta. Completa prima la sezione{" "}
              <Link
                href={`/pratiche/${pratica.id}/avvio-giudiziale`}
                className="font-semibold underline"
              >
                Avvio
              </Link>{" "}
              con «Richiedi valutazione legale» (puoi comunque consultare il form).
            </p>
          ) : null}

          {giudiziale?.statoAvvio === "IN_PROCEDURA" ||
          giudiziale?.statoAvvio === "CONCLUSA_CON_ESITO" ? (
            <p className="rounded-lg border border-[var(--line)] bg-[#eef4f8] px-3 py-2 text-sm text-[var(--navy)]">
              Valutazione completata: i dati sono in sola lettura. Continua da Strategia /
              procedura.
            </p>
          ) : null}

          <ValutazioneLegaleForm
            praticaId={pratica.id}
            readOnly={valutazioneBloccata}
            initial={
              giudiziale
                ? {
                    titoloCreditoEsistenza: giudiziale.titoloCreditoEsistenza || "",
                    titoloCreditoValidita: giudiziale.titoloCreditoValidita || "",
                    titoloCreditoEsigibilita: giudiziale.titoloCreditoEsigibilita || "",
                    prescrizioneTermini: giudiziale.prescrizioneTermini || "",
                    documentazioneProve: giudiziale.documentazioneProve || "",
                    contestazioniDebitore: giudiziale.contestazioniDebitore || "",
                    solvibilitaRecupero: giudiziale.solvibilitaRecupero || "",
                    giudiceCompetente: giudiziale.giudiceCompetente || "",
                    foroEventuale: giudiziale.foroEventuale || "",
                    tipoAzioneIpotizzata: giudiziale.tipoAzioneIpotizzata || "",
                    tipoAzioneAltroDettaglio: giudiziale.tipoAzioneAltroDettaglio || "",
                    costiBenefici: giudiziale.costiBenefici || "",
                    rischiLegali: giudiziale.rischiLegali || "",
                    parereValutazione: giudiziale.parereValutazione || "",
                    parereMotivazione: giudiziale.parereMotivazione || "",
                    valutazioneCompletataAt: giudiziale.valutazioneCompletataAt
                      ? String(giudiziale.valutazioneCompletataAt)
                      : null,
                  }
                : undefined
            }
          />

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
