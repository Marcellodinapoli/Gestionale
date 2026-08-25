import { CODICE_SCARICO_LABELS, codiceScaricoPratica } from "@/lib/scarico";
import { dataIt } from "@/lib/domainFormat";

function formatDataOra(value?: string | Date | null) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : null;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function RiepilogoEsitoPratica({
  stato,
  codiceScarico,
  codiceScaricoAt,
  promessaAt,
}: {
  stato?: string | null;
  codiceScarico?: string | null;
  /** Data/ora impostazione o modifica del codice scarico (non il richiamo agenda). */
  codiceScaricoAt?: string | Date | null;
  promessaAt?: string | null;
}) {
  const codice = codiceScaricoPratica(stato || "", codiceScarico);
  const parts: string[] = [];
  const quando = formatDataOra(codiceScaricoAt);
  parts.push(
    codice
      ? `Cod. scarico: ${codice} — ${CODICE_SCARICO_LABELS[codice]}${
          quando ? ` · ${quando}` : ""
        }`
      : "Cod. scarico: —"
  );
  if (promessaAt) parts.push(`Promessa: ${dataIt(promessaAt)}`);

  return (
    <span
      className="inline-flex h-7 max-w-full shrink-0 items-center rounded border border-[#7eb8c4] bg-[#e8f4f8] px-2 text-[11px] font-medium text-[#1a4a55] sm:whitespace-nowrap"
      title={parts.join(" · ")}
    >
      {parts.join(" · ")}
    </span>
  );
}
