import { legalAiActTypeById } from "@/lib/legal-ai/actTypes";
import { parseLegalAiSession, serializeLegalAiSession } from "@/lib/legal-ai/sessionStorage";
import type {
  LegalAiArchiveEntry,
  LegalAiDraftSession,
  LegalAiStorageScope,
} from "@/lib/legal-ai/sessionTypes";

const LEGACY_SESSION_KEY = "credixa-legal-ai-draft-v1";

export function legalAiWorkStorageKey(scope: LegalAiStorageScope): string {
  return `credixa-legal-ai-work-${scope.tenantId}-${scope.userId}`;
}

export function legalAiArchiveStorageKey(scope: LegalAiStorageScope): string {
  return `credixa-legal-ai-archive-${scope.tenantId}-${scope.userId}`;
}

export function archiveEntryLabel(session: LegalAiDraftSession): string {
  const oggetto = session.intake.oggetto.trim();
  if (oggetto) return oggetto;
  if (session.actTypeId) {
    try {
      return legalAiActTypeById(session.actTypeId).label;
    } catch {
      return "Bozza";
    }
  }
  return "Bozza senza titolo";
}

export function createArchiveEntryFromSession(
  session: LegalAiDraftSession,
  id?: string
): LegalAiArchiveEntry {
  const snapshot = parseLegalAiSession(serializeLegalAiSession(session));
  return {
    id: id ?? crypto.randomUUID(),
    label: archiveEntryLabel(snapshot),
    archivedAt: new Date().toISOString(),
    session: snapshot,
  };
}

export function parseArchiveEntries(raw: string | null): LegalAiArchiveEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: LegalAiArchiveEntry[] = [];
    for (const item of data) {
      const entry = normalizeArchiveEntry(item);
      if (entry) out.push(entry);
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeArchiveEntry(v: unknown): LegalAiArchiveEntry | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.label !== "string") return null;
  if (typeof o.archivedAt !== "string") return null;
  if (!o.session || typeof o.session !== "object") return null;
  const session = parseLegalAiSession(JSON.stringify(o.session));
  if (session.version !== 1) return null;
  return { id: o.id, label: o.label, archivedAt: o.archivedAt, session };
}

export function serializeArchiveEntries(entries: LegalAiArchiveEntry[]): string {
  return JSON.stringify(entries);
}

/** Migrazione una tantum da sessionStorage legacy. */
export function readLegacySessionStorage(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(LEGACY_SESSION_KEY);
}

export function clearLegacySessionStorage(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
}
