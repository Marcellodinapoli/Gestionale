import "server-only";
import { prisma } from "@/lib/prisma";
import { getPredictiveDialerService } from "@/lib/predictive-dialer/service/factory";
import type { DialerCampagnaStatsDto, DialerMonitorOperatoreDto } from "@/lib/predictive-dialer/types";
import type { DialerSessioneStato } from "@/lib/predictive-dialer/constants";
import {
  chiamateDaFarePerOperatore,
  computePacingMetrics,
  normalizePacingRatio,
} from "@/lib/predictive-dialer/pacing";
import { providerSupportsSetPacing } from "@/lib/predictive-dialer/dialerSync";

function isPraticaToccata(stato: string, tentativi: number): boolean {
  return tentativi > 0 || !["disponibile", "in_coda"].includes(stato);
}

async function loadPraticheParlatePerOperatore(campagnaId: string): Promise<Map<string, number>> {
  const rows = await prisma.dialerChiamataEvento.findMany({
    where: { campagnaId, tipo: "collegata", applied: true, operatoreId: { not: null }, praticaId: { not: null } },
    select: { operatoreId: true, praticaId: true },
  });
  const seen = new Set<string>();
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.operatoreId || !r.praticaId) continue;
    const key = `${r.operatoreId}:${r.praticaId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    map.set(r.operatoreId, (map.get(r.operatoreId) ?? 0) + 1);
  }
  return map;
}

export async function loadCampagnaStats(
  tenantId: string,
  campagnaId: string
): Promise<DialerCampagnaStatsDto> {
  const [pratiche, eventi, operatori, campagna] = await Promise.all([
    prisma.dialerCampagnaPratica.findMany({
      where: { campagnaId },
      include: {
        pratica: {
          select: {
            codiceScarico: true,
            debitore: { select: { telefono: true } },
          },
        },
      },
    }),
    prisma.dialerChiamataEvento.findMany({
      where: { campagnaId },
      select: { tipo: true, esito: true, praticaId: true },
    }),
    prisma.dialerCampagnaOperatore.findMany({
      where: { campagnaId },
      select: { sessioneStato: true },
    }),
    prisma.dialerCampagna.findFirst({ where: { id: campagnaId, tenantId } }),
  ]);

  const praticheTotali = pratiche.length;
  const praticheLavorate = pratiche.filter((p) =>
    ["conclusa", "non_risposta", "richiamare"].includes(p.stato)
  ).length;
  const praticheRimanenti = praticheTotali - praticheLavorate;

  const clientiTotali = praticheTotali;
  const clientiToccati = pratiche.filter((p) => isPraticaToccata(p.stato, p.tentativi)).length;
  const clientiRimanenti = clientiTotali - clientiToccati;

  const conNumero = pratiche.filter((p) => (p.pratica.debitore?.telefono?.trim() ?? "").length > 0);
  const numeriTotali = conNumero.length;
  const numeriToccati = conNumero.filter((p) => isPraticaToccata(p.stato, p.tentativi)).length;
  const numeriRimanenti = numeriTotali - numeriToccati;

  const chiamateTotali = eventi.filter((e) =>
    ["iniziata", "terminata", "no_risposta", "collegata"].includes(e.tipo)
  ).length;
  const chiamateRisposta = eventi.filter(
    (e) => e.tipo === "collegata" || e.tipo === "risposta" || e.esito === "risposta"
  ).length;
  const chiamateNoRisposta = eventi.filter((e) => e.tipo === "no_risposta" || e.esito === "no_risposta").length;
  const chiamateOccupato = eventi.filter((e) => e.tipo === "occupato" || e.esito === "occupato").length;
  const chiamateErrore = eventi.filter((e) => e.tipo === "errore" || e.esito === "errore").length;

  const countStato = (st: DialerSessioneStato) =>
    operatori.filter((o) => o.sessioneStato === st).length;

  const perCodice = new Map<
    string,
    { praticheTotali: number; praticheLavorate: number; praticheToccati: number; chiamateTotali: number }
  >();
  for (const p of pratiche) {
    const codice = p.pratica.codiceScarico?.trim().toUpperCase() || "—";
    const cur = perCodice.get(codice) ?? {
      praticheTotali: 0,
      praticheLavorate: 0,
      praticheToccati: 0,
      chiamateTotali: 0,
    };
    cur.praticheTotali += 1;
    if (["conclusa", "non_risposta", "richiamare"].includes(p.stato)) cur.praticheLavorate += 1;
    if (isPraticaToccata(p.stato, p.tentativi)) cur.praticheToccati += 1;
    perCodice.set(codice, cur);
  }
  for (const e of eventi) {
    if (!e.praticaId) continue;
    const pr = pratiche.find((p) => p.praticaId === e.praticaId);
    const codice = pr?.pratica.codiceScarico?.trim().toUpperCase() || "—";
    const cur = perCodice.get(codice) ?? {
      praticheTotali: 0,
      praticheLavorate: 0,
      praticheToccati: 0,
      chiamateTotali: 0,
    };
    if (e.tipo === "terminata" || e.tipo === "no_risposta" || e.tipo === "iniziata") cur.chiamateTotali += 1;
    perCodice.set(codice, cur);
  }

  const service = await getPredictiveDialerService(tenantId);
  let dialerStato: DialerCampagnaStatsDto["dialerStato"] = {
    connesso: false,
    pacingRatio: campagna?.pacingRatio ?? null,
    actualCallsPerMinute: null,
    messaggio: "Provider non configurato",
    providerSupportsSetPacing: providerSupportsSetPacing(service.providerId),
  };

  if (campagna?.externalId) {
    const status = await service.getCampaignStatus?.(campagna.externalId);
    if (status) {
      dialerStato = {
        connesso: status.connesso,
        pacingRatio: status.pacingRatio ?? campagna.pacingRatio,
        actualCallsPerMinute: status.actualCallsPerMinute ?? null,
        messaggio: status.messaggio ?? "",
        providerSupportsSetPacing: providerSupportsSetPacing(service.providerId),
      };
    }
  }

  const operatoriDisponibili = countStato("disponibile");
  const pacingRatio = normalizePacingRatio(
    dialerStato.pacingRatio ?? campagna?.pacingRatio ?? undefined
  );
  const pacing = computePacingMetrics({
    pacingRatio,
    operatoriDisponibili,
    praticheRimanenti: clientiRimanenti,
    actualCallsPerMinute: dialerStato.actualCallsPerMinute,
    providerConnected: dialerStato.connesso,
  });

  return {
    praticheTotali,
    praticheLavorate,
    praticheRimanenti,
    clientiTotali,
    clientiToccati,
    clientiRimanenti,
    numeriTotali,
    numeriToccati,
    numeriRimanenti,
    numeriChiamati: numeriToccati,
    chiamateTotali,
    chiamateRisposta,
    chiamateNoRisposta,
    chiamateOccupato,
    chiamateErrore,
    operatoriDisponibili,
    operatoriConnecting: countStato("connecting"),
    operatoriInChiamata: countStato("in_chiamata"),
    operatoriPostCall: countStato("post_call"),
    operatoriOccupati: countStato("in_chiamata") + countStato("post_call") + countStato("connecting"),
    operatoriInPausa: countStato("pausa"),
    operatoriFuori: countStato("fuori"),
    perCodiceScarico: [...perCodice.entries()].map(([codice, v]) => ({
      codice,
      praticheTotali: v.praticheTotali,
      praticheLavorate: v.praticheLavorate,
      praticheRimanenti: v.praticheTotali - v.praticheLavorate,
      praticheToccati: v.praticheToccati,
      chiamateTotali: v.chiamateTotali,
    })),
    campagnaStato: campagna?.stato ?? "BOZZA",
    pacing,
    dialerStato,
  };
}

export async function loadMonitorOperatori(
  campagnaId: string,
  pacingRatio?: number | null
): Promise<DialerMonitorOperatoreDto[]> {
  const ratio = normalizePacingRatio(pacingRatio ?? undefined);
  const [rows, parlateMap] = await Promise.all([
    prisma.dialerCampagnaOperatore.findMany({
      where: { campagnaId, accettatoAt: { not: null } },
      include: { operatore: { select: { name: true } } },
      orderBy: { operatore: { name: "asc" } },
    }),
    loadPraticheParlatePerOperatore(campagnaId),
  ]);
  const now = Date.now();
  return rows.map((r) => {
    const pausaDurataSec =
      r.sessioneStato === "pausa" && r.pausaInizioAt
        ? Math.floor((now - r.pausaInizioAt.getTime()) / 1000)
        : 0;
    const durataMediaSec =
      r.chiamateCount > 0 ? Math.round(r.durataTotaleSec / r.chiamateCount) : 0;
    return {
      operatoreId: r.operatoreId,
      operatoreNome: r.operatore.name,
      sessioneStato: r.sessioneStato as DialerSessioneStato,
      pausaInizioAt: r.pausaInizioAt?.toISOString() ?? null,
      pausaDurataSec,
      chiamateCount: r.chiamateCount,
      praticheParlate: parlateMap.get(r.operatoreId) ?? 0,
      durataTotaleSec: r.durataTotaleSec,
      durataMediaSec,
      praticaCorrenteId: r.praticaCorrenteId,
      chiamateDaFare: chiamateDaFarePerOperatore(r.sessioneStato as DialerSessioneStato, ratio),
    };
  });
}
