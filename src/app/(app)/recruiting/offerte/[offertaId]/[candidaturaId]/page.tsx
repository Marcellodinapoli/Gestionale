import Link from "next/link";
import { canPermissionOrNav, requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { getOffertaLavoro } from "@/lib/recruiting/offerteRepo";
import { getCandidatura } from "@/lib/recruiting/candidatureRepo";
import { isStatoCandidaturaTerminale, anagraficaCandidato } from "@/lib/recruiting/candidature";
import { listAttivitaByCandidatura } from "@/lib/recruiting/attivitaRepo";
import { suggerimentoTransizioneCandidatura, buildProveRows } from "@/lib/recruiting/attivita";
import { canCreateColloquio } from "@/lib/recruiting/colloqui";
import { listColloquiByCandidatura, listSupervisoriTenantRecruiting, listUtentiTenantRecruiting } from "@/lib/recruiting/colloquiRepo";
import { getApplication } from "@/lib/recruiting/receiverClient";
import { ReceiverClientError } from "@/lib/recruiting/receiver";
import { CandidaturaDettaglioClient } from "../../../CandidaturaDettaglioClient";
import { CandidaturaColloquiClient } from "../../../CandidaturaColloquiClient";
import { CandidaturaProveClient } from "../../../CandidaturaProveClient";
import { CandidaturaTimeline } from "../../../CandidaturaTimeline";
import { MarkCandidaturaVista } from "../../../MarkCandidaturaVista";

export default async function CandidaturaDettaglioPage({
  params,
}: {
  params: Promise<{ offertaId: string; candidaturaId: string }>;
}) {
  const user = await requireNavPage("recruiting");
  const { offertaId, candidaturaId } = await params;
  const [offerta, candidatura] = await Promise.all([
    getOffertaLavoro(user.tenantId, offertaId),
    getCandidatura(user.tenantId, candidaturaId, offertaId),
  ]);
  if (!offerta || !candidatura || candidatura.offertaId !== offerta.id || candidatura.tenantId !== offerta.tenantId) {
    return <p className="text-sm text-rose-700">Candidatura non trovata.</p>;
  }

  const [attivita, colloqui, utenti, supervisori] = await Promise.all([
    listAttivitaByCandidatura(user.tenantId, candidatura.id),
    listColloquiByCandidatura(user.tenantId, candidatura.id),
    listUtentiTenantRecruiting(user.tenantId),
    listSupervisoriTenantRecruiting(user.tenantId),
  ]);

  let cvFileName: string | null = null;
  const receiverCandidateId = String(candidatura.receiverCandidateId || "").trim();
  if (receiverCandidateId) {
    try {
      const remote = await getApplication(user.tenantId, receiverCandidateId);
      const name = String(remote.resumeMeta?.fileName || "").trim();
      cvFileName = name || null;
    } catch (e) {
      if (!(e instanceof ReceiverClientError)) {
        console.warn("[recruiting] metadati CV Receiver non disponibili", e);
      }
    }
  }

  const canManage = await canPermissionOrNav(user, "recruiting:manage");
  const operabile = canManage && !isStatoCandidaturaTerminale(candidatura.stato);
  const suggerimento = suggerimentoTransizioneCandidatura({
    stato: candidatura.stato,
    attivita: attivita.map((a) => ({
      tipo: a.tipo,
      esito: a.esito,
      statoA: a.statoA,
    })),
  });
  const hasColloquiAperti = colloqui.some(
    (c) => c.stato === "PROGRAMMATO" || c.stato === "SVOLTO"
  );
  const colloquioProgrammatoId =
    colloqui.find((c) => c.stato === "PROGRAMMATO")?.id ?? null;
  const ultimoColloquio =
    [...colloqui].sort((a, b) => b.round - a.round)[0] ?? null;
  const proveRows = buildProveRows(attivita);
  const ultimaProva = [...proveRows].reverse()[0] ?? null;

  // Contatto della fase corrente (Candidatura → colloquio; Colloquio → prova).
  const lastContatto = [...attivita].reverse().find((a) => {
    if (a.tipo !== "CONTATTO") return false;
    if (candidatura.stato === "RICEVUTA" || candidatura.stato === "IN_VALUTAZIONE") {
      return a.statoA === "RICEVUTA" || a.statoA === "IN_VALUTAZIONE";
    }
    return a.statoA === candidatura.stato;
  });
  const candidato = anagraficaCandidato(candidatura);

  return (
    <div className="space-y-4">
      <MarkCandidaturaVista userId={user.id} candidaturaId={candidatura.id} />
      <PageHeader title={candidato.label} subtitle={offerta.titolo} />
      <Link href="/recruiting" className="text-sm underline">
        ← Recruiting
      </Link>
      <CandidaturaDettaglioClient
        candidatura={{
          id: candidatura.id,
          stato: candidatura.stato,
          cognome: candidato.cognome,
          nome: candidato.nome,
          email: candidatura.email,
          phone: candidatura.phone,
          coverLetter: candidatura.coverLetter,
          source: candidatura.source,
          receivedAt: candidatura.receivedAt.toISOString(),
          receiverCandidateId: candidatura.receiverCandidateId,
          cvFileName,
        }}
        offerta={{ id: offerta.id, titolo: offerta.titolo }}
        canManage={canManage}
        canViewCv={true}
        operabile={operabile}
        canCreateColloquio={operabile && canCreateColloquio(candidatura.stato)}
        colloquioProgrammatoId={colloquioProgrammatoId}
        utenti={utenti}
        supervisori={supervisori}
        suggerimento={suggerimento}
        hasColloquiAperti={hasColloquiAperti}
        contatto={
          lastContatto
            ? {
                id: lastContatto.id,
                canale: lastContatto.canale || "TELEFONO",
                esito: lastContatto.esito || "",
                occurredAt: lastContatto.occurredAt.toISOString(),
                note: lastContatto.note,
              }
            : null
        }
        ultimoColloquio={
          ultimoColloquio
            ? {
                id: ultimoColloquio.id,
                esito: ultimoColloquio.esito,
                stato: ultimoColloquio.stato,
                valutazioneStelle: ultimoColloquio.valutazioneStelle,
                noteSvolgimento: ultimoColloquio.noteSvolgimento,
              }
            : null
        }
        ultimaProva={
          ultimaProva
            ? {
                id: ultimaProva.id,
                esito: ultimaProva.esito,
                valutazioneStelle: ultimaProva.valutazioneStelle,
                parere: ultimaProva.parere,
              }
            : null
        }
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
          intervistatoreUserId: c.intervistatoreUserId,
          intervistatoreLabel: c.intervistatoreLabel,
          intervistatoreNome: c.intervistatoreNome,
          notePreliminari: c.notePreliminari,
          noteSvolgimento: c.noteSvolgimento,
          esito: c.esito,
          valutazione: c.valutazione,
          valutazioneStelle: c.valutazioneStelle,
        }))}
        utenti={utenti}
        canManage={operabile}
        canCreate={operabile && canCreateColloquio(candidatura.stato)}
      />
      <CandidaturaProveClient
        candidaturaId={candidatura.id}
        statoCandidatura={candidatura.stato}
        prove={proveRows.map((p) => ({
          id: p.id,
          scheduledAt: p.scheduledAt.toISOString(),
          modalita: p.modalita,
          affiancatore: p.affiancatore,
          affiancatoreUserId:
            supervisori.find((u) => u.name === p.affiancatore)?.id ?? null,
          notePreliminari: p.notePreliminari,
          esito: p.esito,
          parere: p.parere,
          valutazioneStelle: p.valutazioneStelle,
        }))}
        utenti={supervisori}
        canManage={operabile}
      />
      <CandidaturaTimeline attivita={attivita} />
    </div>
  );
}
