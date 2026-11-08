"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { canStartRedazione, runMockLegalSearch } from "@/lib/legal-ai/draftPipeline";
import { useLegalAiSession } from "@/components/legal-ai/LegalAiSessionProvider";

export function LegalAiRicercaPanel() {
  const { session, setSearchQuery, setSearchResults, hydrated } = useLegalAiSession();
  const [busy, setBusy] = useState(false);

  if (!hydrated) {
    return <p className="text-sm text-muted-foreground">Caricamento sessione…</p>;
  }

  if (!canStartRedazione(session)) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Completa{" "}
        <Link href="/legal-ai/nuovo-atto" className="font-medium underline">
          Nuovo atto
        </Link>{" "}
        prima della ricerca.
      </p>
    );
  }

  function onSearch() {
    setBusy(true);
    try {
      setSearchResults(runMockLegalSearch(session.searchQuery, session.actTypeId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold text-[var(--navy)]">
        Ricerca normativa e giurisprudenziale
      </h2>
      <p className="text-sm text-muted-foreground">
        Interfaccia pronta per il provider esterno; l&apos;esecuzione attuale produce esiti
        segnaposto in sessione.
      </p>
      <label className="block text-sm font-medium text-[var(--navy)]">
        Query di ricerca
        <input
          type="search"
          value={session.searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Es. art. 2043 c.c. risarcimento danno"
          className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </label>
      <button
        type="button"
        disabled={busy || !session.searchQuery.trim()}
        onClick={onSearch}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 disabled:opacity-50"
      >
        <Search className="h-4 w-4" aria-hidden />
        {busy ? "Ricerca…" : "Esegui ricerca"}
      </button>
      {session.searchResults.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Nessun risultato in sessione. Esegui una ricerca o prosegui in Revisione.
        </div>
      ) : (
        <ul className="space-y-3">
          {session.searchResults.map((hit) => (
            <li
              key={hit.id}
              className="rounded-md border border-border bg-muted/10 px-4 py-3 text-sm"
            >
              <p className="font-medium text-[var(--navy)]">{hit.title}</p>
              <p className="mt-1 text-muted-foreground">{hit.excerpt}</p>
              <p className="mt-2 text-xs text-violet-800">{hit.reference}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
