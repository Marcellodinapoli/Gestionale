/** Fascia oraria selezionabile nei calendari agenda (impegni / memo). */
export const AGENDA_ORA_LAVORO_MIN = 9;
export const AGENDA_ORA_LAVORO_MAX = 21;

export const AGENDA_ORE_LAVORO: number[] = Array.from(
  { length: AGENDA_ORA_LAVORO_MAX - AGENDA_ORA_LAVORO_MIN + 1 },
  (_, i) => AGENDA_ORA_LAVORO_MIN + i
);

export function clampAgendaHour(h: number): number {
  return Math.min(AGENDA_ORA_LAVORO_MAX, Math.max(AGENDA_ORA_LAVORO_MIN, h));
}

export const AGENDA_MINUTI_LAVORO: number[] = Array.from({ length: 12 }, (_, i) => i * 5);

/** Arrotonda al quarto di ora più vicino (0, 5, …, 55). */
export function roundAgendaMinute(m: number): number {
  const clamped = Math.min(59, Math.max(0, Math.round(m)));
  const rounded = Math.round(clamped / 5) * 5;
  return Math.min(55, rounded);
}
