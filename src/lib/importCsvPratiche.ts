import {
  csvColIndex,
  csvInt,
  csvMoney,
  csvStr,
  parseCsvDate,
} from "@/lib/importContesto";

export type CsvPraticaRow = {
  nome: string;
  cognome: string;
  cf: string | null;
  telefono: string | null;
  citta: string | null;
  indirizzo: string | null;
  cap: string | null;
  provincia: string | null;
  capitale: number;
  interessi: number;
  spese: number;
  speseRecupero: number;
  importoRata: number | null;
  rateArretrate: number | null;
  residuo: number;
  nettoDaPagare: number;
  lottoRiga: string;
  contratto: string | null;
  commessa: string | null;
  scadenza: Date | null;
  statoPratica: "NUOVA" | "IN_LAVORAZIONE";
  /** Colonne presenti nel CSV (per aggiornare solo campi forniti). */
  has: {
    capitale: boolean;
    interessi: boolean;
    spese: boolean;
    speseRecupero: boolean;
    importoRata: boolean;
    rateArretrate: boolean;
    residuo: boolean;
    nettoDaPagare: boolean;
    scadenza: boolean;
    stato: boolean;
    contratto: boolean;
    commessa: boolean;
    cf: boolean;
    telefono: boolean;
    citta: boolean;
    indirizzo: boolean;
    cap: boolean;
    provincia: boolean;
  };
};

export type ExistingPraticaImport = {
  id: string;
  debitoreId: string;
  contratto: string | null;
  commessa: string | null;
  stato: string;
  codiceScarico: string | null;
  note: string | null;
  debitore: { codiceFiscale: string | null };
};

function normKey(value: string) {
  return value.trim().toLowerCase();
}

function statoDaCsv(raw: string): "NUOVA" | "IN_LAVORAZIONE" {
  const u = raw.trim().toUpperCase();
  return u === "SI" ||
    u === "SÌ" ||
    u === "1" ||
    u === "TRUE" ||
    u === "IN_LAVORAZIONE" ||
    u === "IN LAVORAZIONE"
    ? "IN_LAVORAZIONE"
    : "NUOVA";
}

export function parseCsvPraticaRow(
  cols: string[],
  header: string[],
  lottoDefault: string
): CsvPraticaRow | null {
  const idx = (name: string) => header.indexOf(name);
  const nome = cols[idx("nome")]?.trim();
  if (!nome) return null;

  const capitaleRaw = csvMoney(cols, header, "capitale");
  const interessiRaw = csvMoney(cols, header, "mora", "interessi");
  const speseRaw = csvMoney(cols, header, "spese");
  const speseRecuperoRaw = csvMoney(
    cols,
    header,
    "spese_di_recupero",
    "spese di recupero",
    "spese_recupero",
    "spese_rec",
    "spese rec"
  );
  const importoRata = csvMoney(
    cols,
    header,
    "importo_rata",
    "importo rata",
    "imp_rata",
    "imp rata"
  );
  const rateArretrate = csvInt(
    cols,
    header,
    "rate_arretrate",
    "rate arretrate",
    "n_rate_arretrate",
    "n rate arretrate"
  );
  const residuoCsv = csvMoney(cols, header, "debito_residuo", "debito residuo", "residuo");
  const nettoCsv = csvMoney(
    cols,
    header,
    "netto_da_pagare",
    "netto da pagare",
    "da_pagare",
    "da pagare"
  );

  const capitale = capitaleRaw ?? 0;
  const interessi = interessiRaw ?? 0;
  const spese = speseRaw ?? 0;
  const speseRecupero = speseRecuperoRaw ?? 0;
  const residuo =
    residuoCsv ??
    Math.round((capitale + interessi + spese + speseRecupero) * 100) / 100;
  const nettoDaPagare = nettoCsv ?? residuoCsv ?? residuo;

  const lottoIdx = csvColIndex(header, "lotto", "numero_mandante", "numero mandante");
  const lottoRiga =
    (lottoIdx >= 0 ? cols[lottoIdx]?.trim() : "") || lottoDefault;

  const contratto = csvStr(cols, header, "contratto", "numero_contratto", "nr_contratto");
  const commessa = csvStr(
    cols,
    header,
    "commessa",
    "numero_commessa",
    "nr_commessa",
    "numero_di_commessa"
  );

  const scadIdx = csvColIndex(
    header,
    "scadenza_affido",
    "scadenza affido",
    "scadenza_mandato",
    "scadenza mandato",
    "scad_mandato",
    "data_scadenza",
    "data scadenza",
    "scadenza"
  );
  const scadRaw = scadIdx >= 0 ? cols[scadIdx]?.trim() || "" : "";
  const scadenza = scadRaw ? parseCsvDate(scadRaw) : null;

  const statoCsvIdx = csvColIndex(header, "stato", "in_lavorazione", "in lavorazione");
  const statoCsvRaw = statoCsvIdx >= 0 ? cols[statoCsvIdx]?.trim() || "" : "";
  const statoPratica = statoCsvRaw ? statoDaCsv(statoCsvRaw) : "NUOVA";

  return {
    nome,
    cognome: cols[idx("cognome")]?.trim() || "",
    cf: csvStr(cols, header, "cf", "codice_fiscale", "codice fiscale"),
    telefono: csvStr(cols, header, "telefono", "tel"),
    citta: csvStr(cols, header, "citta", "città"),
    indirizzo: csvStr(cols, header, "indirizzo"),
    cap: csvStr(cols, header, "cap"),
    provincia: csvStr(cols, header, "provincia", "prov"),
    capitale,
    interessi,
    spese,
    speseRecupero,
    importoRata,
    rateArretrate,
    residuo,
    nettoDaPagare,
    lottoRiga,
    contratto,
    commessa,
    scadenza,
    statoPratica,
    has: {
      capitale: capitaleRaw != null,
      interessi: interessiRaw != null,
      spese: speseRaw != null,
      speseRecupero: speseRecuperoRaw != null,
      importoRata: importoRata != null,
      rateArretrate: rateArretrate != null,
      residuo: residuoCsv != null,
      nettoDaPagare: nettoCsv != null,
      scadenza: scadenza != null,
      stato: Boolean(statoCsvRaw),
      contratto: contratto != null,
      commessa: commessa != null,
      cf: csvStr(cols, header, "cf", "codice_fiscale", "codice fiscale") != null,
      telefono: csvStr(cols, header, "telefono", "tel") != null,
      citta: csvStr(cols, header, "citta", "città") != null,
      indirizzo: csvStr(cols, header, "indirizzo") != null,
      cap: csvStr(cols, header, "cap") != null,
      provincia: csvStr(cols, header, "provincia", "prov") != null,
    },
  };
}

