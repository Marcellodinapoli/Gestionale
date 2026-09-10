import { euro } from "@/lib/domainFormat";
import type { PagamentiIntestazioniPerimetro } from "@/lib/mandantePerimetri";

/** Placeholder da inserire nei testi SMS configurati sulla committente. */
export const SMS_IMPORTO_PLACEHOLDER = "{importo}";

export type SmsPlaceholderDef = {
  key: string;
  label: string;
  /** Descrizione breve in editor mandante. */
  hint: string;
};

/** Placeholder disponibili nei testi SMS del perimetro (ordine UI). */
export const SMS_PLACEHOLDERS: SmsPlaceholderDef[] = [
  { key: "{importo}", label: "Importo", hint: "Netto / importo concordato" },
  { key: "{numero}", label: "N. pratica", hint: "Numero pratica" },
  { key: "{iban}", label: "IBAN", hint: "IBAN bonifico del perimetro" },
  {
    key: "{bonifico_intestato}",
    label: "Bonifico intestato",
    hint: "Intestatario bonifico",
  },
  { key: "{ccp}", label: "CCP", hint: "CCP / CCN bollettino" },
  {
    key: "{bollettino_intestato}",
    label: "Bollettino intestato",
    hint: "Intestatario bollettino",
  },
  {
    key: "{bollettino_indirizzo}",
    label: "Indirizzo bollettino",
    hint: "Indirizzo bollettino",
  },
  {
    key: "{assegno_intestato}",
    label: "Assegno intestato",
    hint: "Intestatario assegno",
  },
];

export type SmsPreset = {
  id: string;
  titolo: string;
  testo: string;
};

export type SmsCompilaCtx = {
  importo?: number;
  numeroPratica?: string | null;
  pagamenti?: PagamentiIntestazioniPerimetro | null;
};

export const SMS_PREIMPOSTATI = [
  {
    id: "contatto",
    titolo: "Richiesta contatto",
    testo:
      "Buongiorno, la contattiamo in merito alla Sua posizione. La preghiamo di richiamarci al più presto. Grazie.",
  },
  {
    id: "sollecito",
    titolo: "Sollecito pagamento",
    testo:
      "Buongiorno, non risulta ancora ricevuto il pagamento di {importo}. La invitiamo a saldare o a contattarci oggi stesso.",
  },
  {
    id: "promessa",
    titolo: "Promessa di pagamento",
    testo:
      "Buongiorno, Le confermiamo l'accordo di pagamento di {importo}. Restiamo in attesa dell'accredito nei termini concordati. Grazie.",
  },
  {
    id: "richiamo",
    titolo: "Non raggiungibile",
    testo:
      "Buongiorno, non riuscendo a contattarLa telefonicamente La preghiamo di richiamarci. Grazie.",
  },
  {
    id: "recapito",
    titolo: "Verifica recapito",
    testo:
      "Buongiorno, scriviamo per verificare questo recapito. La preghiamo di confermare o di indicarci un numero corretto.",
  },
] as const;

export function smsPreimpostatiEffettivi(presets: SmsPreset[]): SmsPreset[] {
  if (presets.length) return presets;
  return SMS_PREIMPOSTATI.map((p) => ({ id: p.id, titolo: p.titolo, testo: p.testo }));
}

export function smsRichiedeImporto(testo: string): boolean {
  return testo.includes(SMS_IMPORTO_PLACEHOLDER);
}

function replaceAll(testo: string, placeholder: string, value: string): string {
  if (!testo.includes(placeholder)) return testo;
  return testo.split(placeholder).join(value);
}

/** Compila placeholder SMS (importo, n. pratica, coordinate pagamento perimetro). */
export function compilaSmsTesto(testo: string, ctx: SmsCompilaCtx = {}): string {
  let out = testo;
  if (ctx.importo != null) {
    out = replaceAll(out, "{importo}", euro(ctx.importo));
  }
  if (ctx.numeroPratica != null && String(ctx.numeroPratica).trim()) {
    out = replaceAll(out, "{numero}", String(ctx.numeroPratica).trim());
  }
  const p = ctx.pagamenti;
  if (p) {
    out = replaceAll(out, "{iban}", (p.bonificoIban || "").trim());
    out = replaceAll(
      out,
      "{bonifico_intestato}",
      (p.bonificoIntestatoA || "").trim()
    );
    out = replaceAll(out, "{ccp}", (p.bollettinoCcp || "").trim());
    out = replaceAll(
      out,
      "{bollettino_intestato}",
      (p.bollettinoIntestatoA || "").trim()
    );
    out = replaceAll(
      out,
      "{bollettino_indirizzo}",
      (p.bollettinoIndirizzo || "").trim()
    );
    out = replaceAll(
      out,
      "{assegno_intestato}",
      (p.assegnoIntestatoA || "").trim()
    );
  }
  return out;
}

/** @deprecated preferisci compilaSmsTesto — mantenuto per compatibilità. */
export function compilaSmsConImporto(testo: string, importo: number): string {
  return compilaSmsTesto(testo, { importo });
}

export function importoSmsEffettivo(
  importoNetto: number,
  importoConcordatoRaw: string
): { importo: number; errore?: string } {
  const concordato = importoConcordatoRaw.trim();
  if (!concordato) return { importo: importoNetto };
  const n = Number(concordato.replace(",", "."));
  if (Number.isNaN(n) || n <= 0) {
    return { importo: importoNetto, errore: "Importo concordato non valido" };
  }
  return { importo: n };
}
