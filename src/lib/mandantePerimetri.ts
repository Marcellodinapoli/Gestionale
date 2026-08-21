import { METODI_INCASSO } from "@/lib/metodoIncasso";

export type LatoEconomico = {
  provvigionePerc: number | null;
  provvigioniMetodo: Record<string, number>;
  incentivoTipo: string | null;
  incentivoValore: number | null;
  incentivoSoglia: number | null;
  incentivoNote: string | null;
};

export type MandantePerimetro = {
  id: string;
  nome: string;
  ricevuta: LatoEconomico;
  pagata: LatoEconomico;
};

export function emptyLatoEconomico(): LatoEconomico {
  return {
    provvigionePerc: null,
    provvigioniMetodo: {},
    incentivoTipo: null,
    incentivoValore: null,
    incentivoSoglia: null,
    incentivoNote: null,
  };
}

export function emptyPerimetro(nome = ""): MandantePerimetro {
  return {
    id: `per-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome,
    ricevuta: emptyLatoEconomico(),
    pagata: emptyLatoEconomico(),
  };
}

function normalizeLato(raw: unknown): LatoEconomico {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const metodoRaw = o.provvigioniMetodo;
  let provvigioniMetodo: Record<string, number> = {};
  if (metodoRaw && typeof metodoRaw === "object" && !Array.isArray(metodoRaw)) {
    provvigioniMetodo = Object.fromEntries(
      Object.entries(metodoRaw as Record<string, unknown>)
        .map(([k, v]) => [k, Number(v)])
        .filter(([, v]) => !Number.isNaN(v) && v >= 0)
    );
  }
  return {
    provvigionePerc:
      o.provvigionePerc != null && o.provvigionePerc !== ""
        ? Number(o.provvigionePerc)
        : null,
    provvigioniMetodo,
    incentivoTipo: o.incentivoTipo ? String(o.incentivoTipo) : null,
    incentivoValore:
      o.incentivoValore != null && o.incentivoValore !== ""
        ? Number(o.incentivoValore)
        : null,
    incentivoSoglia:
      o.incentivoSoglia != null && o.incentivoSoglia !== ""
        ? Number(o.incentivoSoglia)
        : null,
    incentivoNote: o.incentivoNote ? String(o.incentivoNote) : null,
  };
}

export function parsePerimetri(raw: string | null | undefined): MandantePerimetro[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const nome = String(o.nome || "").trim();
        if (!nome) return null;
        return {
          id: String(o.id || `per-${nome}`),
          nome,
          ricevuta: normalizeLato(o.ricevuta),
          pagata: normalizeLato(o.pagata),
        } satisfies MandantePerimetro;
      })
      .filter((p): p is MandantePerimetro => p != null);
  } catch {
    return [];
  }
}

export function serializePerimetri(perimetri: MandantePerimetro[]): string {
  return JSON.stringify(perimetri);
}

export function latoMetodoToForm(lato: LatoEconomico): Record<string, string> {
  return Object.fromEntries(
    METODI_INCASSO.map((m) => [
      m.value,
      lato.provvigioniMetodo[m.value] != null
        ? String(lato.provvigioniMetodo[m.value])
        : "",
    ])
  );
}

export function formToLatoMetodo(form: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of METODI_INCASSO) {
    const raw = form[m.value]?.trim();
    if (!raw) continue;
    const n = parseFloat(raw.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) out[m.value] = n;
  }
  return out;
}

export function parseOptionalFloat(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isNaN(n) ? null : n;
}
