import Link from "next/link";
import { euro } from "@/lib/domain";
import { labelStatoAvvio, labelMotivo } from "@/lib/giudiziale/avvioGiudiziale";
import type { LegalElencoRow } from "@/lib/giudiziale/praticaGiudizialeRepo";

export function GiudizialeElencoTable({
  items,
  emptyMessage,
  primaryHref,
  primaryLabel,
}: {
  items: LegalElencoRow[];
  emptyMessage: string;
  primaryHref: (praticaId: string) => string;
  primaryLabel: string;
}) {
  if (!items.length) {
    return (
      <p className="rounded-lg border border-[var(--line)] bg-[#eef4f8] px-3 py-4 text-sm text-[var(--muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#dce4ec] text-[11px] uppercase text-[var(--muted)]">
          <tr>
            <th className="px-3 py-2 font-semibold">Pratica</th>
            <th className="px-3 py-2 font-semibold">Debitore</th>
            <th className="px-3 py-2 font-semibold">Mandante</th>
            <th className="px-3 py-2 font-semibold">Residuo</th>
            <th className="px-3 py-2 font-semibold">Stato legale</th>
            <th className="px-3 py-2 font-semibold">Motivo</th>
            <th className="px-3 py-2 font-semibold">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.praticaId} className="border-t border-[var(--line)] bg-white">
              <td className="px-3 py-2 font-mono font-semibold text-[var(--navy)]">
                {row.praticaNumero}
              </td>
              <td className="px-3 py-2">{row.debitoreNome}</td>
              <td className="px-3 py-2">{row.mandanteCodice}</td>
              <td className="px-3 py-2 tabular-nums">{euro(row.residuo)}</td>
              <td className="px-3 py-2">
                {row.statoAvvio ? labelStatoAvvio(row.statoAvvio) : "Non avviato"}
              </td>
              <td className="px-3 py-2">
                {row.motivoPassaggio ? labelMotivo(row.motivoPassaggio) : "—"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={primaryHref(row.praticaId)}
                    className="inline-flex h-7 items-center rounded border-2 border-[var(--navy)] bg-[var(--navy)] px-2 text-xs font-bold text-white hover:opacity-90"
                  >
                    {primaryLabel}
                  </Link>
                  <Link
                    href={`/pratiche/${row.praticaId}`}
                    className="inline-flex h-7 items-center rounded border border-[#7d94a8] bg-white px-2 text-xs font-semibold text-[var(--navy)] hover:bg-[#eef4f8]"
                  >
                    Pratica
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
