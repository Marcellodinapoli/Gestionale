import type { CodScaricoOp } from "@/lib/filtriCodScarico";
import { parseCodScaricoOp, labelCodScaricoOp, parseCodScaricoList, hasCodScaricoFiltro, joinCodScaricoList } from "@/lib/filtriCodScarico";
import type { OperatoreFiltroOp } from "@/lib/filtriOperatore";
import {
  parseOperatoreOp,
  labelOperatoreOp,
  parseOperatoreList,
  hasOperatoreFiltro,
  joinOperatoreList,
  codiceOperatoreFiltro,
} from "@/lib/filtriOperatore";
import type { TextFilterOp } from "@/lib/filtriTestoOp";
import {
  SELECT_FILTER_FIELD_SPECS,
  TEXT_FILTER_DEFAULT,
  TEXT_FILTER_FIELD_SPECS,
  labelTextFilterOp,
  parseTextFilterOp,
} from "@/lib/filtriTestoOp";
import { CODICE_SCARICO_LABELS } from "@/lib/scarico";
import { hasAggiuntivoFiltro, labelAggiuntivoCampo } from "@/lib/filtriAggiuntivoUi";

/**
 * Tipi e helper filtri pratiche — sicuri per Client Component (niente Prisma).
 */

export const ALTRI_FILTRI_KEYS = [
  "debitore",
  "capDa",
  "capA",
  "citta",
  "prov",
  "telefono",
  "affidoDa",
  "affidoA",
  "scadenzaDa",
  "scadenzaA",
  "mandato",
  "perimetro",
  "lotto",
  "operatore",
  "codScarico",
  "sitAffido",
  "affidoProvvisorio",
  "importoRataDa",
  "importoRataA",
  "residuoDa",
  "residuoA",
  "totIncassatoDa",
  "totIncassatoA",
  "importoTotDa",
  "importoTotA",
  "cfPiva",
  "garante",
  "note",
  "nPraticaDa",
  "nPraticaA",
  "promPagDa",
  "promPagA",
  "incassatoDa",
  "incassatoA",
  "memoDa",
  "memoA",
  "rateScadute",
  "aggiuntivoCampo",
  "aggiuntivoValore",
] as const;

export type AltriFiltriKey = (typeof ALTRI_FILTRI_KEYS)[number];

export const FILTRI_GESTIONE_KEYS = ALTRI_FILTRI_KEYS.filter(
  (k) => k !== "aggiuntivoCampo" && k !== "aggiuntivoValore"
);

export type SitAffidoFiltro = "affidata" | "non_affidata" | "temporanea";

export type AltriFiltri = {
  debitore?: string;
  debitoreOp?: TextFilterOp;
  capDa?: string;
  capA?: string;
  citta?: string;
  cittaOp?: TextFilterOp;
  prov?: string;
  provOp?: TextFilterOp;
  telefono?: string;
  telefonoOp?: TextFilterOp;
  affidoDa?: string;
  affidoA?: string;
  scadenzaDa?: string;
  scadenzaA?: string;
  mandato?: string;
  mandatoOp?: TextFilterOp;
  perimetro?: string;
  perimetroOp?: TextFilterOp;
  lotto?: string;
  lottoOp?: TextFilterOp;
  operatore?: string;
  operatoreOp?: OperatoreFiltroOp;
  codScarico?: string;
  codScaricoOp?: CodScaricoOp;
  sitAffido?: SitAffidoFiltro;
  sitAffidoOp?: TextFilterOp;
  affidoProvvisorio?: string;
  importoRataDa?: string;
  importoRataA?: string;
  residuoDa?: string;
  residuoA?: string;
  totIncassatoDa?: string;
  totIncassatoA?: string;
  importoTotDa?: string;
  importoTotA?: string;
  cfPiva?: string;
  cfPivaOp?: TextFilterOp;
  garante?: string;
  garanteOp?: TextFilterOp;
  note?: string;
  noteOp?: TextFilterOp;
  nPraticaDa?: string;
  nPraticaA?: string;
  promPagDa?: string;
  promPagA?: string;
  incassatoDa?: string;
  incassatoA?: string;
  memoDa?: string;
  memoA?: string;
  rateScadute?: string;
  aggiuntivoCampo?: string;
  aggiuntivoValore?: string;
  aggiuntivoOp?: TextFilterOp;
};

