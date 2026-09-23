import {
  ATTIVITA_PROCEDURA,
  parseAttivitaProceduraJson,
  type AttivitaProceduraKey,
} from "@/lib/giudiziale/strategiaGiudiziale";
import { parseAgendaScadenze, toYmd } from "@/lib/giudiziale/impegniLegali";

export type AgendaLegaleFase = "Avvio" | "Strategia" | "Esito" | "Impegno";

export type AgendaGiudizialeVoce = {
  id: string;
  praticaId: string;
  activityKey: AttivitaProceduraKey | string;
  memoAt: string;
  titolo: string;
  activityLabel: string;
  numero: string;
  debitore: { nome: string; cognome: string };
  assegnatarioName?: string | null;
  responsabile?: string | null;
  href?: string;
  fase?: AgendaLegaleFase;
};

export function hrefImpegnoLegale(praticaId: string, activityKey: string): string {
  if (activityKey === "affidamento") {
    return `/pratiche/${praticaId}/avvio-giudiziale`;
  }
  if (activityKey === "valutazione") {
    return `/pratiche/${praticaId}/valutazione-legale`;
  }
  return `/pratiche/${praticaId}/strategia-giudiziale`;
}

/** Converte YYYY-MM-DD in Date locale alle 09:00 (tutto il giorno in agenda). */
export function scadenzaToMemoAt(scadenza: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scadenza.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d, 9, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function inRange(memo: Date, start?: Date | null, end?: Date | null) {
  if (start && memo < start) return false;
  if (end && memo > end) return false;
  return true;
}

export type ExpandImpegniLegaliInput = {
  praticaId: string;
  numero: string;
  debitore: { nome: string; cognome: string };
  assegnatarioName?: string | null;
  dataAffidamentoGiudiziale?: Date | string | null;
  attivitaProceduraJson?: string | null;
  agendaScadenze?: string | null;
  dataEsito?: Date | string | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
};

function pushYmd(
  out: AgendaGiudizialeVoce[],
  input: ExpandImpegniLegaliInput,
  opts: {
    id: string;
    activityKey: string;
    activityLabel: string;
    ymd: string | null;
    fase: AgendaLegaleFase;
    responsabile?: string | null;
  }
) {
  if (!opts.ymd) return;
  const memo = scadenzaToMemoAt(opts.ymd);
  if (!memo) return;
  if (!inRange(memo, input.rangeStart, input.rangeEnd)) return;
  out.push({
    id: opts.id,
    praticaId: input.praticaId,
    activityKey: opts.activityKey,
    memoAt: memo.toISOString(),
    activityLabel: opts.activityLabel,
    titolo: `Legale · ${opts.activityLabel} · ${input.numero}`,
    numero: input.numero,
    debitore: input.debitore,
    assegnatarioName: input.assegnatarioName ?? null,
    responsabile: opts.responsabile ?? null,
    href: hrefImpegnoLegale(input.praticaId, opts.activityKey),
    fase: opts.fase,
  });
}

/**
 * Date prese dalle pagine Legal (avvio, strategia, esito, impegni extra).
 * Esclude attività FATTO / N/A.
 */
export function expandImpegniLegali(
  input: ExpandImpegniLegaliInput
): AgendaGiudizialeVoce[] {
  const out: AgendaGiudizialeVoce[] = [];

  pushYmd(out, input, {
    id: `${input.praticaId}:affidamento`,
    activityKey: "affidamento",
    activityLabel: "Affidamento giudiziale",
    ymd: toYmd(input.dataAffidamentoGiudiziale),
    fase: "Avvio",
  });

  const map = parseAttivitaProceduraJson(input.attivitaProceduraJson);
  for (const meta of ATTIVITA_PROCEDURA) {
    const row = map[meta.key];
    if (!row?.scadenza?.trim()) continue;
    if (row.stato === "FATTO" || row.stato === "NON_APPLICABILE") continue;
    pushYmd(out, input, {
      id: `${input.praticaId}:${meta.key}`,
      activityKey: meta.key,
      activityLabel: meta.label,
      ymd: row.scadenza.trim(),
      fase: "Strategia",
      responsabile: row.responsabile?.trim() || null,
    });
  }

  const extras = parseAgendaScadenze(input.agendaScadenze);
  for (const extra of extras.impegni) {
    pushYmd(out, input, {
      id: `${input.praticaId}:extra:${extra.id}`,
      activityKey: `extra:${extra.id}`,
      activityLabel: extra.titolo,
      ymd: extra.data,
      fase: "Impegno",
      responsabile: extra.nota?.trim() || null,
    });
  }

  pushYmd(out, input, {
    id: `${input.praticaId}:esito`,
    activityKey: "esito",
    activityLabel: "Esito procedura",
    ymd: toYmd(input.dataEsito),
    fase: "Esito",
  });

  return out;
}

/** Compat: solo scadenze attività strategia. */
export function expandScadenzeGiudiziali(
  input: ExpandImpegniLegaliInput
): AgendaGiudizialeVoce[] {
  return expandImpegniLegali(input);
}
