import { euro, dataIt, oraIt } from "@/lib/domain";
import { esitoContattoLabel } from "@/lib/contatto";
import { isAffidoTemporaneo } from "@/lib/affido";
import { codiceScaricoPratica } from "@/lib/scarico";
import { countRateScadute } from "@/lib/rate";
import { statoOperativoPratica } from "@/lib/statoOperativoPratica";
import {
  isPreavvisoStragiudiziale,
  scadenzaStragiudizialeEffettiva,
} from "@/lib/scadenzaStragiudiziale";

export type PraticaListaRow = {
  id: string;
  numero: string;
  stato: string;
  residuoLabel: string;
  esitoLabel: string;
  ultimaLavorazioneLabel: string;
  ultimaLavorazioneOraLabel: string;
  /** Per ordinamento client (ms epoch; NaN se assente). */
  ultimaLavorazioneAtSort: number;
  debitoreNome: string;
  debitoreTelefono: string | null;
  debitoreCap: string | null;
  debitoreCitta: string | null;
  debitoreProv: string | null;
  debitoreCf: string | null;
  mandanteCodice: string;
  assegnatarioNome: string | null;
  lotto: string | null;
  dataAffidoLabel: string;
  scadenzaLabel: string;
  scadenzaStragiudizialeLabel: string;
  preavvisoStragiudiziale?: boolean;
  codScarico: string | null;
  affidoProvvisorio: boolean;
  importoRataLabel: string;
  rateScaduteLabel: string;
  totIncassatoLabel: string;
  importoTotaleLabel: string;
  garanteLabel: string;
  href: string;
};

export type PraticaPerListaRow = {
  id: string;
  numero: string;
  stato: string;
  assegnatarioId: string | null;
  operatoreTitolareId?: string | null;
  scadenza: Date | string | null;
  dataPassaggioGiudiziale?: Date | string | null;
  conferimentoTipo?: string | null;
  codiceScarico?: string | null;
  codiceScaricoBk?: string | null;
  residuo: number;
  nettoDaPagare?: number | null;
  totIncassato?: number | null;
  capitale?: number;
  interessi?: number;
  spese?: number;
  dataAffido?: Date | string | null;
  ultimaLavorazioneAt?: Date | string | null;
  esitoContatto?: string | null;
  numeroMandante?: string | null;
  debitore: {
    nome: string;
    cognome: string;
    telefono?: string | null;
    cap?: string | null;
    citta?: string | null;
    provincia?: string | null;
    codiceFiscale?: string | null;
  };
  mandante: { codice: string };
  assegnatario?: { name: string } | null;
  rate?: Array<{ importo: number; pagata: boolean; scadenza: Date | string }>;
  incassi?: Array<{ importo: number }>;
  garanti?: Array<{ nome: string; cognome: string }>;
};

/** Stesso payload dell’elenco Pratiche (include Prisma). */
export const praticaListaInclude = {
  debitore: {
    select: {
      nome: true,
      cognome: true,
      telefono: true,
      cap: true,
      citta: true,
      provincia: true,
      codiceFiscale: true,
    },
  },
  mandante: { select: { codice: true } },
  assegnatario: { select: { name: true } },
  rate: {
    orderBy: { numeroRata: "asc" as const },
    select: { importo: true, pagata: true, scadenza: true },
  },
  incassi: { select: { importo: true } },
  garanti: {
    orderBy: { ordine: "asc" as const },
    take: 1,
    select: { nome: true, cognome: true },
  },
};

/** Come scheda pratica: base da nettoDaPagare o residuo, meno incassi registrati. */
export function nettoDaPagareEffettivoLista(
  residuo: number,
  nettoDaPagare: number | null | undefined,
  pagatoIncassi: number
): number {
  const nettoBase =
    nettoDaPagare != null && Number.isFinite(nettoDaPagare)
      ? nettoDaPagare
      : residuo;
  return Math.max(0, nettoBase - Math.max(0, pagatoIncassi));
}

export function mapPraticaEntityToListaRow(
  p: PraticaPerListaRow,
  href: string
): PraticaListaRow {
  const totIncRel = (p.incassi ?? []).reduce((s, i) => s + (i.importo || 0), 0);
  const pagato =
    totIncRel > 0
      ? totIncRel
      : Math.max(0, p.totIncassato ?? 0);
  const nettoDaPagare = nettoDaPagareEffettivoLista(
    p.residuo,
    p.nettoDaPagare,
    pagato
  );
  const totInc = totIncRel > 0 ? totIncRel : pagato;
  const g = p.garanti?.[0];
  const primaRataAperta = (p.rate ?? []).find((r) => !r.pagata);
  const nRateScadute = countRateScadute(p.rate ?? []);
  const scadStrag = scadenzaStragiudizialeEffettiva({
    scadenza: p.scadenza,
    dataPassaggioGiudiziale: p.dataPassaggioGiudiziale,
    conferimentoTipo: p.conferimentoTipo,
  });
  return {
    id: p.id,
    numero: p.numero,
    stato: statoOperativoPratica({
      stato: p.stato,
      assegnatarioId: p.assegnatarioId,
      scadenza: p.scadenza,
      codiceScaricoBk: p.codiceScaricoBk,
    }),
    residuoLabel: euro(p.residuo),
    esitoLabel: esitoContattoLabel(p.esitoContatto),
    ultimaLavorazioneLabel: dataIt(p.ultimaLavorazioneAt ?? null),
    ultimaLavorazioneOraLabel: oraIt(p.ultimaLavorazioneAt ?? null),
    ultimaLavorazioneAtSort: p.ultimaLavorazioneAt
      ? new Date(p.ultimaLavorazioneAt).getTime()
      : Number.NaN,
    debitoreNome: `${p.debitore.cognome} ${p.debitore.nome}`.trim(),
    debitoreTelefono: p.debitore.telefono ?? null,
    debitoreCap: p.debitore.cap ?? null,
    debitoreCitta: p.debitore.citta ?? null,
    debitoreProv: p.debitore.provincia ?? null,
    debitoreCf: p.debitore.codiceFiscale ?? null,
    mandanteCodice: p.mandante.codice,
    assegnatarioNome: p.assegnatario?.name ?? null,
    lotto: p.numeroMandante ?? null,
    dataAffidoLabel: dataIt(p.dataAffido ?? null),
    scadenzaLabel: dataIt(p.scadenza),
    scadenzaStragiudizialeLabel: dataIt(scadStrag),
    preavvisoStragiudiziale: isPreavvisoStragiudiziale(scadStrag),
    codScarico: codiceScaricoPratica(p.stato, p.codiceScarico ?? null),
    affidoProvvisorio: isAffidoTemporaneo(p),
    importoRataLabel: primaRataAperta ? euro(primaRataAperta.importo) : "—",
    rateScaduteLabel: nRateScadute > 0 ? String(nRateScadute) : "—",
    totIncassatoLabel: euro(totInc),
    importoTotaleLabel: euro(nettoDaPagare),
    garanteLabel: g ? `${g.cognome} ${g.nome}`.trim() : "—",
    href,
  };
}
