import { canPermissionOrNav, requireNavPage } from "@/lib/guard";
import { listOfferteLavoro } from "@/lib/recruiting/offerteRepo";
import { getReceiverConfig } from "@/lib/recruiting/receiverRepo";
import { countCandidatureByOfferta, listCandidaturePerHome } from "@/lib/recruiting/candidatureRepo";
import { listColloquiRecenti } from "@/lib/recruiting/colloquiRepo";
import { OfferteLavoroClient } from "./OfferteLavoroClient";
import { RecruitingReceiverClient } from "./RecruitingReceiverClient";

export default async function RecruitingPage() {
  const user = await requireNavPage("recruiting");
  const canManage = await canPermissionOrNav(user, "recruiting:manage");
  const [offerteRows, receiver, counts, candidatureRecenti, colloquiRecenti] = await Promise.all([
    listOfferteLavoro(user.tenantId),
    getReceiverConfig(user.tenantId),
    countCandidatureByOfferta(user.tenantId),
    listCandidaturePerHome(user.tenantId),
    listColloquiRecenti(user.tenantId),
  ]);
  const offerte = offerteRows.map((o) => ({
    id: o.id,
    titolo: o.titolo,
    luogo: o.luogo,
    modalitaLavoro: o.modalitaLavoro,
    tipoContratto: o.tipoContratto,
    orario: o.orario,
    numeroPosizioni: o.numeroPosizioni,
    descrizione: o.descrizione,
    attivitaPrincipali: o.attivitaPrincipali,
    requisiti: o.requisiti,
    competenze: o.competenze,
    retribuzione: o.retribuzione,
    benefit: o.benefit,
    stato: o.stato,
    updatedAt: o.updatedAt.toISOString(),
    candidatureCount: counts[o.id] || 0,
  }));
  const receiverView = receiver
    ? {
        baseUrl: receiver.baseUrl,
        status: receiver.status,
        sourceName: receiver.sourceName,
      }
    : null;

  return (
    <div className="space-y-4">
      <OfferteLavoroClient
        offerte={offerte}
        canManage={canManage}
        userId={user.id}
        candidature={candidatureRecenti.map((c) => ({
          id: c.id,
          offertaId: c.offertaId,
          stato: c.stato,
          source: c.source,
          receivedAt: c.receivedAt.toISOString(),
          cognome: c.cognome,
          nome: c.nome,
        }))}
        colloqui={colloquiRecenti.map((c) => ({
          id: c.id,
          candidaturaId: c.candidaturaId,
          round: c.round,
          stato: c.stato,
          scheduledAt: c.scheduledAt.toISOString(),
          esito: c.esito,
          valutazioneStelle: c.valutazioneStelle,
          intervistatoreNome: c.intervistatoreNome,
        }))}
      />
      <RecruitingReceiverClient config={receiverView} canManage={canManage} />
    </div>
  );
}