function trimOrUndef(v?: string | null) {
  const t = String(v || "").trim();
  return t || undefined;
}

function parseTextOpForField(
  sp: Record<string, string | null | undefined>,
  field: string,
  opKey: string
): TextFilterOp | undefined {
  return trimOrUndef(sp[field]) ? parseTextFilterOp(sp[opKey]) : undefined;
}

export function parseAltriFiltri(
  sp: Record<string, string | null | undefined>
): AltriFiltri | undefined {
  const f: AltriFiltri = {
    debitore: trimOrUndef(sp.debitore),
    debitoreOp: parseTextOpForField(sp, "debitore", "debitoreOp"),
    capDa: trimOrUndef(sp.capDa),
    capA: trimOrUndef(sp.capA),
    citta: trimOrUndef(sp.citta),
    cittaOp: parseTextOpForField(sp, "citta", "cittaOp"),
    prov: trimOrUndef(sp.prov),
    provOp: parseTextOpForField(sp, "prov", "provOp"),
    telefono: trimOrUndef(sp.telefono),
    telefonoOp: parseTextOpForField(sp, "telefono", "telefonoOp"),
    affidoDa: trimOrUndef(sp.affidoDa),
    affidoA: trimOrUndef(sp.affidoA),
    scadenzaDa: trimOrUndef(sp.scadenzaDa),
    scadenzaA: trimOrUndef(sp.scadenzaA),
    mandato: trimOrUndef(sp.mandato),
    mandatoOp: parseTextOpForField(sp, "mandato", "mandatoOp"),
    perimetro: trimOrUndef(sp.perimetro),
    perimetroOp: parseTextOpForField(sp, "perimetro", "perimetroOp"),
    lotto: trimOrUndef(sp.lotto),
    lottoOp: parseTextOpForField(sp, "lotto", "lottoOp"),
    operatore: (() => {
      const joined = joinOperatoreList(parseOperatoreList(sp.operatore));
      return joined || undefined;
    })(),
    operatoreOp: hasOperatoreFiltro(sp.operatore)
      ? parseOperatoreOp(sp.operatoreOp)
      : undefined,
    codScarico: (() => {
      const joined = joinCodScaricoList(parseCodScaricoList(sp.codScarico));
      return joined || undefined;
    })(),
    codScaricoOp: hasCodScaricoFiltro(sp.codScarico)
      ? parseCodScaricoOp(sp.codScaricoOp)
      : undefined,
    sitAffido:
      sp.sitAffido === "affidata" ||
      sp.sitAffido === "non_affidata" ||
      sp.sitAffido === "temporanea"
        ? sp.sitAffido
        : undefined,
    sitAffidoOp: parseTextOpForField(sp, "sitAffido", "sitAffidoOp"),
    affidoProvvisorio: sp.affidoProvvisorio === "1" ? "1" : undefined,
    importoRataDa: trimOrUndef(sp.importoRataDa),
    importoRataA: trimOrUndef(sp.importoRataA),
    residuoDa: trimOrUndef(sp.residuoDa),
    residuoA: trimOrUndef(sp.residuoA),
    totIncassatoDa: trimOrUndef(sp.totIncassatoDa),
    totIncassatoA: trimOrUndef(sp.totIncassatoA),
    importoTotDa: trimOrUndef(sp.importoTotDa),
    importoTotA: trimOrUndef(sp.importoTotA),
    cfPiva: trimOrUndef(sp.cfPiva),
    cfPivaOp: parseTextOpForField(sp, "cfPiva", "cfPivaOp"),
    garante: trimOrUndef(sp.garante),
    garanteOp: parseTextOpForField(sp, "garante", "garanteOp"),
    note: trimOrUndef(sp.note),
    noteOp: parseTextOpForField(sp, "note", "noteOp"),
    nPraticaDa: trimOrUndef(sp.nPraticaDa),
    nPraticaA: trimOrUndef(sp.nPraticaA),
    promPagDa: trimOrUndef(sp.promPagDa),
    promPagA: trimOrUndef(sp.promPagA),
    incassatoDa: trimOrUndef(sp.incassatoDa),
    incassatoA: trimOrUndef(sp.incassatoA),
    memoDa: trimOrUndef(sp.memoDa),
    memoA: trimOrUndef(sp.memoA),
    rateScadute: sp.rateScadute === "1" || sp.rateScadute === "0" ? sp.rateScadute : undefined,
    aggiuntivoCampo: trimOrUndef(sp.aggiuntivoCampo),
    aggiuntivoValore: trimOrUndef(sp.aggiuntivoValore),
    aggiuntivoOp: parseTextOpForField(sp, "aggiuntivoValore", "aggiuntivoOp"),
  };
  if (
    !ALTRI_FILTRI_KEYS.some((k) => f[k]) &&
    !hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore)
  ) {
    return undefined;
  }
  if (!hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore)) {
    delete f.aggiuntivoCampo;
    delete f.aggiuntivoValore;
    delete f.aggiuntivoOp;
  }
  return f;
}

