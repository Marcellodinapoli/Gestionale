import {
  ATTIVITA_PROCEDURA,
  parseAttivitaProceduraJson,
  type AttivitaProceduraKey,
} from "@/lib/giudiziale/strategiaGiudiziale";

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
};

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

/**
 * Espande le scadenze attività strategia giudiziale in voci agenda.
 * Esclude attività FATTO / N/A e scadenze vuote.
 */
export function expandScadenzeGiudiziali(input: {
  praticaId: string;
  numero: string;
  debitore: { nome: string; cognome: string };
  assegnatarioName?: string | null;
  attivitaProceduraJson?: string | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
}): AgendaGiudizialeVoce[] {
  const map = parseAttivitaProceduraJson(input.attivitaProceduraJson);
  const out: AgendaGiudizialeVoce[] = [];

  for (const meta of ATTIVITA_PROCEDURA) {
    const row = map[meta.key];
    if (!row?.scadenza?.trim()) continue;
    if (row.stato === "FATTO" || row.stato === "NON_APPLICABILE") continue;

    const memo = scadenzaToMemoAt(row.scadenza);
    if (!memo) continue;
    if (input.rangeStart && memo < input.rangeStart) continue;
    if (input.rangeEnd && memo > input.rangeEnd) continue;

    out.push({
      id: `${input.praticaId}:${meta.key}`,
      praticaId: input.praticaId,
      activityKey: meta.key,
      memoAt: memo.toISOString(),
      activityLabel: meta.label,
      titolo: `Legale · ${meta.label} · ${input.numero}`,
      numero: input.numero,
      debitore: input.debitore,
      assegnatarioName: input.assegnatarioName ?? null,
      responsabile: row.responsabile?.trim() || null,
    });
  }

  return out;
}
