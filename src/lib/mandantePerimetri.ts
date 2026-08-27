import { METODI_INCASSO } from "@/lib/metodoIncasso";

/** Scaglione: al superamento della soglia (% su affidato o incassato) la provvigione indicata sostituisce quella base. */
export type ScaglioneBase = "affidato" | "incassato";

export type ScaglioneProvvigione = {
  id: string;
  /** affidato = % incassato sul totale affidato · incassato = % incassato sul totale incassato del periodo */
  base: ScaglioneBase;
  /** Codice scarico di riferimento per il conteggio; null = tutti i codici. */
  codiceScarico: string | null;
  /** Soglia percentuale da raggiungere (es. 30 = al 30%). */
  sogliaPerc: number;
  /** Nuova provvigione % che sostituisce quella base. */
  provvigionePerc: number;
  note: string | null;
};

/** Incentivo cash (importo fisso aggiuntivo, indipendente dagli scaglioni). */
export type Incentivo = {
  id: string;
  tipo: "cash";
  valore: number;
  soglia: number | null;
  note: string | null;
};

export type LatoEconomico = {
  provvigionePerc: number | null;
  provvigioniMetodo: Record<string, number>;
  /** Provvigione base % per codice scarico del perimetro (sovrascrive il default). */
  provvigioniCodice: Record<string, number>;
  incentivi: Incentivo[];
  scaglioni: ScaglioneProvvigione[];
};

export const SCAGLIONE_BASE_LABELS: Record<ScaglioneBase, string> = {
  affidato: "% su affidato",
  incassato: "% su incassato",
};

export const INCENTIVO_TIPI_CASH = [{ value: "cash", label: "Importo fisso" }] as const;

/** @deprecated usa SCAGLIONE_BASE_LABELS */
export const INCENTIVO_TIPI_MANDANTE = INCENTIVO_TIPI_CASH;

/** @deprecated usa SCAGLIONE_BASE_LABELS */
export const INCENTIVO_TIPI_COLLABORATORI = INCENTIVO_TIPI_CASH;

export function labelValoreIncentivo(_tipo: string) {
  return "Importo (€)";
}

export function labelSogliaIncentivo(_tipo: string) {
  return "Soglia minima incasso (€)";
}

export type MandantePerimetro = {
  id: string;
  /** Acronimo interno agenzia (schede cliente / elenchi). */
  nomeInterno: string;
  /** Descrizione perimetro (testo esteso). */
  descrizione: string;
  /**
   * Chiave usata in import / matching pratiche (di solito = descrizione).
   * Conservata per retrocompatibilità.
   */
  nomeMandante: string;
  /** Provvigioni e incentivi che la mandante paga all'agenzia. */
  ricevuta: LatoEconomico;
  /** Provvigioni e incentivi che l'agenzia paga ai collaboratori. */
  pagata: LatoEconomico;
  codiciScarico: CodiceScaricoPerimetro[];
  smsPreimpostati: SmsPresetPerimetro[];
};

export type PerimetroListItem = {
  id: string;
  /** Acronimo interno. */
  nomeInterno: string;
  descrizione: string;
  nomeMandante: string;
  label: string;
};

/** Chiave perimetro usata in import / filtri (descrizione o legacy nomeMandante). */
export function numeroMandantePerimetro(
  p: Pick<MandantePerimetro, "nomeMandante" | "descrizione">
) {
  return (p.nomeMandante.trim() || p.descrizione.trim());
}

export function etichettaPerimetro(
  p: Pick<MandantePerimetro, "nomeInterno" | "nomeMandante" | "descrizione">
) {
  const acronimo = p.nomeInterno.trim();
  const descrizione = (p.descrizione || p.nomeMandante || "").trim();
  if (acronimo && descrizione) {
    if (acronimo === descrizione) return acronimo;
    return `${acronimo} · ${descrizione}`;
  }
  return acronimo || descrizione;
}

