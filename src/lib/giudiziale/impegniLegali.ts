/** Impegni extra con data, salvati in PraticaGiudiziale.agendaScadenze. */

export type ImpegnoLegaleExtra = {
  id: string;
  titolo: string;
  data: string;
  nota?: string;
};

type StoredV1 = {
  v: 1;
  impegni: ImpegnoLegaleExtra[];
  note?: string;
};

export function newImpegnoLegaleId() {
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isYmd(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function normalizeImpegno(raw: unknown): ImpegnoLegaleExtra | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const titolo = String(row.titolo ?? "").trim();
  const data = String(row.data ?? "").trim();
  if (!titolo || !isYmd(data)) return null;
  const nota = String(row.nota ?? "").trim();
  return {
    id: String(row.id ?? "").trim() || newImpegnoLegaleId(),
    titolo,
    data,
    ...(nota ? { nota } : {}),
  };
}

export function parseAgendaScadenze(raw?: string | null): {
  impegni: ImpegnoLegaleExtra[];
  note: string;
} {
  if (!raw?.trim()) return { impegni: [], note: "" };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Partial<StoredV1> & { impegni?: unknown };
      if (obj.v === 1 && Array.isArray(obj.impegni)) {
        return {
          impegni: obj.impegni.map(normalizeImpegno).filter(Boolean) as ImpegnoLegaleExtra[],
          note: typeof obj.note === "string" ? obj.note : "",
        };
      }
    }
    if (Array.isArray(parsed)) {
      return {
        impegni: parsed.map(normalizeImpegno).filter(Boolean) as ImpegnoLegaleExtra[],
        note: "",
      };
    }
  } catch {
    /* testo libero pre-esistente */
  }
  return { impegni: [], note: raw };
}

export function serializeAgendaScadenze(
  impegni: ImpegnoLegaleExtra[],
  note: string
): string {
  const clean = impegni.map(normalizeImpegno).filter(Boolean) as ImpegnoLegaleExtra[];
  const trimmed = note.trim();
  if (!clean.length && !trimmed) return "";
  const stored: StoredV1 = { v: 1, impegni: clean };
  if (trimmed) stored.note = trimmed;
  return JSON.stringify(stored);
}

/** YYYY-MM-DD da Date o stringa ISO / date input. */
export function toYmd(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return localYmd(dt);
  }
  if (Number.isNaN(value.getTime())) return null;
  return localYmd(value);
}

function localYmd(d: Date) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}
