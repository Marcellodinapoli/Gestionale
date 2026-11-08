import { hasOperatoreFiltro } from "@/lib/filtriOperatore";
import {
  CODICE_SCARICO_LABELS,
  CODICI_SCARICO,
  codiceScaricoPratica,
  type CodiceScarico,
} from "@/lib/scarico";

export type RigaRiepilogoCodiceScarico = {
  codice: string;
  count: number;
};

const SENZA_CODICE_KEY = "Senza codice";

/**
 * Riepilogo per tutti i ruoli con pagina Pratiche:
 * supervisor/admin/… con **Cod. operatore** in filtro; operatore con elenco caricato (portafoglio implicito).
 */
export function shouldShowPraticheRiepilogoCodiciScarico(opts: {
  showElenco: boolean;
  ricercaAnagrafica: boolean;
  role: string;
  operatore?: string | null;
}): boolean {
  if (!opts.showElenco || opts.ricercaAnagrafica) return false;
  if (opts.role === "OPERATOR") return true;
  return hasOperatoreFiltro(opts.operatore);
}

/** Aggrega pratiche per codice scarico effettivo (come in elenco pratiche). */
export function aggregaCodiciScaricoPratiche(
  rows: Array<{ stato: string; codiceScarico: string | null }>
): RigaRiepilogoCodiceScarico[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const cod = codiceScaricoPratica(row.stato, row.codiceScarico);
    const key = cod?.trim() || SENZA_CODICE_KEY;
    map.set(key, (map.get(key) || 0) + 1);
  }

  const known = new Set(CODICI_SCARICO as readonly string[]);
  const entries = [...map.entries()].filter(([, n]) => n > 0);

  entries.sort(([a], [b]) => {
    if (a === SENZA_CODICE_KEY) return 1;
    if (b === SENZA_CODICE_KEY) return -1;
    const ia = known.has(a) ? CODICI_SCARICO.indexOf(a as CodiceScarico) : 999;
    const ib = known.has(b) ? CODICI_SCARICO.indexOf(b as CodiceScarico) : 999;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, "it");
  });

  return entries.map(([codice, count]) => ({ codice, count }));
}

export function descrizioneCodiceRiepilogo(codice: string): string | undefined {
  if (codice === SENZA_CODICE_KEY) return "Pratiche senza codice scarico";
  if ((CODICI_SCARICO as readonly string[]).includes(codice)) {
    return CODICE_SCARICO_LABELS[codice as CodiceScarico];
  }
  return undefined;
}
