import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { canAccessPratica, dataIt, datetimeLocalValue, dateInputValue, importoIt } from "@/lib/domain";
import { getPraticaWorkContext } from "@/lib/praticaLock";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";
import { addFatturaAction } from "@/actions/core";

export default async function FattureInsolutePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { embed } = await searchParams;
  if (!(await canAccessPratica(user, id))) notFound();

  const pratica = await prisma.pratica.findUnique({
    where: { id },
    include: {
      debitore: true,
      fatture: { orderBy: { dataFattura: "asc" } },
    },
  });
  if (!pratica) notFound();

  const { canWork } = await getPraticaWorkContext(user.id, id);
  const canEdit = canWork && can(user, "incassi:create");
  const totImp = pratica.fatture.reduce((s, f) => s + f.importo, 0);
  const totPag = pratica.fatture.reduce((s, f) => s + f.pagato, 0);
  const totSaldo = totImp - totPag;
  const oggi = new Date();
  const scaduto = pratica.fatture.reduce((s, f) => {
    const saldo = f.importo - f.pagato;
    return s + (saldo > 0 && f.dataScadenza < oggi ? saldo : 0);
  }, 0);

  return (
    <div className="h-full min-h-0">
    <PraticaContabileShell
      praticaId={pratica.id}
      numero={pratica.numero}
      debitore={`${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim()}
      attivo="fatture"
      embed={embed === "1"}
      canEditNotes
      esitoContatto={pratica.esitoContatto}
      tipoContatto={pratica.tipoContatto}
      memoAt={datetimeLocalValue(pratica.memoAt)}
      promessaAt={pratica.promessaAt ? dateInputValue(pratica.promessaAt) : ""}
    >
      <p className="mb-2 font-mono text-xs text-[#132033]">Fatture insolute</p>
      <div className="overflow-x-auto font-mono text-[13px] leading-6 text-[#132033]">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-y border-[#132033] text-left">
              <th className="py-0.5 pr-3">Num.Fatt.</th>
              <th className="py-0.5 pr-3">Per./Causale</th>
              <th className="py-0.5 pr-3">Data Fat.</th>
              <th className="py-0.5 pr-3">Data Scad.</th>
              <th className="py-0.5 pr-3 text-right">Importo</th>
              <th className="py-0.5 pr-3 text-right">Pagato</th>
              <th className="py-0.5 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {pratica.fatture.map((f) => (
              <tr key={f.id}>
                <td className="pr-3">{f.numero}</td>
                <td className="pr-3">{f.causale || "—"}</td>
                <td className="pr-3">{dataIt(f.dataFattura)}</td>
                <td className="pr-3">{dataIt(f.dataScadenza)}</td>
                <td className="pr-3 text-right">{importoIt(f.importo)}</td>
                <td className="pr-3 text-right">{importoIt(f.pagato)}</td>
                <td className="text-right">{importoIt(f.importo - f.pagato)}</td>
              </tr>
            ))}
            {!pratica.fatture.length ? (
              <tr>
                <td colSpan={7} className="py-3 text-[var(--muted)]">
                  Nessuna fattura caricata.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t border-[#132033] font-semibold">
              <td colSpan={4}>Totali</td>
              <td className="pr-3 text-right">{importoIt(totImp)}</td>
              <td className="pr-3 text-right">{importoIt(totPag)}</td>
              <td className="text-right">{importoIt(totSaldo)}</td>
            </tr>
          </tfoot>
        </table>
        {scaduto > 0 ? (
          <p className="mt-1 text-right">-- Scaduto {importoIt(scaduto)}</p>
        ) : null}
      </div>

      {canEdit ? (
        <form action={addFatturaAction} className="mt-4 grid gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-6">
          <input type="hidden" name="praticaId" value={pratica.id} />
          <input name="numero" required placeholder="Num. fattura" className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
          <input name="causale" placeholder="Causale" className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
          <input type="date" name="dataFattura" required className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
          <input type="date" name="dataScadenza" required className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
          <input name="importo" type="number" step="0.01" required placeholder="Importo" className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
          <input name="pagato" type="number" step="0.01" defaultValue={0} placeholder="Pagato" className="h-9 rounded border border-[var(--line)] px-2 text-sm" />
          <button className="h-9 rounded bg-[#132033] px-3 text-sm text-white sm:col-span-6">
            Aggiungi fattura
          </button>
        </form>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Solo back office e admin possono caricare le fatture.
        </p>
      )}
    </PraticaContabileShell>
    </div>
  );
}
