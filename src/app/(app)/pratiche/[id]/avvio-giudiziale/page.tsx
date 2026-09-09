import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { canAccessPratica, dataIt, euro, dateInputValue } from "@/lib/domain";
import { praticaDbFromUser } from "@/lib/praticheRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { STATO_LABELS } from "@/lib/permissions";
import { getPraticaGiudizialeByPraticaId } from "@/lib/giudiziale/praticaGiudizialeRepo";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";
import { AvvioGiudizialeForm } from "@/components/giudiziale/AvvioGiudizialeForm";
import { GiudizialeNavTabs } from "@/components/giudiziale/GiudizialeNavTabs";
import { PageHeader } from "@/components/ui";
import { isGiudizialePrevistoSulLotto } from "@/lib/conferimentoLegale";

export default async function AvvioGiudizialePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("legal:view");
  const { id } = await params;
  if (!(await canAccessPratica(user, id))) notFound();

  const [pratica, giudiziale, referenti] = await Promise.all([
    praticaDbFromUser(user).findUnique({
      where: { id },
      include: {
        debitore: true,
        mandante: { select: { codice: true, ragioneSociale: true } },
        assegnatario: { select: { id: true, name: true } },
      },
    }),
    getPraticaGiudizialeByPraticaId(user, id),
    usersDbFromUser(user).findMany({
      where: {
        tenantId: user.tenantId,
        active: true,
        role: { in: ["LEGAL", "ADMIN", "AMMINISTRAZIONE"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!pratica) notFound();

  const giudizialeSulLotto = isGiudizialePrevistoSulLotto(pratica.conferimentoTipo);

  const importoAffidato =
    (pratica.capitale || 0) + (pratica.interessi || 0) + (pratica.spese || 0);
  const debitoreNome =
    `${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim() || "—";
  const statoLabel = STATO_LABELS[pratica.stato] || pratica.stato;

  const toDateInput = (v: Date | string | null | undefined) => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    return dateInputValue(v);
  };

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
            attivo="avvio"
          />

          <PageHeader
            title="Avvio attività giudiziale"
            subtitle={`Stessa pratica ${pratica.numero} · passaggio dalla gestione stragiudiziale`}
          />

          <section className="space-y-2 rounded-lg border border-[var(--line)] bg-[#eef4f8] p-3">
            <h2 className="text-sm font-bold text-[var(--navy)]">Riepilogo pratica</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  N. pratica
                </dt>
                <dd className="font-mono font-semibold text-[var(--navy)]">{pratica.numero}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Mandante
                </dt>
                <dd>
                  {pratica.mandante.codice} — {pratica.mandante.ragioneSociale}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Debitore
                </dt>
                <dd>{debitoreNome}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Importo affidato
                </dt>
                <dd className="tabular-nums">{euro(importoAffidato)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Residuo
                </dt>
                <dd className="tabular-nums font-semibold">{euro(pratica.residuo || 0)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Stato attuale
                </dt>
                <dd>{statoLabel}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                  Assegnatario
                </dt>
                <dd>{pratica.assegnatario?.name || "—"}</dd>
              </div>
              {pratica.conferimentoTipo ? (
                <div>
                  <dt className="text-[11px] font-semibold uppercase text-[var(--muted)]">
                    Conferimento lotto
                  </dt>
                  <dd>
                    {pratica.conferimentoTipo}
                    {pratica.dataPassaggioGiudiziale
                      ? ` · passaggio ${dataIt(new Date(pratica.dataPassaggioGiudiziale))}`
                      : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs text-[var(--muted)]">
              Storico stragiudiziale, documenti e comunicazioni restano sulla stessa pratica.
            </p>
          </section>

          {can(user, "legal:view") ? (
            <>
              {!giudizialeSulLotto ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Sul lotto/perimetro di questa pratica non è previsto il mandato giudiziale:
                  l&apos;avvio giudiziale non è disponibile.
                </p>
              ) : null}
              <AvvioGiudizialeForm
              praticaId={pratica.id}
              referentiInterni={referenti}
              readOnly={!giudizialeSulLotto}
              initial={
                giudiziale
                  ? {
                      statoAvvio: giudiziale.statoAvvio,
                      dataAffidamentoGiudiziale: toDateInput(
                        giudiziale.dataAffidamentoGiudiziale
                      ),
                      studioLegale: giudiziale.studioLegale || "",
                      avvocatoReferente: giudiziale.avvocatoReferente || "",
                      referenteInternoId: giudiziale.referenteInternoId || "",
                      noteAffidamento: giudiziale.noteAffidamento || "",
                      motivoPassaggio: giudiziale.motivoPassaggio || "",
                      motivoAltroDettaglio: giudiziale.motivoAltroDettaglio || "",
                      documentazioneDisponibile:
                        giudiziale.documentazioneDisponibile || "",
                      prescrizioneVerificata: giudiziale.prescrizioneVerificata || "",
                      anagraficaDebitoreVerificata:
                        giudiziale.anagraficaDebitoreVerificata || "",
                      valutazioneRecuperabilita:
                        giudiziale.valutazioneRecuperabilita || "",
                      noteVerifica: giudiziale.noteVerifica || "",
                    }
                  : {
                      dataAffidamentoGiudiziale: dateInputValue(new Date()),
                    }
              }
            />
            </>
          ) : null}
        </div>
      </PraticaContabileShell>
    </div>
  );
}
