export type TipoAffido = "definitivo" | "temporaneo" | "ripristina";

export function parseTipoAffido(value?: string | null): TipoAffido {
  if (value === "temporaneo" || value === "ripristina") return value;
  return "definitivo";
}

export function isAffidoTemporaneo(pratica: {
  assegnatarioId?: string | null;
  operatoreTitolareId?: string | null;
}) {
  const tit = pratica.operatoreTitolareId;
  return Boolean(tit && pratica.assegnatarioId && tit !== pratica.assegnatarioId);
}

export function idOperatoreTitolare(pratica: {
  assegnatarioId?: string | null;
  operatoreTitolareId?: string | null;
}) {
  return pratica.operatoreTitolareId ?? pratica.assegnatarioId;
}

export function etichettaTipoAffido(pratica: {
  assegnatarioId?: string | null;
  operatoreTitolareId?: string | null;
}) {
  if (isAffidoTemporaneo(pratica)) return "Temporaneo";
  if (pratica.assegnatarioId) return "Definitivo";
  return "—";
}

/** Ordine colonna Affido: non assegnata → definitivo → temporaneo. */
export function sortKeyTipoAffido(pratica: {
  assegnatarioId?: string | null;
  operatoreTitolareId?: string | null;
}) {
  if (isAffidoTemporaneo(pratica)) return 2;
  if (pratica.assegnatarioId) return 1;
  return 0;
}

export type StatoAffidoPratica = {
  assegnatarioId: string | null;
  operatoreTitolareId: string | null;
};

export function titolarePratica(
  p: StatoAffidoPratica,
  titolareEsplicito?: string | null
): string | null {
  return p.operatoreTitolareId ?? p.assegnatarioId ?? titolareEsplicito ?? null;
}

/** Messaggio errore se l'affido non è applicabile; null se ok. */
export function validaAffidoPratica(
  p: StatoAffidoPratica,
  tipo: TipoAffido,
  assegnatarioId: string | null,
  titolareEsplicito?: string | null
): string | null {
  const titolare = titolarePratica(p, titolareEsplicito);

  if (tipo === "ripristina") {
    if (!isAffidoTemporaneo(p)) return "Non è un affido temporaneo";
    if (!titolare) return "Nessun titolare da ripristinare";
    if (p.assegnatarioId === titolare) return "La pratica è già presso il titolare";
    return null;
  }

  if (!assegnatarioId) return "Seleziona un operatore";

  if (tipo === "temporaneo") {
    if (!titolare) return "Indica il titolare (affido definitivo)";
    if (assegnatarioId === titolare) return "Seleziona un operatore diverso dal titolare";
    return null;
  }

  return null;
}

export function validaAffidoSelezione(
  ids: string[],
  pratiche: Record<string, StatoAffidoPratica>,
  tipo: TipoAffido,
  assegnatarioId: string | null,
  titolareEsplicito?: string | null
): string | null {
  if (!ids.length) return "Seleziona almeno una pratica";
  const errori: string[] = [];
  for (const id of ids) {
    const p = pratiche[id];
    if (!p) continue;
    const err = validaAffidoPratica(p, tipo, assegnatarioId, titolareEsplicito);
    if (err) errori.push(err);
  }
  if (!errori.length) return null;
  const unici = [...new Set(errori)];
  return unici.length === 1
    ? unici[0]!
    : `${unici.slice(0, 2).join(" · ")}${unici.length > 2 ? "…" : ""}`;
}

export function selezioneRichiedeTitolare(
  ids: string[],
  pratiche: Record<string, StatoAffidoPratica>,
  tipo: TipoAffido
): boolean {
  if (tipo !== "temporaneo") return false;
  return ids.some((id) => {
    const p = pratiche[id];
    return p ? !titolarePratica(p) : false;
  });
}

export function selezioneConsenteRipristina(
  ids: string[],
  pratiche: Record<string, StatoAffidoPratica>
): boolean {
  if (!ids.length) return false;
  return ids.every((id) => {
    const p = pratiche[id];
    return p ? isAffidoTemporaneo(p) : false;
  });
}

/** Distribuisce le pratiche in parti uguali; eventuale resto all'ultimo operatore. */
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

  const n = praticaIds.length;
  const base = Math.floor(n / ops.length);
  const resto = n % ops.length;

  let idx = 0;
  for (let i = 0; i < ops.length; i++) {
    const count = i === ops.length - 1 ? base + resto : base;
    for (let j = 0; j < count; j++) {
      buckets[i]!.praticaIds.push(praticaIds[idx]!);
      idx++;
    }
  }

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

