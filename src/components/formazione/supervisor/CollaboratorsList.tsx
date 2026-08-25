"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { formatFormazioneDateTime } from "@/lib/formazione/collaboratorProgress";

type CollaboratorRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  firebaseUid: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
};

function StatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
        active ? "bg-emerald-600" : "bg-slate-400"
      }`}
    >
      {active ? "Attivo" : "Non attivo"}
    </span>
  );
}

export function CollaboratorsList() {
  const [rows, setRows] = useState<CollaboratorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/formazione/collaboratori");
        const data = (await res.json()) as {
          collaboratori?: CollaboratorRow[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Errore caricamento");
        if (!cancelled) setRows(data.collaboratori ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore caricamento");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">Caricamento…</p>;
  }

  if (error) {
    return <p className="py-10 text-center text-sm text-[var(--danger)]">{error}</p>;
  }

  if (!rows.length) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted)]">
        Nessun operatore nel tuo gruppo.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article
          key={row.id}
          className="rounded-2xl border border-[var(--line)] bg-[#FAFAFA] p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Users className="mt-0.5 h-7 w-7 shrink-0 text-[var(--muted)]" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-[var(--navy)]">{row.name}</h3>
                  <StatusChip active={row.active} />
                </div>
                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="grid grid-cols-[8.5rem_1fr] gap-2">
                    <dt className="font-semibold text-[var(--navy)]">Email</dt>
                    <dd className="text-[var(--muted)]">{row.email}</dd>
                  </div>
                  <div className="grid grid-cols-[8.5rem_1fr] gap-2">
                    <dt className="font-semibold text-[var(--navy)]">Registrato il</dt>
                    <dd className="text-[var(--muted)]">
                      {row.createdAt
                        ? formatFormazioneDateTime(new Date(row.createdAt))
                        : "—"}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[8.5rem_1fr] gap-2">
                    <dt className="font-semibold text-[var(--navy)]">Ultimo login</dt>
                    <dd className="text-[var(--muted)]">
                      {row.lastLoginAt
                        ? formatFormazioneDateTime(new Date(row.lastLoginAt))
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {row.firebaseUid ? (
                <Link
                  href={`/formazione/collaboratori/${row.firebaseUid}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy)] hover:bg-slate-50"
                >
                  Apri dettagli
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  Nessun account CreditForm collegato
                </span>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
