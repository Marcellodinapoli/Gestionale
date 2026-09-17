import {
  CANALE_CONTATTO_LABELS,
  ESITO_CONTATTO_LABELS,
  TIPO_ATTIVITA_LABELS,
  etichettaCambioStato,
  type RecruitingAttivitaRecord,
} from "@/lib/recruiting/attivita";
import { ESITO_COLLOQUIO_LABELS, isEsitoColloquio } from "@/lib/recruiting/colloqui";

function esitoLabel(attivita: RecruitingAttivitaRecord): string | null {
  if (!attivita.esito) return null;
  if (attivita.tipo === "CONTATTO" && attivita.esito in ESITO_CONTATTO_LABELS) {
    return ESITO_CONTATTO_LABELS[attivita.esito as keyof typeof ESITO_CONTATTO_LABELS];
  }
  if (attivita.tipo === "COLLOQUIO_ESITO" && isEsitoColloquio(attivita.esito)) {
    return ESITO_COLLOQUIO_LABELS[attivita.esito];
  }
  return attivita.esito;
}

export function CandidaturaTimeline({ attivita }: { attivita: RecruitingAttivitaRecord[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-[var(--navy)]">Timeline</h2>
      {attivita.length === 0 ? (
        <p className="rounded-xl border border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
          Nessun evento registrato.
        </p>
      ) : (
        <ol className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-4">
          {attivita.map((a) => {
            const testo =
              a.tipo === "CAMBIO_STATO"
                ? etichettaCambioStato(a.statoDa, a.statoA)
                : a.tipo === "RICEZIONE"
                  ? "Candidatura ricevuta"
                  : a.note.trim() || null;
            const extra = [
              a.tipo === "CONTATTO" && a.canale ? CANALE_CONTATTO_LABELS[a.canale] : null,
              esitoLabel(a),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={a.id} className="border-b border-[var(--line)] pb-2 last:border-0 last:pb-0">
                <p className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                  {TIPO_ATTIVITA_LABELS[a.tipo]}
                </p>
                {testo ? <p className="text-sm">{testo}</p> : null}
                <p className="text-xs text-[var(--muted)]">
                  {a.occurredAt.toLocaleString("it-IT")} · {a.createdByName}
                  {extra ? ` · ${extra}` : ""}
                </p>
                {a.colloquioId ? (
                  <a href={`#colloquio-${a.colloquioId}`} className="text-xs font-semibold underline">
                    Apri colloquio
                  </a>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
