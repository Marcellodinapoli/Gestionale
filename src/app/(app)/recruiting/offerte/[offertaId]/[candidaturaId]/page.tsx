import Link from "next/link";
import { redirect } from "next/navigation";
import { requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import { getCandidatura } from "@/lib/recruiting/candidatureRepo";
import { isStatoCandidaturaTerminale } from "@/lib/recruiting/candidature";
import { listAttivitaByCandidatura } from "@/lib/recruiting/attivitaRepo";
import { suggerimentoTransizioneCandidatura } from "@/lib/recruiting/attivita";
import { canCreateColloquio } from "@/lib/recruiting/colloqui";
import { listColloquiByCandidatura, listUtentiTenantRecruiting } from "@/lib/recruiting/colloquiRepo";
import { CandidaturaDettaglioClient } from "../../../CandidaturaDettaglioClient";
import { CandidaturaColloquiClient } from "../../../CandidaturaColloquiClient";
import { CandidaturaAttivitaClient } from "../../../CandidaturaAttivitaClient";
import { CandidaturaTimeline } from "../../../CandidaturaTimeline";

export default async function CandidaturaDettaglioPage({
  params,
}: {
  params: Promise<{ offertaId: string; candidaturaId: string }>;
}) {
  const user = await requireNavPage("recruiting");
  if (!can(user, "recruiting:view")) redirect("/");
  const { offertaId, candidaturaId } = await params;
  const [offerta, candidatura] = await Promise.all([
    getOffertaLavoro(user.tenantId, offertaId),
    getCandidatura(user.tenantId, candidaturaId, offertaId),
  ]);
  if (!offerta || !candidatura || candidatura.offertaId !== offerta.id || candidatura.tenantId !== offerta.tenantId) {
    return <p className="text-sm text-rose-700">Candidatura non trovata.</p>;
  }

  const [attivita, colloqui, utenti] = await Promise.all([
    listAttivitaByCandidatura(user.tenantId, candidatura.id),
    listColloquiByCandidatura(user.tenantId, candidatura.id),
    listUtentiTenantRecruiting(user.tenantId),
  ]);
  const canManage = can(user, "recruiting:manage");
  const operabile = canManage && !isStatoCandidaturaTerminale(candidatura.stato);
  const suggerimento = suggerimentoTransizioneCandidatura({
    stato: candidatura.stato,
    attivita: attivita.map((a) => ({ tipo: a.tipo, esito: a.esito })),
  });
  const hasColloquiAperti = colloqui.some(
    (c) => c.stato === "PROGRAMMATO" || c.stato === "SVOLTO"
  );
  const hasContattoONota = attivita.some((a) => a.tipo === "CONTATTO" || a.tipo === "NOTA");
  const hasColloquio = colloqui.length > 0;
  const hasSvolto = colloqui.some((c) => c.stato === "SVOLTO" || c.stato === "ESITATO");
  const hasEsito = colloqui.some((c) => c.stato === "ESITATO");
  let passoProcedura = 1;
  if (candidatura.stato === "ASSUNTA") passoProcedura = 10;
  else if (candidatura.stato === "ARCHIVIATA") passoProcedura = 0;
  else if (candidatura.stato === "RICEVUTA") passoProcedura = hasContattoONota ? 3 : 2;
  else if (candidatura.stato === "IN_VALUTAZIONE") passoProcedura = hasColloquio ? 5 : 4;
  else if (candidatura.stato === "COLLOQUIO") {
    if (hasEsito) passoProcedura = 8;
    else if (hasSvolto) passoProcedura = 7;
    else passoProcedura = 6;
  } else if (candidatura.stato === "PROVA") passoProcedura = 9;

  return (
    <div className="space-y-4">
      <PageHeader title="Candidatura" subtitle={offerta.titolo} />
      <Link href={`/recruiting/offerte/${offerta.id}`} className="text-sm underline">
        ← Candidature
      </Link>
      <CandidaturaDettaglioClient
        candidatura={{ id: candidatura.id, stato: candidatura.stato }}
        canManage={canManage}
        suggerimento={suggerimento}
        hasColloquiAperti={hasColloquiAperti}
        passoProcedura={passoProcedura}
      />
      <CandidaturaAttivitaClient
        candidaturaId={candidatura.id}
        canManage={operabile}
        voci={attivita
          .filter((a) => a.tipo === "CONTATTO" || a.tipo === "NOTA")
          .map((a) => ({
            id: a.id,
            tipo: a.tipo,
            occurredAt: a.occurredAt.toISOString(),
            note: a.note,
            esito: a.esito,
            canale: a.canale,
            createdByName: a.createdByName,
          }))}
      />
      <CandidaturaColloquiClient
        candidaturaId={candidatura.id}
        statoCandidatura={candidatura.stato}
        colloqui={colloqui.map((c) => ({
          id: c.id,
          round: c.round,
          stato: c.stato,
          scheduledAt: c.scheduledAt.toISOString(),
          modalita: c.modalita,
          intervistatoreNome: c.intervistatoreNome,
          notePreliminari: c.notePreliminari,
          noteSvolgimento: c.noteSvolgimento,
          esito: c.esito,
          valutazione: c.valutazione,
        }))}
        utenti={utenti}
        canManage={operabile}
        canCreate={operabile && canCreateColloquio(candidatura.stato)}
      />
      <CandidaturaTimeline attivita={attivita} />
      <section className="rounded-xl border border-dashed border-[var(--line)] bg-slate-50/70 px-4 py-3 text-xs text-[var(--muted)]">
        <p className="font-semibold uppercase tracking-wide">Riferimenti</p>
        <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <div>
            <dt className="uppercase tracking-wide">Identificativo</dt>
            <dd className="font-mono text-[11px] text-slate-600">{candidatura.id}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Origine</dt>
            <dd>{candidatura.source || "Non indicata"}</dd>
          </div>
          {candidatura.externalApplicationId ? (
            <div>
              <dt className="uppercase tracking-wide">Identificativo esterno</dt>
              <dd className="font-mono text-[11px] text-slate-600">
                {candidatura.externalApplicationId}
              </dd>
            </div>
          ) : null}
          {candidatura.receiverCandidateId ? (
            <div>
              <dt className="uppercase tracking-wide">Identificativo ricevitore</dt>
              <dd className="font-mono text-[11px] text-slate-600">
                {candidatura.receiverCandidateId}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="uppercase tracking-wide">Ricevuta</dt>
            <dd>{candidatura.receivedAt.toLocaleString("it-IT")}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Aggiornata</dt>
            <dd>{candidatura.updatedAt.toLocaleString("it-IT")}</dd>
          </div>
          {candidatura.lastSyncAt ? (
            <div>
              <dt className="uppercase tracking-wide">Ultimo aggiornamento metadati</dt>
              <dd>{candidatura.lastSyncAt.toLocaleString("it-IT")}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
