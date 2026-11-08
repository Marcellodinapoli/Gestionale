import { titolarePratica, type StatoAffidoPratica } from "@/lib/affido";

const RUOLI_INCASSATORE_PROVV = new Set(["OPERATOR", "SUPERVISOR"]);

export function isRuoloIncassatoreProvvigionabile(ruolo: string | null | undefined): boolean {
  return Boolean(ruolo && RUOLI_INCASSATORE_PROVV.has(ruolo));
}

/**
 * Operatore creditato su provvigione e incassato (affidi / KPI):
 * titolare principale della pratica; se non c'è titolare, operatore o supervisor che registra l'incasso.
 */
export function resolveOperatoreProvvigioneIncasso(
  pratica: StatoAffidoPratica,
  incassatoreUserId: string | null | undefined,
  incassatoreRuolo?: string | null
): string | null {
  const titolare = titolarePratica(pratica);
  if (titolare) return titolare;
  if (incassatoreUserId && isRuoloIncassatoreProvvigionabile(incassatoreRuolo)) {
    return incassatoreUserId;
  }
  return null;
}
