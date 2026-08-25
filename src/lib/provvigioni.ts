import type { Prisma } from "@prisma/client";
import { isManutenzione, type SessionUser } from "@/lib/permissions";

import type { LatoEconomico } from "@/lib/mandantePerimetri";

/** Percentuale provvigione sull'importo incassato (default demo). */
export const PROVVIGIONE_PERCENTUALE = 8;

export const PROVVIGIONE_STATO_LABELS: Record<string, string> = {
  MATURATA: "Maturata",
  LIQUIDATA: "Liquidata",
};

export function calcolaProvvigione(baseImporto: number, percentuale = PROVVIGIONE_PERCENTUALE) {
  const importo = Math.round(baseImporto * (percentuale / 100) * 100) / 100;
  return { baseImporto, percentuale, importo };
}

export type ProvvigioniMetodoMap = Record<string, number>;

export function parseProvvigioniMetodo(raw: string | null | undefined): ProvvigioniMetodoMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: ProvvigioniMetodoMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
      if (!Number.isNaN(n) && n >= 0) out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export function resolveProvvigionePercentuale(
  mandante: { provvigionePerc?: number | null; provvigioniMetodo?: string | null },
  metodo: string
) {
  const perMetodo = parseProvvigioniMetodo(mandante.provvigioniMetodo);
  if (perMetodo[metodo] != null) return perMetodo[metodo];
  if (mandante.provvigionePerc != null) return mandante.provvigionePerc;
  return PROVVIGIONE_PERCENTUALE;
}

/** Risolve la % provvigione dal lato economico perimetro (modalità > codice scarico > base). */
export function resolveProvvigionePercentualeLato(
  lato: Pick<LatoEconomico, "provvigionePerc" | "provvigioniMetodo" | "provvigioniCodice">,
  metodo: string,
  codiceScarico?: string | null
) {
  if (lato.provvigioniMetodo[metodo] != null) {
    return lato.provvigioniMetodo[metodo]!;
  }
  const codice = codiceScarico?.trim().toUpperCase() || "";
  if (codice && lato.provvigioniCodice?.[codice] != null) {
    return lato.provvigioniCodice[codice]!;
  }
  if (lato.provvigionePerc != null) return lato.provvigionePerc;
  return PROVVIGIONE_PERCENTUALE;
}

export function provvigioniWhere(
  user: SessionUser,
  opts?: { sedeId?: string | null }
): Prisma.ProvvigioneWhereInput {
  if (isManutenzione(user)) return { id: "__nessun-dato__" };
  const tenantScope = { pratica: { tenantId: user.tenantId } };
  const sedeId = opts?.sedeId !== undefined ? opts.sedeId : null;

  if (user.role === "ADMIN" || user.role === "AMMINISTRAZIONE") {
    if (sedeId) {
      return { AND: [tenantScope, { operatore: { sedeId } }] };
    }
    return tenantScope;
  }
  if (user.role === "OPERATOR") {
    return { AND: [tenantScope, { operatoreId: user.id }] };
  }
  if (user.role === "SUPERVISOR") {
    return {
      AND: [
        tenantScope,
        {
          operatore: {
            OR: [{ id: user.id }, { supervisorId: user.id }],
          },
        },
      ],
    };
  }
  return { AND: [tenantScope, { operatoreId: user.id }] };
}

export function provvigioneStatoLabel(stato: string) {
  return PROVVIGIONE_STATO_LABELS[stato] || stato;
}
