/** Stato redazione Credixa Legal AI — solo browser (sessionStorage), nessun salvataggio server. */

export type LegalAiIntake = {
  oggetto: string;
  sintesiFatti: string;
  richieste: string;
};

export type LegalAiSearchHit = {
  id: string;
  title: string;
  excerpt: string;
  /** Segnaposto per riferimento verificabile (provider esterno in fase successiva). */
  reference: string;
};

export type LegalAiRevisionItem = {
  id: string;
  kind: "style" | "structure" | "citation" | "clarity";
  message: string;
};

export type LegalAiDraftSession = {
  version: 1;
  actTypeId: string | null;
  intake: LegalAiIntake;
  draftText: string;
  /** Nome file caricato da disco (solo riferimento locale, il testo è in draftText). */
  sourceFileName: string | null;
  searchQuery: string;
  searchResults: LegalAiSearchHit[];
  revisionItems: LegalAiRevisionItem[];
  updatedAt: string;
};

export const EMPTY_LEGAL_AI_INTAKE: LegalAiIntake = {
  oggetto: "",
  sintesiFatti: "",
  richieste: "",
};

export function createEmptyLegalAiSession(): LegalAiDraftSession {
  return {
    version: 1,
    actTypeId: null,
    intake: { ...EMPTY_LEGAL_AI_INTAKE },
    draftText: "",
    sourceFileName: null,
    searchQuery: "",
    searchResults: [],
    revisionItems: [],
    updatedAt: new Date(0).toISOString(),
  };
}

/** Snapshot archiviato solo su localStorage del browser (per utente/tenant). */
export type LegalAiArchiveEntry = {
  id: string;
  /** Titolo in elenco (oggetto o tipologia atto). */
  label: string;
  archivedAt: string;
  session: LegalAiDraftSession;
};

export type LegalAiStorageScope = {
  tenantId: string;
  userId: string;
};
