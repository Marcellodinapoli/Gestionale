import {
  POSTAZIONE_SCHEDA_CAMPI,
  valorePostazioneScheda,
  type PostazioneSchedaView,
} from "@/lib/postazioniSchedaFields";

export function PostazioneSchedaRiepilogo({
  dettaglio,
  titolo = "Dati configurati sulla postazione",
  compact,
  internoPersonale,
}: {
  dettaglio: PostazioneSchedaView | null | undefined;
  titolo?: string;
  compact?: boolean;
  /** Interno utente (centralino) se diverso da quello della postazione. */
  internoPersonale?: string | null;
}) {
  if (!dettaglio) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--line)] bg-[#f8fafc] px-3 py-2 text-xs text-[var(--muted)]">
        Nessuna postazione selezionata.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {titolo ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {titolo}
        </p>
      ) : null}
      <div
        className={`grid gap-2 ${
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {POSTAZIONE_SCHEDA_CAMPI.map((c) => {
          const val = valorePostazioneScheda(dettaglio, c.key);
          const raw = dettaglio[c.key];
          const title =
            c.key === "note" && raw != null && String(raw).trim().length > 0
              ? String(raw).trim()
              : undefined;
          return (
            <div
              key={c.key}
              className="rounded-lg border border-[var(--line)] bg-[#fafbfc] px-3 py-2"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                {c.label}
              </p>
              <p
                title={title}
                className={`mt-0.5 break-words text-[var(--navy)] ${
                  c.key === "note"
                    ? "line-clamp-3 cursor-help text-xs leading-snug"
                    : "text-sm font-medium"
                } ${
                  c.key === "interno" ||
                  c.key === "numeroFisso" ||
                  c.key === "numeroFax" ||
                  c.key === "numeroWhatsapp"
                    ? "font-mono"
                    : ""
                }`}
              >
                {val}
              </p>
            </div>
          );
        })}
      </div>
      {internoPersonale ? (
        <p className="text-xs text-[var(--muted)]">
          Interno personale (card Centralino):{" "}
          <span className="font-mono font-medium text-[var(--navy)]">{internoPersonale}</span>
        </p>
      ) : null}
    </div>
  );
}
