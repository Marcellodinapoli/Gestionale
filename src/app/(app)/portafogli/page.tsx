import Link from "next/link";
import { requireNavPage } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { euro, dataIt } from "@/lib/domain";
import { Card, PageHeader } from "@/components/ui";
import { listPortafogli } from "@/lib/portafogli/repo";
import {
  PORTAFOGLIO_STATO_LABELS,
  PORTAFOGLIO_TIPO_LABELS,
} from "@/lib/portafogli/types";

export default async function PortafogliPage() {
  const user = await requireNavPage("portafogli");
  const rows = await listPortafogli(user);
  const canManage = can(user, "portafogli:manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portafogli"
        subtitle="Acquisto e gestione book UTP/NPL di questa azienda"
        action={
          canManage ? (
            <Link
              href="/portafogli/nuovo"
              className="flex h-9 items-center rounded-lg bg-[var(--navy)] px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Nuovo portafoglio
            </Link>
          ) : null
        }
      />
      <Card>
        {rows.length === 0 ? (
          <div className="py-6">
            <p className="text-sm text-[var(--ink)]">Nessun portafoglio in questa azienda.</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Crea un book (valutazione o acquisto). Le pratiche si agganciano dopo, dalla scheda.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="py-2">Nome</th>
                <th>Tipo</th>
                <th>Stato</th>
                <th>Venditore</th>
                <th className="text-right">Prezzo</th>
                <th className="text-right">Incassato</th>
                <th className="text-right">Pratiche</th>
                <th>Cut-off</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--line)] hover:bg-[#eef4f8]">
                  <td className="py-2 font-medium">
                    <Link href={`/portafogli/${r.id}`} className="text-[var(--accent)] underline">
                      {r.nome}
                    </Link>
                    {r.codice ? (
                      <div className="text-xs text-[var(--muted)]">{r.codice}</div>
                    ) : null}
                  </td>
                  <td>{PORTAFOGLIO_TIPO_LABELS[r.tipo]}</td>
                  <td>{PORTAFOGLIO_STATO_LABELS[r.stato]}</td>
                  <td>{r.venditore || "—"}</td>
                  <td className="text-right tabular-nums">
                    {r.prezzoPagato != null ? euro(r.prezzoPagato) : "—"}
                  </td>
                  <td className="text-right tabular-nums">{euro(r.incassato)}</td>
                  <td className="text-right tabular-nums">{r.nPratiche}</td>
                  <td>{r.dataCutoff ? dataIt(r.dataCutoff) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