export function toPerimetroListItem(p: MandantePerimetro): PerimetroListItem {
  const descrizione = (p.descrizione || p.nomeMandante || "").trim();
  return {
    id: p.id,
    nomeInterno: p.nomeInterno.trim(),
    descrizione,
    nomeMandante: numeroMandantePerimetro(p),
    label: etichettaPerimetro(p),
  };
}

export type CodiceScaricoPerimetro = {
  codice: string;
  descrizione: string;
};

export type CodiceScaricoOpzione = {
  value: string;
  label: string;
};

/** Codici selezionabili negli scaglioni: solo quelli definiti nel perimetro. */
export function codiciScaricoOpzioniScaglione(
  codiciPerimetro: CodiceScaricoPerimetro[] = []
): CodiceScaricoOpzione[] {
  const out: CodiceScaricoOpzione[] = [{ value: "", label: "Tutti i codici" }];

  for (const c of codiciPerimetro) {
    const codice = c.codice.trim().toUpperCase();
    if (!codice) continue;
    out.push({
      value: codice,
      label: c.descrizione.trim()
        ? `${codice} — ${c.descrizione.trim()}`
        : codice,
    });
  }

  return out;
}

export function etichettaCodiceScaricoScaglione(
  codice: string | null,
  codiciPerimetro: CodiceScaricoPerimetro[] = []
) {
  if (!codice) return "tutti i codici";
  const custom = codiciPerimetro.find((c) => c.codice.toUpperCase() === codice.toUpperCase());
  if (custom) {
    return custom.descrizione.trim()
      ? `${custom.codice} (${custom.descrizione.trim()})`
      : custom.codice;
  }
  return codice;
}

export type SmsPresetPerimetro = {
  id: string;
  titolo: string;
  testo: string;
};

export function emptyLatoEconomico(): LatoEconomico {
  return {
    provvigionePerc: null,
    provvigioniMetodo: {},
    provvigioniCodice: {},
    incentivi: [],
    scaglioni: [],
  };
}

