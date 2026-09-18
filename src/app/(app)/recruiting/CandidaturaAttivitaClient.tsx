"use client";

import {
  CANALE_CONTATTO_LABELS,
  ESITO_CONTATTO_LABELS,
  type CanaleContatto,
  type EsitoContatto,
} from "@/lib/recruiting/attivita";

type VoceContattoNota = {
  id: string;
  tipo: "CONTATTO" | "NOTA";
  occurredAt: string;
  note: string;
  esito: string | null;
  canale: CanaleContatto | null;
  createdByName: string;
  sezione: string;
};

export function CandidaturaAttivitaClient({
  voci,
}: {
  candidaturaId: string;
  canManage: boolean;
  voci: VoceContattoNota[];
}) {
  const elenco = [...voci].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Contatti e note</h2>
      {elenco.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
          Nessun contatto o nota.
        </p>
      ) : (
        <ul className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-4">
          {elenco.map((v) => {
            const extra =
              v.tipo === "CONTATTO"
                ? [
                    v.canale ? CANALE_CONTATTO_LABELS[v.canale] : null,
                    v.esito && v.esito in ESITO_CONTATTO_LABELS
                      ? ESITO_CONTATTO_LABELS[v.esito as EsitoContatto]
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "";
            return (
              <li
                key={v.id}
                className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"
              >
                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  {v.tipo === "NOTA" ? "Nota" : "Contatto"}
                </p>
                {v.note.trim() ? <p className="text-sm">{v.note.trim()}</p> : null}
                <p className="text-xs text-[var(--muted)]">
                  {new Date(v.occurredAt).toLocaleString("it-IT")} · {v.sezione} · {v.createdByName}
                  {extra ? ` · ${extra}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
