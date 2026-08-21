"use client";

import { useMemo, useState } from "react";
import { Search, Monitor, Phone, Mail, MapPin, CircleDot, PhoneCall } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

type RubricaUtente = {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  acronimo: string | null;
  online: boolean;
  postazione: {
    nome: string;
    interno: string | null;
    email: string | null;
    numeroFisso: string | null;
    sede: string | null;
  } | null;
};

function matchRubrica(u: RubricaUtente, q: string) {
  const haystack = [
    u.name,
    u.acronimo,
    u.roleLabel,
    u.postazione?.nome,
    u.postazione?.interno,
    u.postazione?.email,
    u.postazione?.numeroFisso,
    u.postazione?.sede,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function RubricaGriglia({ utenti }: { utenti: RubricaUtente[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtrati = useMemo(
    () => (q ? utenti.filter((u) => matchRubrica(u, q)) : utenti),
    [utenti, q]
  );

  return (
    <div className="space-y-3">
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome, interno, email, postazione…"
          className="h-10 w-full rounded-lg border border-[var(--line)] bg-white pl-9 pr-3 text-sm"
        />
      </label>

      {filtrati.length === 0 ? (
        <p className="rounded-lg border border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {utenti.length === 0
            ? "Nessun operatore attivo."
            : "Nessun risultato per la ricerca."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrati.map((u) => (
            <div
              key={u.id}
              className={`rounded-xl border p-3 ${
                u.online
                  ? "border-emerald-200 bg-white"
                  : "border-[var(--line)] bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex items-start gap-2">
                <CircleDot
                  className={`mt-0.5 h-3 w-3 shrink-0 ${
                    u.online ? "text-emerald-500" : "text-slate-300"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--navy)]">
                    {u.name}
                    {u.acronimo && (
                      <span className="ml-1.5 text-[10px] font-normal text-[var(--muted)]">
                        ({u.acronimo})
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">{u.roleLabel}</p>

                  {u.postazione ? (
                    <div className="mt-2 space-y-0.5 text-[11px]">
                      <p className="flex items-center gap-1 text-[var(--navy)]">
                        <Monitor className="h-3 w-3 text-[var(--muted)]" />
                        {u.postazione.nome}
                        {u.postazione.sede && (
                          <span className="ml-1 flex items-center gap-0.5 text-[var(--muted)]">
                            <MapPin className="h-2.5 w-2.5" />
                            {u.postazione.sede}
                          </span>
                        )}
                      </p>
                      {u.postazione.interno && (
                        <p className="flex items-center gap-1 font-mono font-semibold text-[var(--accent)]">
                          <Phone className="h-3 w-3" />
                          int. {u.postazione.interno}
                        </p>
                      )}
                      {u.postazione.numeroFisso && (
                        <p className="flex items-center gap-1 text-[var(--navy)]">
                          <PhoneCall className="h-3 w-3 text-[var(--muted)]" />
                          {u.postazione.numeroFisso}
                        </p>
                      )}
                      {u.postazione.email && (
                        <p className="flex items-center gap-1 text-[var(--muted)]">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{u.postazione.email}</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[10px] italic text-[var(--muted)]">
                      Non connesso
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {q && filtrati.length > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          {filtrati.length} di {utenti.length} contatti
        </p>
      ) : null}
    </div>
  );
}
