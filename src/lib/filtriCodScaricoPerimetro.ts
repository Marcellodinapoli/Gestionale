import {
  codiciScaricoOperatoriEffettivi,
  codiciScaricoOperatoriPerPratica,
  parsePerimetri,
  perimetroPerNome,
  type CodiceScaricoPerimetro,
} from "@/lib/mandantePerimetri";
import { CODICI_SCARICO, CODICE_SCARICO_LABELS } from "@/lib/scarico";

export type MandantePerimetriRef = {
  id: string;
  perimetri: string | null;
};

function codiciDefault(): CodiceScaricoPerimetro[] {
  return CODICI_SCARICO.map((codice) => ({
    codice,
    descrizione: CODICE_SCARICO_LABELS[codice],
  }));
}

function uniqCodici(items: CodiceScaricoPerimetro[]): CodiceScaricoPerimetro[] {
  const map = new Map<string, CodiceScaricoPerimetro>();
  for (const c of items) {
    const key = c.codice.trim().toUpperCase();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        codice: key,
        descrizione: c.descrizione?.trim() || CODICE_SCARICO_LABELS[key as keyof typeof CODICE_SCARICO_LABELS] || key,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.codice.localeCompare(b.codice, "it"));
}

function perimetroHit(elenco: ReturnType<typeof parsePerimetri>, lotto: string) {
  const key = lotto.trim();
  if (!key) return null;
  return (
    perimetroPerNome(elenco, key) ??
    elenco.find((p) => p.descrizione.trim() === key) ??
    elenco.find((p) => p.nomeInterno.trim() === key) ??
    null
  );
}

function codiciDaPerimetroConfig(perimetriRaw: string | null | undefined, lotto?: string) {
  const elenco = parsePerimetri(perimetriRaw);
  if (!elenco.length) return [] as CodiceScaricoPerimetro[];

  if (lotto?.trim()) {
    const hit = perimetroHit(elenco, lotto.trim());
    if (!hit) return [];
    if (hit.codiciScarico.length) return hit.codiciScarico;
    return codiciScaricoOperatoriEffettivi(hit.codiciScaricoOperatori);
  }

  const merged: CodiceScaricoPerimetro[] = [];
  for (const p of elenco) {
    if (p.codiciScarico.length) merged.push(...p.codiciScarico);
    else merged.push(...codiciScaricoOperatoriEffettivi(p.codiciScaricoOperatori));
  }
  return uniqCodici(merged);
}

/** Codici scarico disponibili nel filtro in base a mandato / perimetro selezionati. */
export function codiciScaricoFiltroDisponibili(
  mandanti: MandantePerimetriRef[] | undefined,
  mandatoId?: string | null,
  perimetro?: string | null
): CodiceScaricoPerimetro[] {
  if (!mandatoId || !perimetro?.trim()) return [];
  const mand = (mandanti || []).find((m) => m.id === mandatoId);
  if (!mand) return [];
  const daPerimetro = codiciDaPerimetroConfig(mand.perimetri, perimetro || undefined);
  if (daPerimetro.length) return uniqCodici(daPerimetro);
  if (perimetro?.trim()) {
    return uniqCodici(codiciScaricoOperatoriEffettivi(
      codiciScaricoOperatoriPerPratica(mand.perimetri, perimetro.trim())
    ));
  }
  return codiciDefault();
}

export function hintCodiciScaricoFiltro(codiciPronti: boolean) {
  return codiciPronti ? "Seleziona uno o più codici" : "Seleziona prima il perimetro";
}