export class ImportPraticaIndex {
  private byContratto = new Map<string, ExistingPraticaImport>();
  private byCommessa = new Map<string, ExistingPraticaImport>();
  private byCf = new Map<string, ExistingPraticaImport>();

  constructor(pratiche: ExistingPraticaImport[]) {
    for (const p of pratiche) {
      if (p.contratto?.trim()) {
        this.byContratto.set(normKey(p.contratto), p);
      }
      if (p.commessa?.trim()) {
        this.byCommessa.set(normKey(p.commessa), p);
      }
      const cf = p.debitore.codiceFiscale?.trim();
      if (cf) this.byCf.set(normKey(cf), p);
    }
  }

  find(row: CsvPraticaRow): ExistingPraticaImport | null {
    // Non fare fallback su commessa/CF se il CSV indica un contratto/commessa
    // non presente nel lotto: altrimenti righe distinte finiscono sulla stessa pratica.
    if (row.contratto?.trim()) {
      return this.byContratto.get(normKey(row.contratto)) ?? null;
    }
    if (row.commessa?.trim()) {
      return this.byCommessa.get(normKey(row.commessa)) ?? null;
    }
    if (row.cf?.trim()) {
      return this.byCf.get(normKey(row.cf)) ?? null;
    }
    return null;
  }

  register(pratica: ExistingPraticaImport, row: CsvPraticaRow) {
    if (row.contratto?.trim()) {
      this.byContratto.set(normKey(row.contratto), pratica);
    }
    if (row.commessa?.trim()) {
      this.byCommessa.set(normKey(row.commessa), pratica);
    }
    if (row.cf?.trim()) {
      this.byCf.set(normKey(row.cf), pratica);
    }
  }
}

export function canUpdateStatoFromCsv(p: {
  stato: string;
  codiceScarico: string | null;
  note: string | null;
}) {
  if (p.codiceScarico?.trim()) return false;
  if (p.note?.trim()) return false;
  return p.stato === "NUOVA" || p.stato === "AFFIDATA";
}

export function debitoreUpdateFromCsv(row: CsvPraticaRow) {
  const data: Record<string, string> = { nome: row.nome, cognome: row.cognome };
  if (row.has.cf && row.cf) data.codiceFiscale = row.cf;
  if (row.has.telefono && row.telefono) data.telefono = row.telefono;
  if (row.has.citta && row.citta) data.citta = row.citta;
  if (row.has.indirizzo && row.indirizzo) data.indirizzo = row.indirizzo;
  if (row.has.cap && row.cap) data.cap = row.cap;
  if (row.has.provincia && row.provincia) data.provincia = row.provincia;
  return data;
}

export function praticaUpdateFromCsv(
  row: CsvPraticaRow,
  existing: ExistingPraticaImport
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    numeroMandante: row.lottoRiga,
  };

  if (row.has.contratto) data.contratto = row.contratto;
  if (row.has.commessa) data.commessa = row.commessa;
  if (row.has.capitale) data.capitale = row.capitale;
  if (row.has.interessi) data.interessi = row.interessi;
  if (row.has.spese) data.spese = row.spese;
  if (row.has.speseRecupero) data.speseRecupero = row.speseRecupero;
  if (row.has.importoRata) data.importoRata = row.importoRata;
  if (row.has.rateArretrate) data.rateArretrate = row.rateArretrate;
  if (row.has.residuo) data.residuo = row.residuo;
  if (row.has.nettoDaPagare) data.nettoDaPagare = row.nettoDaPagare;
  if (row.has.scadenza) data.scadenza = row.scadenza;

  if (row.has.stato && canUpdateStatoFromCsv(existing)) {
    data.stato = row.statoPratica;
  }

  return data;
}
