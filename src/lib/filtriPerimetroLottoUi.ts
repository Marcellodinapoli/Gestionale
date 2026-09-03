import { parsePerimetri, parsePerimetriList, perimetroPerNome, type PerimetroListItem } from "@/lib/mandantePerimetri";
import type { MandantePerimetriRef } from "@/lib/filtriCodScaricoPerimetro";

export type PerimetroFiltroOption = {
  value: string;
  label: string;
};

/** Opzioni perimetro (chiave import = nomeMandante) filtrate per mandato. */
export function perimetroFiltroOptions(
  mandanti: MandantePerimetriRef[] | undefined,
  mandatoId?: string | null
): PerimetroFiltroOption[] {
  const list = mandatoId
    ? (mandanti || []).filter((m) => m.id === mandatoId)
    : mandanti || [];
  const opts: PerimetroFiltroOption[] = [];
  const seen = new Set<string>();

  for (const m of list) {
    for (const p of parsePerimetriList(m.perimetri)) {
      pushPerimetroOption(opts, seen, p);
    }
  }

  return opts.sort((a, b) => a.label.localeCompare(b.label, "it"));
}

/** Mandante collegato al perimetro selezionato (per codici scarico in barra rapida). */
export function mandatoIdPerPerimetroFiltro(
  mandanti: MandantePerimetriRef[] | undefined,
  perimetro?: string | null
): string | undefined {
  const key = perimetro?.trim();
  if (!key) return undefined;
  for (const m of mandanti || []) {
    if (perimetroPerNome(parsePerimetri(m.perimetri), key)) return m.id;
  }
  return undefined;
}

function pushPerimetroOption(
  opts: PerimetroFiltroOption[],
  seen: Set<string>,
  p: PerimetroListItem
) {
  const value = p.nomeMandante.trim();
  if (!value || seen.has(value)) return;
  seen.add(value);
  opts.push({
    value,
    label: p.nomeInterno
      ? `${p.nomeInterno} — ${p.descrizione || p.nomeMandante}`
      : p.label,
  });
}

/** Lotti (numero mandante) disponibili, opz. ristretti al mandato selezionato. */
export function lottoFiltroOptions(
  lotti: string[] | undefined,
  lottiPerMandato: Record<string, string[]> | undefined,
  mandatoId?: string | null
): string[] {
  if (mandatoId && lottiPerMandato?.[mandatoId]?.length) {
    return lottiPerMandato[mandatoId]!;
  }
  return lotti || [];
}