export function sanitizeAltriFiltri(raw: unknown): AltriFiltri {
  if (!raw || typeof raw !== "object") return {};
  return parseAltriFiltri(raw as Record<string, string | null | undefined>) ?? {};
}

export function appendAltriFiltriParams(sp: URLSearchParams, f?: AltriFiltri | null) {
  if (!f) return;
  for (const k of ALTRI_FILTRI_KEYS) {
    const v = f[k];
    if (v) sp.set(k, v);
  }
  if (f.codScarico && f.codScaricoOp && f.codScaricoOp !== "eq") {
    sp.set("codScaricoOp", f.codScaricoOp);
  }
  if (f.operatore && f.operatoreOp && f.operatoreOp !== "eq") {
    sp.set("operatoreOp", f.operatoreOp);
  }
  for (const { field, op } of TEXT_FILTER_FIELD_SPECS) {
    const val = f[field];
    const opVal = f[op];
    if (val && opVal && opVal !== TEXT_FILTER_DEFAULT) {
      sp.set(op, opVal);
    }
  }
  for (const { field, op } of SELECT_FILTER_FIELD_SPECS) {
    const val = f[field];
    const opVal = f[op];
    if (val && opVal && opVal !== TEXT_FILTER_DEFAULT) {
      sp.set(op, opVal);
    }
  }
  if (hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore)) {
    sp.set("aggiuntivoCampo", f.aggiuntivoCampo!);
    sp.set("aggiuntivoValore", f.aggiuntivoValore!);
    if (f.aggiuntivoOp && f.aggiuntivoOp !== TEXT_FILTER_DEFAULT) {
      sp.set("aggiuntivoOp", f.aggiuntivoOp);
    }
  }
}

export function hasAltriFiltri(f?: AltriFiltri | null) {
  if (!f) return false;
  const baseKeys = ALTRI_FILTRI_KEYS.filter(
    (k) => k !== "aggiuntivoCampo" && k !== "aggiuntivoValore"
  );
  if (baseKeys.some((k) => f[k])) return true;
  return hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore);
}

function fmtDataFiltro(iso?: string) {
  if (!iso) return "…";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT");
  }
  return iso;
}

function fmtIntervalloData(da?: string, a?: string) {
  if (da && a) return `dal ${fmtDataFiltro(da)} al ${fmtDataFiltro(a)}`;
  if (da) return `dal ${fmtDataFiltro(da)} in poi`;
  if (a) return `fino al ${fmtDataFiltro(a)}`;
  return "";
}

