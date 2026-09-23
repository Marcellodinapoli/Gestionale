import Link from "next/link";
import type { AgendaGiudizialeVoce } from "@/lib/agenda/scadenzeGiudiziali";

function formatGiorno(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function LegalAgendaUpcoming({
  voci,
  title = "Prossimi impegni",
}: {
  voci: AgendaGiudizialeVoce[];
  title?: string;
}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = voci
    .filter((v) => new Date(v.memoAt).getTime() >= now.getTime())
    .slice(0, 6);

  return (
    <section className="rounded-xl border border-[var(--line)] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[#e8eef4] px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--navy)]">
          {title}
        </h2>
        <Link
          href="/legal/agenda"
          className="text-xs font-semibold text-[var(--accent)] underline"
        >
          Apri agenda
        </Link>
      </div>
      {upcoming.length ? (
        <ul className="divide-y divide-[var(--line)] text-sm">
          {upcoming.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a3412]">
                  {v.fase || "Legale"}
                </p>
                <Link
                  href={v.href || `/pratiche/${v.praticaId}/strategia-giudiziale`}
                  className="font-medium text-[#9a3412] underline"
                >
                  {v.activityLabel}
                </Link>
                <span className="text-[var(--navy)]">
                  {" "}
                  · {v.numero} · {`${v.debitore.cognome} ${v.debitore.nome}`.trim()}
                </span>
              </div>
              <p className="text-sm tabular-nums text-[#7c2d12]">
                {formatGiorno(v.memoAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-6 text-sm text-[var(--muted)]">
          Nessun impegno con data in programma. Le date di avvio, strategia ed esito
          e gli impegni inseriti nelle pagine Legal compaiono qui.
        </p>
      )}
    </section>
  );
}
