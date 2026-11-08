"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createArchiveEntryFromSession,
  legalAiArchiveStorageKey,
  legalAiWorkStorageKey,
  parseArchiveEntries,
  readLegacySessionStorage,
  clearLegacySessionStorage,
  serializeArchiveEntries,
} from "@/lib/legal-ai/localArchive";
import { parseLegalAiSession, serializeLegalAiSession } from "@/lib/legal-ai/sessionStorage";
import {
  createEmptyLegalAiSession,
  type LegalAiArchiveEntry,
  type LegalAiDraftSession,
  type LegalAiIntake,
  type LegalAiRevisionItem,
  type LegalAiSearchHit,
  type LegalAiStorageScope,
} from "@/lib/legal-ai/sessionTypes";

type LegalAiSessionContextValue = {
  session: LegalAiDraftSession;
  archive: LegalAiArchiveEntry[];
  hydrated: boolean;
  patchSession: (patch: Partial<LegalAiDraftSession>) => void;
  setActTypeId: (actTypeId: string) => void;
  setIntake: (patch: Partial<LegalAiIntake>) => void;
  setDraftText: (draftText: string) => void;
  setSearchQuery: (searchQuery: string) => void;
  setSearchResults: (searchResults: LegalAiSearchHit[]) => void;
  setRevisionItems: (revisionItems: LegalAiRevisionItem[]) => void;
  resetSession: () => void;
  saveToArchive: () => { ok: boolean; message?: string };
  loadArchiveEntry: (id: string) => void;
  deleteArchiveEntry: (id: string) => void;
};

const LegalAiSessionContext = createContext<LegalAiSessionContextValue | null>(null);

export function LegalAiSessionProvider({
  storageScope,
  children,
}: {
  storageScope: LegalAiStorageScope;
  children: ReactNode;
}) {
  const [session, setSession] = useState<LegalAiDraftSession>(createEmptyLegalAiSession);
  const [archive, setArchive] = useState<LegalAiArchiveEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const workKey = legalAiWorkStorageKey(storageScope);
  const archiveKey = legalAiArchiveStorageKey(storageScope);

  useEffect(() => {
    const legacy = readLegacySessionStorage();
    const fromWork = localStorage.getItem(workKey);
    const raw = fromWork ?? legacy;
    setSession(parseLegalAiSession(raw));
    setArchive(parseArchiveEntries(localStorage.getItem(archiveKey)));
    if (legacy && !fromWork) {
      localStorage.setItem(workKey, serializeLegalAiSession(parseLegalAiSession(legacy)));
      clearLegacySessionStorage();
    }
    setHydrated(true);
  }, [workKey, archiveKey]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(workKey, serializeLegalAiSession(session));
  }, [session, hydrated, workKey]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(archiveKey, serializeArchiveEntries(archive));
  }, [archive, hydrated, archiveKey]);

  const patchSession = useCallback((patch: Partial<LegalAiDraftSession>) => {
    setSession((prev) => ({
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setActTypeId = useCallback(
    (actTypeId: string) => patchSession({ actTypeId }),
    [patchSession]
  );

  const setIntake = useCallback((patch: Partial<LegalAiIntake>) => {
    setSession((prev) => ({
      ...prev,
      intake: { ...prev.intake, ...patch },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const setDraftText = useCallback(
    (draftText: string) => patchSession({ draftText }),
    [patchSession]
  );

  const setSearchQuery = useCallback(
    (searchQuery: string) => patchSession({ searchQuery }),
    [patchSession]
  );

  const setSearchResults = useCallback(
    (searchResults: LegalAiSearchHit[]) => patchSession({ searchResults }),
    [patchSession]
  );

  const setRevisionItems = useCallback(
    (revisionItems: LegalAiRevisionItem[]) => patchSession({ revisionItems }),
    [patchSession]
  );

  const resetSession = useCallback(() => {
    setSession(createEmptyLegalAiSession());
  }, []);

  const saveToArchive = useCallback(() => {
    if (!session.draftText.trim()) {
      return { ok: false, message: "Genera o scrivi una bozza prima di archiviare." };
    }
    const entry = createArchiveEntryFromSession(session);
    setArchive((prev) => [entry, ...prev]);
    return { ok: true };
  }, [session]);

  const loadArchiveEntry = useCallback(
    (id: string) => {
      const entry = archive.find((e) => e.id === id);
      if (!entry) return;
      setSession(parseLegalAiSession(serializeLegalAiSession(entry.session)));
    },
    [archive]
  );

  const deleteArchiveEntry = useCallback((id: string) => {
    setArchive((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      session,
      archive,
      hydrated,
      patchSession,
      setActTypeId,
      setIntake,
      setDraftText,
      setSearchQuery,
      setSearchResults,
      setRevisionItems,
      resetSession,
      saveToArchive,
      loadArchiveEntry,
      deleteArchiveEntry,
    }),
    [
      session,
      archive,
      hydrated,
      patchSession,
      setActTypeId,
      setIntake,
      setDraftText,
      setSearchQuery,
      setSearchResults,
      setRevisionItems,
      resetSession,
      saveToArchive,
      loadArchiveEntry,
      deleteArchiveEntry,
    ]
  );

  return (
    <LegalAiSessionContext.Provider value={value}>{children}</LegalAiSessionContext.Provider>
  );
}

export function useLegalAiSession() {
  const ctx = useContext(LegalAiSessionContext);
  if (!ctx) {
    throw new Error("useLegalAiSession richiede LegalAiSessionProvider");
  }
  return ctx;
}
