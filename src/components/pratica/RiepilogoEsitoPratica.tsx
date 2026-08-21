import { esitoContattoLabel, tipoContattoLabel } from "@/lib/contatto";
import { dataIt } from "@/lib/domain";

function formatMemoAt(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function RiepilogoEsitoPratica({
  esitoContatto,
  tipoContatto,
  memoAt,
  promessaAt,
}: {
  esitoContatto?: string | null;
  tipoContatto?: string | null;
  memoAt?: string | null;
  promessaAt?: string | null;
}) {
  const parts: string[] = [];
  parts.push(`Esito: ${esitoContattoLabel(esitoContatto)}`);
  if (tipoContatto) parts.push(`Tipo: ${tipoContattoLabel(tipoContatto)}`);
  const memo = formatMemoAt(memoAt);
  if (memo) parts.push(`Memo: ${memo}`);
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
