import { canAccessPratica } from "@/lib/domain";
import { inboundScreenPopScopeWhere } from "@/lib/gruppoPerimetroScope";
import { praticaDb, resolveTenantSlug } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";
import {
  STATO_OPERATIVO_LABELS,
  statoOperativoPratica,
  type StatoOperativo,
} from "@/lib/statoOperativoPratica";
import { describeInboundPraticaFase } from "@/lib/telephony/inboundPopFase";

export type PraticaVistaFaseLimitata = {
  praticaId: string;
  numero: string;
  debitore: string;
  mandanteCodice: string;
  mandanteRagioneSociale: string;
  faseDescrizione: string;
};

/** Scheda non apribile ma pratica visibile in ambito inbound (popup). */
export async function resolvePraticaVistaFaseLimitata(
  user: SessionUser,
  praticaId: string
): Promise<PraticaVistaFaseLimitata | null> {
  if (await canAccessPratica(user, praticaId)) return null;

  const scope = await inboundScreenPopScopeWhere(user);
  const model = praticaDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
    role: user.role,
    userId: user.id,
    skipRoleScope: true,
  });

  const p = await model.findFirst({
    where: { AND: [scope, { id: praticaId }] },
    select: {
      id: true,
      numero: true,
      stato: true,
      assegnatarioId: true,
      scadenza: true,
      codiceScaricoBk: true,
      dataPassaggioGiudiziale: true,
      conferimentoTipo: true,
      debitore: { select: { nome: true, cognome: true } },
      mandante: { select: { codice: true, ragioneSociale: true } },
      giudiziale: { select: { statoAvvio: true } },
    },
  });
  if (!p) return null;

  const op = statoOperativoPratica({
    stato: p.stato,
    assegnatarioId: p.assegnatarioId,
    scadenza: p.scadenza,
    codiceScaricoBk: p.codiceScaricoBk,
  });
  const statoOperativoStr =
    op in STATO_OPERATIVO_LABELS
      ? STATO_OPERATIVO_LABELS[op as StatoOperativo]
      : String(op);

  return {
    praticaId: p.id,
    numero: p.numero,
    debitore: [p.debitore.cognome, p.debitore.nome].filter(Boolean).join(" ") || "—",
    mandanteCodice: p.mandante.codice,
    mandanteRagioneSociale: p.mandante.ragioneSociale,
    faseDescrizione: describeInboundPraticaFase({
      stato: p.stato,
      statoOperativo: statoOperativoStr,
      scadenza: p.scadenza,
      dataPassaggioGiudiziale: p.dataPassaggioGiudiziale,
      conferimentoTipo: p.conferimentoTipo,
      statoAvvioGiudiziale: p.giudiziale?.statoAvvio ?? null,
    }),
  };
}
