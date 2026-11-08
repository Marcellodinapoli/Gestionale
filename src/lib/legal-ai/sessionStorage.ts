import {
  createEmptyLegalAiSession,
  type LegalAiDraftSession,
  type LegalAiIntake,
  type LegalAiRevisionItem,
  type LegalAiSearchHit,
} from "@/lib/legal-ai/sessionTypes";

export const LEGAL_AI_SESSION_STORAGE_KEY = "credixa-legal-ai-draft-v1";

export function parseLegalAiSession(raw: string | null): LegalAiDraftSession {
  if (!raw) return createEmptyLegalAiSession();
  try {
    const data = JSON.parse(raw) as Partial<LegalAiDraftSession>;
    if (data.version !== 1) return createEmptyLegalAiSession();
    return {
      version: 1,
      actTypeId: typeof data.actTypeId === "string" ? data.actTypeId : null,
      intake: normalizeIntake(data.intake),
      draftText: typeof data.draftText === "string" ? data.draftText : "",
      sourceFileName:
        typeof data.sourceFileName === "string" && data.sourceFileName.trim()
          ? data.sourceFileName.trim()
          : null,
      searchQuery: typeof data.searchQuery === "string" ? data.searchQuery : "",
      searchResults: Array.isArray(data.searchResults)
        ? data.searchResults.filter(isSearchHit)
        : [],
      revisionItems: Array.isArray(data.revisionItems)
        ? data.revisionItems.filter(isRevisionItem)
        : [],
      updatedAt:
        typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
    };
  } catch {
    return createEmptyLegalAiSession();
  }
}

function normalizeIntake(input: Partial<LegalAiIntake> | undefined): LegalAiIntake {
  return {
    oggetto: typeof input?.oggetto === "string" ? input.oggetto : "",
    sintesiFatti: typeof input?.sintesiFatti === "string" ? input.sintesiFatti : "",
    richieste: typeof input?.richieste === "string" ? input.richieste : "",
  };
}

function isSearchHit(v: unknown): v is LegalAiSearchHit {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    typeof o.excerpt === "string" &&
    typeof o.reference === "string"
  );
}

function isRevisionItem(v: unknown): v is LegalAiRevisionItem {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.message === "string" && isRevisionKind(o.kind);
}

function isRevisionKind(v: unknown): v is LegalAiRevisionItem["kind"] {
  return v === "style" || v === "structure" || v === "citation" || v === "clarity";
}

export function serializeLegalAiSession(session: LegalAiDraftSession): string {
  return JSON.stringify(session);
}
