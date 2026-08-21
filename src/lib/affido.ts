export type TipoAffido = "definitivo" | "temporaneo" | "ripristina";

export function parseTipoAffido(value?: string | null): TipoAffido {
  if (value === "temporaneo" || value === "ripristina") return value;
  return "definitivo";
}

export function isAffidoTemporaneo(pratica: {
  assegnatarioId: string | null;
  operatoreTitolareId: string | null;
}) {
  const tit = pratica.operatoreTitolareId;
  return Boolean(tit && pratica.assegnatarioId && tit !== pratica.assegnatarioId);
}

export function idOperatoreTitolare(pratica: {
  assegnatarioId: string | null;
  operatoreTitolareId: string | null;
}) {
  return pratica.operatoreTitolareId ?? pratica.assegnatarioId;
}

export function etichettaTipoAffido(pratica: {
  assegnatarioId: string | null;
  operatoreTitolareId: string | null;
}) {
  if (isAffidoTemporaneo(pratica)) return "Temporaneo";
  if (pratica.assegnatarioId) return "Definitivo";
  return "—";
}

/** Distribuisce le pratiche a round-robin tra gli operatori (parti uguali). */
export function dividePraticheEquamente(
  praticaIds: string[],
  operatoreIds: string[]
): Array<{ operatoreId: string; praticaIds: string[] }> {
  const ops = [...new Set(operatoreIds.filter(Boolean))];
  if (!ops.length) return [];
  const buckets = ops.map((operatoreId) => ({
    operatoreId,
    praticaIds: [] as string[],
  }));
  praticaIds.forEach((id, i) => {
    buckets[i % ops.length].praticaIds.push(id);
  });
  return buckets;
}

export function parseCodiciOperatoriInput(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((c) => c.trim().toUpperCase().replace(/^\.+/, ""))
        .filter(Boolean)
    ),
  ];
}

export function riepilogoDivisioneEqua(
  buckets: Array<{ operatoreId: string; praticaIds: string[] }>,
  operatori: Array<{ id: string; name: string; codice?: string }>
) {
  const byId = new Map(operatori.map((o) => [o.id, o]));
  return buckets.map((b) => {
    const op = byId.get(b.operatoreId);
    return {
      operatoreId: b.operatoreId,
      name: op?.name || b.operatoreId,
      codice: op?.codice || "",
      count: b.praticaIds.length,
    };
  });
}

