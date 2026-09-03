import { euro } from "@/lib/domainFormat";

/** Placeholder da inserire nei testi SMS configurati sulla committente. */
export const SMS_IMPORTO_PLACEHOLDER = "{importo}";

export type SmsPreset = {
  id: string;
  titolo: string;
  testo: string;
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

export function compilaSmsConImporto(testo: string, importo: number): string {
  return testo.split(SMS_IMPORTO_PLACEHOLDER).join(euro(importo));
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
