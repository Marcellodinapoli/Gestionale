export const MSG_AGENDA_NEL_PASSATO =
  "Non puoi inserire un impegno in data o ora precedente a quella attuale.";

export function parseAgendaLocalDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Avviso se la data/ora è già passata rispetto a `now` (orologio locale). */
export function avvisoAgendaNelPassato(
  value: string | Date,
  now = new Date()
): string | null {
  const d = value instanceof Date ? value : parseAgendaLocalDateTime(value);
  if (!d) return null;
  return d.getTime() < now.getTime() ? MSG_AGENDA_NEL_PASSATO : null;
}

export function assertAgendaNonNelPassato(memoAt: Date, now = new Date()): void {
  if (memoAt.getTime() < now.getTime()) {
    throw new Error(MSG_AGENDA_NEL_PASSATO);
  }
}
