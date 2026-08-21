import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/guard";
import {
  canAccessPratica,
  datetimeLocalValue,
  dateInputValue,
} from "@/lib/domain";
import { EstrattoContoPreview } from "@/components/pratica/EstrattoContoPreview";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";

export default async function EstrattoContoPage({
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
      mandante: true,
      fatture: { orderBy: { dataScadenza: "asc" } },
      incassi: { orderBy: { data: "asc" } },
    },
  });
  if (!pratica) notFound();

  const d = pratica.debitore;
  const affidato = pratica.capitale + pratica.interessi + pratica.spese;

  return (
    <div className="h-full min-h-0">
      <PraticaContabileShell
        praticaId={pratica.id}
        numero={pratica.numero}
        debitore={`${d.cognome} ${d.nome}`.trim()}
        attivo="estratto"
        embed={embed === "1"}
        canEditNotes
        esitoContatto={pratica.esitoContatto}
        tipoContatto={pratica.tipoContatto}
        memoAt={datetimeLocalValue(pratica.memoAt)}
        promessaAt={pratica.promessaAt ? dateInputValue(pratica.promessaAt) : ""}
      >
        <EstrattoContoPreview
          debitore={d}
          numero={pratica.numero}
          creditore={pratica.mandante.ragioneSociale}
          societa={pratica.mandante.codice}
          scadenza={pratica.scadenza}
          fatture={pratica.fatture}
          incassi={pratica.incassi}
          affidato={affidato}
          definito={pratica.residuo}
        />
      </PraticaContabileShell>
    </div>
  );
}