function fmtIntervalloTesto(da?: string, a?: string) {
  if (da && a) return `${da} – ${a}`;
  if (da) return `da ${da}`;
  if (a) return `fino a ${a}`;
  return "";
}

function fmtIntervalloNum(da?: string, a?: string) {
  if (da && a) return `${da} – ${a}`;
  if (da) return `da ${da}`;
  if (a) return `fino a ${a}`;
  return "";
}

export type AltriFiltriDescrizioneCtx = {
  operatori?: Array<{ id: string; name: string; acronimo?: string | null }>;
  mandanti?: Array<{ id: string; codice: string; ragioneSociale: string }>;
};

export type AltriFiltroAttivoVoce = {
  id: string;
  campo: string;
  op?: string;
  valore: string;
  suffisso?: string;
};

/** Chiavi da preservare nei form (barra rapida / paginazione). */
export const ALTRI_FILTRI_PRESERVE_KEYS = [
  ...ALTRI_FILTRI_KEYS,
  "codScaricoOp",
  "operatoreOp",
  "aggiuntivoOp",
  ...TEXT_FILTER_FIELD_SPECS.map((s) => s.op),
  ...SELECT_FILTER_FIELD_SPECS.map((s) => s.op),
] as const;

export function vociAltriFiltriAttivi(
  f?: AltriFiltri | null,
  ctx?: AltriFiltriDescrizioneCtx
): AltriFiltroAttivoVoce[] {
  if (!f || !hasAltriFiltri(f)) return [];
  const voci: AltriFiltroAttivoVoce[] = [];

  const push = (voce: Omit<AltriFiltroAttivoVoce, "id"> & { id?: string }) => {
    voci.push({ id: voce.id ?? `${voce.campo}-${voci.length}`, ...voce });
  };

  const pushTesto = (
    id: string,
    campo: string,
    val?: string,
    op?: TextFilterOp | null
  ) => {
    if (!val) return;
    push({
      id,
      campo,
      op: labelTextFilterOp(op),
      valore: val,
    });
  };

  pushTesto("debitore", "debitore", f.debitore, f.debitoreOp);
  if (f.capDa || f.capA) {
    push({
      id: "cap",
      campo: "CAP",
      valore: fmtIntervalloTesto(f.capDa, f.capA),
    });
  }
  pushTesto("citta", "città", f.citta, f.cittaOp);
  pushTesto("prov", "provincia", f.prov, f.provOp);
  pushTesto("telefono", "telefono", f.telefono, f.telefonoOp);
  pushTesto("cfPiva", "C.F. / P.IVA", f.cfPiva, f.cfPivaOp);
  pushTesto("garante", "garante", f.garante, f.garanteOp);
  pushTesto("note", "note", f.note, f.noteOp);

  if (f.importoRataDa || f.importoRataA) {
    push({
      id: "importo-rata",
      campo: "importo rata",
      valore: fmtIntervalloNum(f.importoRataDa, f.importoRataA),
    });
  }
  if (f.residuoDa || f.residuoA) {
    push({
      id: "residuo",
      campo: "debito residuo",
      valore: fmtIntervalloNum(f.residuoDa, f.residuoA),
    });
  }
  if (f.totIncassatoDa || f.totIncassatoA) {
    push({
      id: "tot-incassato",
      campo: "tot. incassato",
      valore: fmtIntervalloNum(f.totIncassatoDa, f.totIncassatoA),
    });
  }
  if (f.importoTotDa || f.importoTotA) {
    push({
      id: "importo-tot",
      campo: "importo totale",
      valore: fmtIntervalloNum(f.importoTotDa, f.importoTotA),
    });
  }
  if (f.promPagDa || f.promPagA) {
    push({
      id: "prom-pag",
      campo: "data promessa di pagamento",
      valore: fmtIntervalloData(f.promPagDa, f.promPagA),
    });
  }
  if (f.incassatoDa || f.incassatoA) {
    push({
      id: "incassato",
      campo: "incassato (data)",
      valore: fmtIntervalloData(f.incassatoDa, f.incassatoA),
    });
  }
  if (f.rateScadute === "1") {
    push({ id: "rate-scadute", campo: "rate scadute", valore: "con rate scadute" });
  } else if (f.rateScadute === "0") {
    push({ id: "rate-scadute", campo: "rate scadute", valore: "senza rate scadute" });
  }

  if (f.operatore) {
    const ids = parseOperatoreList(f.operatore);
    const labels = ids.map((id) => {
      const op = ctx?.operatori?.find((o) => o.id === id);
      if (!op) return id;
      return `${codiceOperatoreFiltro(op)} (${op.name})`;
    });
    push({
      id: "operatore",
      campo: "cod. operatore",
      op: labelOperatoreOp(f.operatoreOp),
      valore: labels.join(", "),
    });
  }
  if (f.sitAffido === "affidata") {
    push({
      id: "sit-affido",
      campo: "sit. affido",
      op: labelTextFilterOp(f.sitAffidoOp),
      valore: "affidata",
    });
  } else if (f.sitAffido === "non_affidata") {
    push({
      id: "sit-affido",
      campo: "sit. affido",
      op: labelTextFilterOp(f.sitAffidoOp),
      valore: "non affidata",
    });
  } else if (f.sitAffido === "temporanea") {
    push({
      id: "sit-affido",
      campo: "sit. affido",
      op: labelTextFilterOp(f.sitAffidoOp),
      valore: "affido temporaneo",
    });
  }
  if (f.affidoProvvisorio === "1") {
    push({ id: "affido-prov", campo: "affido provvisorio", valore: "sì" });
  }
  if (f.mandato) {
    const m = ctx?.mandanti?.find((x) => x.id === f.mandato);
    push({
      id: "mandato",
      campo: "mandato",
      op: labelTextFilterOp(f.mandatoOp),
      valore: m ? `${m.codice} — ${m.ragioneSociale}` : f.mandato,
    });
  }
  if (f.perimetro) {
    push({
      id: "perimetro",
      campo: "perimetro",
      op: labelTextFilterOp(f.perimetroOp),
      valore: f.perimetro,
    });
  }
  if (f.lotto) {
    push({
      id: "lotto",
      campo: "lotto",
      op: labelTextFilterOp(f.lottoOp),
      valore: f.lotto,
    });
  }
  if (f.affidoDa || f.affidoA) {
    push({
      id: "affido",
      campo: "data affido",
      valore: fmtIntervalloData(f.affidoDa, f.affidoA),
    });
  }
  if (f.scadenzaDa || f.scadenzaA) {
    push({
      id: "scadenza",
      campo: "scad. mandato",
      valore: fmtIntervalloData(f.scadenzaDa, f.scadenzaA),
    });
  }
  if (f.codScarico) {
    const codes = parseCodScaricoList(f.codScarico);
    push({
      id: "cod-scarico",
      campo: "codice scarico",
      op: labelCodScaricoOp(f.codScaricoOp),
      valore: codes.join(", "),
      suffisso: codes
        .map((c) => CODICE_SCARICO_LABELS[c as keyof typeof CODICE_SCARICO_LABELS])
        .filter(Boolean)
        .join("; ") || undefined,
    });
  }
  if (f.nPraticaDa || f.nPraticaA) {
    push({
      id: "n-pratica",
      campo: "n. pratica",
      valore: fmtIntervalloTesto(f.nPraticaDa, f.nPraticaA),
    });
  }
  if (f.memoDa || f.memoA) {
    push({
      id: "memo",
      campo: "scarico memo",
      valore: fmtIntervalloData(f.memoDa, f.memoA),
    });
  }
  if (hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore)) {
    push({
      id: "aggiuntivo",
      campo: labelAggiuntivoCampo(f.aggiuntivoCampo),
      op: labelTextFilterOp(f.aggiuntivoOp),
      valore: f.aggiuntivoValore!,
    });
  }

  return voci;
}