function newIncentivoId() {
  return `inc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeIncentivi(raw: unknown, legacy?: Record<string, unknown>): Incentivo[] {
  const items: Incentivo[] = [];

  const pushCash = (o: Record<string, unknown>, id?: string) => {
    const tipo = String(o.tipo || o.incentivoTipo || "").trim();
    if (tipo && tipo !== "cash") return;
    const valoreRaw = o.valore ?? o.incentivoValore;
    const valore = valoreRaw != null && valoreRaw !== "" ? Number(valoreRaw) : NaN;
    if (Number.isNaN(valore) || valore < 0) return;
    const sogliaRaw = o.soglia ?? o.incentivoSoglia;
    const soglia =
      sogliaRaw != null && sogliaRaw !== "" ? Number(sogliaRaw) : null;
    const noteRaw = o.note ?? o.incentivoNote;
    items.push({
      id: String(o.id || id || newIncentivoId()),
      tipo: "cash",
      valore,
      soglia: soglia != null && !Number.isNaN(soglia) && soglia >= 0 ? soglia : null,
      note: noteRaw ? String(noteRaw).trim() || null : null,
    });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      pushCash(item as Record<string, unknown>);
    }
  }

  if (legacy && !items.length) {
    const tipo = legacy.incentivoTipo ? String(legacy.incentivoTipo) : null;
    if (tipo === "cash") pushCash(legacy);
  }

  return items;
}

function incentiviPercentualiToScaglioni(raw: unknown, legacy?: Record<string, unknown>): ScaglioneProvvigione[] {
  const out: ScaglioneProvvigione[] = [];

  const push = (o: Record<string, unknown>) => {
    const tipo = String(o.tipo || o.incentivoTipo || "").trim();
    if (tipo !== "affido" && tipo !== "percentuale") return;
    const valoreRaw = o.valore ?? o.incentivoValore;
    const provvigionePerc =
      valoreRaw != null && valoreRaw !== "" ? Number(valoreRaw) : NaN;
    const sogliaRaw = o.soglia ?? o.incentivoSoglia;
    const sogliaPerc =
      sogliaRaw != null && sogliaRaw !== "" ? Number(sogliaRaw) : 0;
    if (Number.isNaN(provvigionePerc) || provvigionePerc < 0) return;
    if (Number.isNaN(sogliaPerc) || sogliaPerc < 0) return;
    const noteRaw = o.note ?? o.incentivoNote;
    out.push({
      id: String(o.id || newScaglioneId()),
      base: tipo === "affido" ? "affidato" : "incassato",
      codiceScarico: null,
      sogliaPerc,
      provvigionePerc,
      note: noteRaw ? String(noteRaw).trim() || null : null,
    });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      push(item as Record<string, unknown>);
    }
  }

  if (legacy) {
    const tipo = legacy.incentivoTipo ? String(legacy.incentivoTipo) : null;
    if (tipo === "affido" || tipo === "percentuale") push(legacy);
  }

  return out;
}

function newScaglioneId() {
  return `scg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeScaglioni(raw: unknown, legacyIncentivi?: unknown, legacy?: Record<string, unknown>): ScaglioneProvvigione[] {
  const out: ScaglioneProvvigione[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const baseRaw = String(o.base || o.tipo || "").trim();
      const base: ScaglioneBase =
        baseRaw === "incassato" || baseRaw === "percentuale" ? "incassato" : "affidato";
      const sogliaPerc = Number(o.sogliaPerc ?? o.soglia ?? o.sogliaIncasso ?? 0);
      const provvigionePerc = Number(o.provvigionePerc ?? o.perc ?? 0);
      if (Number.isNaN(sogliaPerc) || sogliaPerc < 0) continue;
      if (Number.isNaN(provvigionePerc) || provvigionePerc < 0) continue;
      const codiceRaw = o.codiceScarico ?? o.codice ?? null;
      const codiceScarico = codiceRaw ? String(codiceRaw).trim().toUpperCase() || null : null;
      const noteRaw = o.note;
      out.push({
        id: String(o.id || newScaglioneId()),
        base,
        codiceScarico,
        sogliaPerc,
        provvigionePerc,
        note: noteRaw ? String(noteRaw).trim() || null : null,
      });
    }
  }

  out.push(...incentiviPercentualiToScaglioni(legacyIncentivi, legacy));

  return out
    .sort((a, b) => a.sogliaPerc - b.sogliaPerc || a.provvigionePerc - b.provvigionePerc);
}

