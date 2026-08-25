/**
 * Tipi e helper lavorazione — sicuri per Client Component (niente Prisma).
 */
import { CODICI_SCARICO, type CodiceScarico } from "@/lib/scarico";
import type { AltriFiltri } from "@/lib/praticheAltriFiltriUi";

export const STATO_LAVORAZIONE_FISSO = "IN_LAVORAZIONE" as const;

export type VoceLavorazioneSuggerita = {
  id: string;
  descrizione: string;
  codiceScarico: CodiceScarico | "";
  filtri: AltriFiltri;
  lavorateDa: string;
  lavorateA: string;
  note: string;
  noteAggiuntive: string;
  contestoPerimetro?: "affido" | "lavorazione";
};

export type OperatoreConteggiLavorazione = {
  id: string;
  name: string;
  totale: number;
  lavorate: number;
  hrefTotale: string;
  hrefLavorate: string;
};

export type VoceLavorazioneConConteggi = VoceLavorazioneSuggerita & {
  totale: number;
  lavorate: number;
  hrefTotale: string;
  hrefLavorate: string;
  operatori: OperatoreConteggiLavorazione[];
};

export type PerimetroRigaLavorazione = {
  key: string;
  situazione: "affido" | "lavorazione";
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  label: string;
  codici: Array<{ codice: CodiceScarico | ""; count: number }>;
};

export const CODICI_SCARICO_VOCE = [
  { value: "", label: "— Nessuno —" },
  ...CODICI_SCARICO.map((c) => ({ value: c, label: c })),
] as const;

function newId() {
  return `lav-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isIsoDay(value?: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()));
}

export function emptyVoce(descrizione = "", data?: string): VoceLavorazioneSuggerita {
  const giorno = isIsoDay(data) ? data!.trim() : todayIso();
  return {
    id: newId(),
    descrizione,
    codiceScarico: "",
    filtri: {},
    lavorateDa: giorno,
    lavorateA: giorno,
    note: "",
    noteAggiuntive: "",
  };
}

export function situazioneRigaVoce(
  voce: VoceLavorazioneSuggerita
): "affido" | "lavorazione" | "" {
  if (voce.contestoPerimetro) return voce.contestoPerimetro;
  if (!voce.filtri.mandato && voce.filtri.sitAffido !== "affidata") return "";
  return voce.filtri.sitAffido === "affidata" ? "affido" : "lavorazione";
}

export function matchPerimetroRiga(
  voce: VoceLavorazioneSuggerita,
  perimetri: PerimetroRigaLavorazione[]
): string {
  const mandato = voce.filtri.mandato;
  if (!mandato) return "";
  const lotto = voce.filtri.lotto ?? "—";
  const situazione = situazioneRigaVoce(voce);
  if (!situazione) return "";
  const prefix = situazione === "affido" ? "aff" : "lav";
  const key = `${prefix}|${mandato}|${lotto}`;
  return perimetri.some((p) => p.key === key) ? key : "";
}

export function applyPerimetroRiga(
  voce: VoceLavorazioneSuggerita,
  perimetro: PerimetroRigaLavorazione
): VoceLavorazioneSuggerita {
  const filtri = { ...voce.filtri, mandato: perimetro.mandanteId };
  if (perimetro.perimetro !== "—") filtri.lotto = perimetro.perimetro;
  else delete filtri.lotto;
  delete filtri.codScarico;
  if (perimetro.situazione === "affido") filtri.sitAffido = "affidata";
  else delete filtri.sitAffido;

  const codiciValidi = new Set(perimetro.codici.map((c) => c.codice));
  const codiceScarico = codiciValidi.has(voce.codiceScarico) ? voce.codiceScarico : "";

  return { ...voce, codiceScarico, filtri, contestoPerimetro: perimetro.situazione };
}

export function clearPerimetroRiga(voce: VoceLavorazioneSuggerita): VoceLavorazioneSuggerita {
  const filtri = { ...voce.filtri };
  delete filtri.mandato;
  delete filtri.lotto;
  delete filtri.sitAffido;
  delete filtri.codScarico;
  return { ...voce, codiceScarico: "", filtri, contestoPerimetro: undefined };
}

export function codiciScaricoPerRiga(
  voce: VoceLavorazioneSuggerita,
  perimetri: PerimetroRigaLavorazione[]
) {
  const periKey = matchPerimetroRiga(voce, perimetri);
  if (!periKey) return CODICI_SCARICO_VOCE;
  const peri = perimetri.find((p) => p.key === periKey);
  if (!peri?.codici.length) return CODICI_SCARICO_VOCE;
  const allowed = new Set(peri.codici.map((c) => c.codice));
  return CODICI_SCARICO_VOCE.filter((o) => o.value === "" || allowed.has(o.value));
}

export function labelPerimetroVoce(
  voce: VoceLavorazioneSuggerita,
  perimetri: PerimetroRigaLavorazione[]
): string {
  const key = matchPerimetroRiga(voce, perimetri);
  if (!key) return "—";
  const peri = perimetri.find((p) => p.key === key);
  if (!peri) return "—";
  const situazione = peri.situazione === "affido" ? "In affido" : "In lavorazione";
  return `${situazione} · ${peri.label}`;
}
