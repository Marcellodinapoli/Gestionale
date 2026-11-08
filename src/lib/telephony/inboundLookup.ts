import { isConnectorProvider } from "@/lib/data/factory";
import { buildPraticaCercaWhere } from "@/lib/praticaCerca";
import { inboundScreenPopScopeWhere } from "@/lib/gruppoPerimetroScope";
import { praticaDb, resolveTenantSlug } from "@/lib/praticheRepo";
import type { SessionUser } from "@/lib/permissions";
import {
  STATO_OPERATIVO_LABELS,
  statoOperativoPratica,
  type StatoOperativo,
} from "@/lib/statoOperativoPratica";
import { STATI_PRATICA_CHIUSA } from "@/lib/praticheInattive";
import { canAccessPratica } from "@/lib/domain";
import { incassiDbFromUser } from "@/lib/incassiRepo";
import { describeInboundPraticaFase } from "@/lib/telephony/inboundPopFase";
import type {
  InboundCallLookupResponse,
  InboundCallPraticaMatch,
} from "@/lib/telephony/inboundLookupDto";

export type { InboundCallLookupResponse, InboundCallPraticaMatch } from "@/lib/telephony/inboundLookupDto";

function nettoDaPagareEffettivo(
  residuo: number,
  nettoDaPagare: number | null | undefined,
  pagatoIncassi: number
): number {
  const nettoBase =
    nettoDaPagare != null && Number.isFinite(Number(nettoDaPagare))
      ? Number(nettoDaPagare)
      : residuo;
  return Math.max(0, nettoBase - Math.max(0, pagatoIncassi));
}

export async function lookupPraticheInboundCall(
  user: SessionUser,
  numeroRaw: string,
  opts?: { numeroChiamato?: string }
): Promise<InboundCallLookupResponse> {
  const numero = numeroRaw.trim();
  const numeroChiamato = opts?.numeroChiamato?.trim() || undefined;
  if (numero.length < 3) {
    return { numero, ...(numeroChiamato ? { numeroChiamato } : {}), matches: [] };
  }

  const filtro = isConnectorProvider()
    ? ({ cercaPratica: { campo: "telefono", q: numero } } as Record<string, unknown>)
    : buildPraticaCercaWhere("telefono", numero);
  if (!filtro) {
    return { numero, ...(numeroChiamato ? { numeroChiamato } : {}), matches: [] };
  }

  const scope = await inboundScreenPopScopeWhere(user);
  const model = praticaDb({
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
    role: user.role,
    userId: user.id,
    skipRoleScope: true,
  });

  const rows = await model.findMany({
    where: { AND: [scope, filtro] },
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      numero: true,
      stato: true,
      residuo: true,
      nettoDaPagare: true,
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

  const [accessFlags, pagatoPerPratica] = await Promise.all([
    Promise.all(rows.map((p) => canAccessPratica(user, p.id))),
    Promise.all(
      rows.map(async (p) => {
        const sum = await incassiDbFromUser(user).aggregate({
          where: { praticaId: p.id },
          _sum: { importo: true },
        });
        return Math.max(0, sum._sum.importo || 0);
      })
    ),
  ]);

  const matches: InboundCallPraticaMatch[] = rows.map((p, i) => {
    const op = statoOperativoPratica({
      stato: p.stato,
      assegnatarioId: p.assegnatarioId,
      scadenza: p.scadenza,
      codiceScaricoBk: p.codiceScaricoBk,
    });
    const statoLabel =
      op in STATO_OPERATIVO_LABELS
        ? STATO_OPERATIVO_LABELS[op as StatoOperativo]
        : String(op);
    const praticaChiusa = (STATI_PRATICA_CHIUSA as readonly string[]).includes(p.stato);
    const schedaApribile = accessFlags[i] === true;
    const statoOperativoStr = typeof op === "string" ? op : String(op);
    return {
      praticaId: p.id,
      numero: p.numero,
      debitore: [p.debitore.cognome, p.debitore.nome].filter(Boolean).join(" ") || "—",
      mandanteCodice: p.mandante.codice,
      mandanteRagioneSociale: p.mandante.ragioneSociale,
      inLavorazione: op === "IN_LAVORAZIONE",
      statoLabel,
      praticaChiusa,
      residuo: Number(p.residuo) || 0,
      nettoDaPagare: nettoDaPagareEffettivo(
        Number(p.residuo) || 0,
        p.nettoDaPagare,
        pagatoPerPratica[i] ?? 0
      ),
      schedaApribile,
      ...(schedaApribile
        ? {}
        : {
            faseDescrizione: describeInboundPraticaFase({
              stato: p.stato,
              statoOperativo: statoOperativoStr,
              scadenza: p.scadenza,
              dataPassaggioGiudiziale: p.dataPassaggioGiudiziale,
              conferimentoTipo: p.conferimentoTipo,
              statoAvvioGiudiziale: p.giudiziale?.statoAvvio ?? null,
            }),
          }),
    };
  });

  return { numero, ...(numeroChiamato ? { numeroChiamato } : {}), matches };
}