export function emptyPerimetro(
  nomeInterno = "",
  descrizione = "",
  nomeMandante = ""
): MandantePerimetro {
  const desc = descrizione.trim();
  const chiave = (nomeMandante || desc).trim();
  return {
    id: `per-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nomeInterno: nomeInterno.trim(),
    descrizione: desc,
    nomeMandante: chiave,
    ricevuta: emptyLatoEconomico(),
    pagata: emptyLatoEconomico(),
    codiciScarico: [],
    smsPreimpostati: [],
  };
}

function normalizePerimetroNomi(o: Record<string, unknown>) {
  const legacy = String(o.nome || "").trim();
  const nomeInterno = String(o.nomeInterno || legacy || "").trim();
  const nomeMandante = String(o.nomeMandante || legacy || "").trim();
  const descrizione = String(o.descrizione || nomeMandante || legacy || "").trim();
  return { nomeInterno, descrizione, nomeMandante: nomeMandante || descrizione };
}

function normalizeCodiciScarico(raw: unknown): CodiceScaricoPerimetro[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const codice = String(o.codice || "").trim().toUpperCase();
      const descrizione = String(o.descrizione || "").trim();
      if (!codice || !descrizione) return null;
      return { codice, descrizione };
    })
    .filter((x): x is CodiceScaricoPerimetro => x != null);
}

function normalizeSmsPresets(raw: unknown): SmsPresetPerimetro[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const titolo = String(o.titolo || "").trim();
      const testo = String(o.testo || "").trim();
      if (!titolo || !testo) return null;
      return {
        id: String(o.id || `sms-${titolo}`),
        titolo,
        testo,
      };
    })
    .filter((x): x is SmsPresetPerimetro => x != null);
}

function parseCodiciScaricoMandante(raw: string | null | undefined): CodiceScaricoPerimetro[] {
  if (!raw) return [];
  try {
    return normalizeCodiciScarico(JSON.parse(raw));
  } catch {
    return [];
  }
}

function parseSmsMandante(raw: string | null | undefined): SmsPresetPerimetro[] {
  if (!raw) return [];
  try {
    return normalizeSmsPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

function latoFromMandanteLegacy(mandante: {
  provvigionePerc?: number | null;
  provvigioniMetodo?: string | null;
  incentivoTipo?: string | null;
  incentivoValore?: number | null;
  incentivoSoglia?: number | null;
  incentivoNote?: string | null;
}): LatoEconomico {
  let provvigioniMetodo: Record<string, number> = {};
  if (mandante.provvigioniMetodo) {
    try {
      const parsed = JSON.parse(mandante.provvigioniMetodo) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        provvigioniMetodo = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([k, v]) => {
              const n = Number(v);
              return [k, n] as const;
            })
            .filter(([, n]) => !Number.isNaN(n) && n >= 0)
        );
      }
    } catch {
      /* ignore */
    }
  }
  const hasIncentivi =
    normalizeIncentivi(null, mandante as Record<string, unknown>).length > 0 ||
    incentiviPercentualiToScaglioni(null, mandante as Record<string, unknown>).length > 0;
  if (
    mandante.provvigionePerc == null &&
    !Object.keys(provvigioniMetodo).length &&
    !hasIncentivi
  ) {
    return emptyLatoEconomico();
  }
  return {
    provvigionePerc: mandante.provvigionePerc ?? null,
    provvigioniMetodo,
    provvigioniCodice: {},
    incentivi: normalizeIncentivi(null, mandante as Record<string, unknown>),
    scaglioni: normalizeScaglioni(null, null, mandante as Record<string, unknown>),
  };
}

function latoIsEmpty(lato: LatoEconomico) {
  return (
    lato.provvigionePerc == null &&
    !Object.keys(lato.provvigioniMetodo).length &&
    !Object.keys(lato.provvigioniCodice).length &&
    !lato.incentivi.length &&
    !lato.scaglioni.length
  );
}

function normalizeProvvigioniCodice(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => {
        const codice = k.trim().toUpperCase();
        const n = Number(v);
        return [codice, n] as const;
      })
      .filter(([codice, n]) => codice && !Number.isNaN(n) && n >= 0)
  );
}

function normalizeProvvigioniMetodo(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => {
        const n = Number(v);
        return [k, n] as const;
      })
      .filter(([k, n]) => k && !Number.isNaN(n) && n >= 0)
  );
}

function normalizeLato(raw: unknown): LatoEconomico {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    provvigionePerc:
      o.provvigionePerc != null && o.provvigionePerc !== ""
        ? Number(o.provvigionePerc)
        : null,
    provvigioniMetodo: normalizeProvvigioniMetodo(o.provvigioniMetodo),
    provvigioniCodice: normalizeProvvigioniCodice(o.provvigioniCodice),
    incentivi: normalizeIncentivi(o.incentivi, o),
    scaglioni: normalizeScaglioni(o.scaglioni, o.incentivi, o),
  };
}

export function parsePerimetri(raw: string | null | undefined): MandantePerimetro[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const { nomeInterno, descrizione, nomeMandante } = normalizePerimetroNomi(o);
        if (!nomeInterno || !nomeMandante) return null;
        return {
          id: String(o.id || `per-${nomeMandante}`),
          nomeInterno,
          descrizione: descrizione || nomeMandante,
          nomeMandante,
          ricevuta: normalizeLato(o.ricevuta),
          pagata: normalizeLato(o.pagata),
          codiciScarico: normalizeCodiciScarico(o.codiciScarico),
          smsPreimpostati: normalizeSmsPresets(o.smsPreimpostati),
        } satisfies MandantePerimetro;
      })
      .filter((p): p is MandantePerimetro => p != null);
  } catch {
    return [];
  }
}

export function serializePerimetri(perimetri: MandantePerimetro[]): string {
  return JSON.stringify(perimetri);
}

/** Carica i perimetri per l'editor, migrando eventuali dati legacy a livello mandante. */
export function loadPerimetriForEditor(mandante: {
  perimetri: string | null;
  codiciScarico?: string | null;
  smsPreimpostati?: string | null;
  provvigionePerc?: number | null;
  provvigioniMetodo?: string | null;
  incentivoTipo?: string | null;
  incentivoValore?: number | null;
  incentivoSoglia?: number | null;
  incentivoNote?: string | null;
}): MandantePerimetro[] {
  const legacyCodici = parseCodiciScaricoMandante(mandante.codiciScarico);
  const legacySms = parseSmsMandante(mandante.smsPreimpostati);
  const legacyRicevuta = latoFromMandanteLegacy(mandante);
  const hasLegacy =
    legacyCodici.length > 0 ||
    legacySms.length > 0 ||
    !latoIsEmpty(legacyRicevuta);

  let items = parsePerimetri(mandante.perimetri);

  if (!items.length && hasLegacy) {
    return [
      {
        id: "per-generale",
        nomeInterno: "Generale",
        descrizione: "Generale",
        nomeMandante: "Generale",
        ricevuta: legacyRicevuta,
        pagata: emptyLatoEconomico(),
        codiciScarico: legacyCodici,
        smsPreimpostati: legacySms,
      },
    ];
  }

  if (items.length && hasLegacy) {
    const first = items[0]!;
    items = [
      {
        ...first,
        ricevuta: latoIsEmpty(first.ricevuta) ? legacyRicevuta : first.ricevuta,
        codiciScarico: first.codiciScarico.length ? first.codiciScarico : legacyCodici,
        smsPreimpostati: first.smsPreimpostati.length ? first.smsPreimpostati : legacySms,
      },
      ...items.slice(1),
    ];
  }

  return items;
}

export function parsePerimetriList(raw: string | null | undefined): PerimetroListItem[] {
  return parsePerimetri(raw).map(toPerimetroListItem);
}

export function perimetroPerNome(
  perimetri: MandantePerimetro[],
  numeroMandante: string | null | undefined
): MandantePerimetro | null {
  const nome = numeroMandante?.trim();
  if (!nome) return null;
  return (
    perimetri.find((p) => p.nomeMandante.trim() === nome) ??
    perimetri.find((p) => p.nomeInterno.trim() === nome) ??
    null
  );
}

export function latoMetodoToForm(lato: LatoEconomico): Record<string, string> {
  return Object.fromEntries(
    METODI_INCASSO.map((m) => [
      m.value,
      lato.provvigioniMetodo[m.value] != null
        ? String(lato.provvigioniMetodo[m.value])
        : "",
    ])
  );
}

export function formToLatoCodice(form: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rawCodice, rawVal] of Object.entries(form)) {
    const codice = rawCodice.trim().toUpperCase();
    const trimmed = rawVal.trim();
    if (!codice || !trimmed) continue;
    const n = parseFloat(trimmed.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) out[codice] = n;
  }
  return out;
}

export function latoCodiceToForm(lato: LatoEconomico): Record<string, string> {
  const map = lato.provvigioniCodice ?? {};
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, String(v)]));
}

export function formToLatoMetodo(form: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of METODI_INCASSO) {
    const raw = form[m.value]?.trim();
    if (!raw) continue;
    const n = parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) out[m.value] = n;
  }
  return out;
}

export function parseOptionalFloat(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
