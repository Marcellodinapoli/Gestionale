import {
  parsePerimetri,
  perimetroPerNome,
  type CodiceScaricoPerimetro,
} from "@/lib/mandantePerimetri";
import { CODICI_SCARICO, CODICE_SCARICO_LABELS } from "@/lib/scarico";

export type MandantePerimetriRef = {
  id: string;
  perimetri: string | null;
};

export type CodScaricoFiltroKind = "operatori" | "bkOff";

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
        descrizione:
          c.descrizione?.trim() ||
          CODICE_SCARICO_LABELS[key as keyof typeof CODICE_SCARICO_LABELS] ||
          key,
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
    elenco.find((p) => {
      const label = p.nomeInterno
        ? `${p.nomeInterno} — ${p.descrizione || p.nomeMandante}`
        : p.nomeMandante;
      return label.trim() === key;
    }) ??
    null
  );
}

function resolveMandante(
  mandanti: MandantePerimetriRef[] | undefined,
  mandatoId: string | null | undefined,
  peri: string
) {
  const list = mandanti || [];
  if (mandatoId) {
    const byId = list.find((m) => m.id === mandatoId);
    if (byId) return byId;
  }
  return list.find((m) => perimetroHit(parsePerimetri(m.perimetri), peri));
}

function codiciDaHit(
  hit: NonNullable<ReturnType<typeof perimetroHit>>,
  kind: CodScaricoFiltroKind
): CodiceScaricoPerimetro[] {
  if (kind === "bkOff") {
    return hit.codiciScarico.length ? hit.codiciScarico : [];
  }
  return hit.codiciScaricoOperatori.length ? hit.codiciScaricoOperatori : [];
}

function codiciDaPerimetro(
  perimetriRaw: string | null | undefined,
  peri: string,
  kind: CodScaricoFiltroKind
): CodiceScaricoPerimetro[] {
  const elenco = parsePerimetri(perimetriRaw);
  if (!elenco.length) return [];

  const hit = perimetroHit(elenco, peri);
  if (hit) return uniqCodici(codiciDaHit(hit, kind));

  // Nessun hit sul nome: unisci tutti i perimetri del mandante (stesso kind).
  const merged: CodiceScaricoPerimetro[] = [];
  for (const p of elenco) {
    merged.push(...codiciDaHit(p, kind));
  }
  return uniqCodici(merged);
}

/** Codici scarico per filtro barra: operatori oppure back office sul perimetro. */
export function codiciScaricoFiltroDisponibili(
  mandanti: MandantePerimetriRef[] | undefined,
  mandatoId?: string | null,
  perimetro?: string | null,
  kind: CodScaricoFiltroKind = "operatori"
): CodiceScaricoPerimetro[] {
  const peri = perimetro?.trim() || "";
  if (!peri) return [];

  const mand = resolveMandante(mandanti, mandatoId, peri);
  if (!mand) {
    // Solo fallback catalogo legacy per operatori; bk off resta vuoto senza config.
    return kind === "operatori" ? codiciDefault() : [];
  }

  const daPerimetro = codiciDaPerimetro(mand.perimetri, peri, kind);
  if (daPerimetro.length) return daPerimetro;

  // Perimetro trovato ma senza codici configurati: unisci tutti i perimetri del mandante.
  const elenco = parsePerimetri(mand.perimetri);
  if (elenco.length > 1) {
    const merged: CodiceScaricoPerimetro[] = [];
    for (const p of elenco) {
      merged.push(...codiciDaHit(p, kind));
    }
    const uniq = uniqCodici(merged);
    if (uniq.length) return uniq;
  }

  return kind === "operatori" ? codiciDefault() : [];
}

export function hintCodiciScaricoFiltro(
  codiciPronti: boolean,
  perimetroSelezionato = false
) {
  if (codiciPronti) return "Scegli…";
  if (perimetroSelezionato) return "Nessun codice";
  return "Scegli perimetro";
}