const FILTRI_DESCRIZIONI: Partial<
  Record<AltriFiltriKey, (f: AltriFiltri, ctx?: AltriFiltriDescrizioneCtx) => string | undefined>
> = {
  debitore: (f) =>
    f.debitore
      ? `Debitore ${labelTextFilterOp(f.debitoreOp)} ${f.debitore}`
      : undefined,
  citta: (f) =>
    f.citta ? `Città ${labelTextFilterOp(f.cittaOp)} ${f.citta}` : undefined,
  affidoDa: (f) =>
    f.affidoDa || f.affidoA
      ? `Affido ${fmtDataFiltro(f.affidoDa)}–${fmtDataFiltro(f.affidoA)}`
      : undefined,
  promPagDa: (f) =>
    f.promPagDa || f.promPagA
      ? `Prom. pag. ${fmtDataFiltro(f.promPagDa)}–${fmtDataFiltro(f.promPagA)}`
      : undefined,
  scadenzaDa: (f) =>
    f.scadenzaDa || f.scadenzaA
      ? `Scadenza ${fmtDataFiltro(f.scadenzaDa)}–${fmtDataFiltro(f.scadenzaA)}`
      : undefined,
  codScarico: (f) => {
    const v = vociAltriFiltriAttivi(f).find((x) => x.id === "cod-scarico");
    return v
      ? `Cod. ${v.op ?? "="} ${v.valore}${v.suffisso ? ` (${v.suffisso})` : ""}`
      : undefined;
  },
  perimetro: (f) => (f.perimetro ? `Perimetro ${f.perimetro}` : undefined),
  lotto: (f) => (f.lotto ? `Lotto ${f.lotto}` : undefined),
  mandato: (f, ctx) => {
    if (!f.mandato) return undefined;
    const m = ctx?.mandanti?.find((x) => x.id === f.mandato);
    return m ? `Mandato ${m.codice}` : "Mandato";
  },
  sitAffido: (f) =>
    f.sitAffido === "affidata"
      ? "Affidata"
      : f.sitAffido === "non_affidata"
        ? "Non affidata"
        : f.sitAffido === "temporanea"
          ? "Temporanea"
          : undefined,
  affidoProvvisorio: (f) => (f.affidoProvvisorio === "1" ? "Provvisorio" : undefined),
  operatore: (f, ctx) => {
    if (!f.operatore) return undefined;
    const ids = parseOperatoreList(f.operatore);
    const labels = ids.map((id) => {
      const op = ctx?.operatori?.find((o) => o.id === id);
      return op ? codiceOperatoreFiltro(op) : id;
    });
    return labels.length ? `Cod. operatore ${labels.join(", ")}` : "Cod. operatore";
  },
  note: (f) =>
    f.note ? `Note ${labelTextFilterOp(f.noteOp)} ${f.note}` : undefined,
  aggiuntivoCampo: (f) =>
    hasAggiuntivoFiltro(f.aggiuntivoCampo, f.aggiuntivoValore)
      ? `${labelAggiuntivoCampo(f.aggiuntivoCampo)} ${labelTextFilterOp(f.aggiuntivoOp)} ${f.aggiuntivoValore}`
      : undefined,
};

export function describeAltriFiltri(
  f?: AltriFiltri | null,
  max = 4,
  ctx?: AltriFiltriDescrizioneCtx
): string {
  if (!f || !hasAltriFiltri(f)) return "";
  const parts: string[] = [];
  for (const k of ALTRI_FILTRI_KEYS) {
    const fn = FILTRI_DESCRIZIONI[k];
    const label = fn?.(f, ctx);
    if (label) parts.push(label);
    if (parts.length >= max) break;
  }
  if (!parts.length) {
    for (const v of vociAltriFiltriAttivi(f, ctx)) {
      parts.push(
        `${v.campo}${v.op ? ` ${v.op}` : ""} ${v.valore}${v.suffisso ? ` (${v.suffisso})` : ""}`
      );
      if (parts.length >= max) break;
    }
  }
  return parts.join(" · ");
}
