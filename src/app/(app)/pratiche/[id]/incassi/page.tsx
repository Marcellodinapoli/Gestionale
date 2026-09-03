import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser, idsAffidoTemporaneoForTenant, idsImportoTotaleForTenant, idsTotIncassatoForTenant, type PraticaDbContext } from "@/lib/praticheRepo";
import { requireModule, requireUser } from "@/lib/guard";
import { can } from "@/lib/permissions";
import {
  canAccessPratica,
  datetimeLocalValue,
  dateInputValue,
} from "@/lib/domain";
import { getPraticaWorkContext } from "@/lib/praticaLock";
import { IncassiPreview } from "@/components/pratica/IncassiPreview";
import { PraticaContabileShell } from "@/components/pratica/PraticaContabileShell";
import { IncassoForm } from "@/components/pratica/IncassoForm";

export default async function IncassiRegistratiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  await requireModule("incassi");
  const user = await requireUser();
  const praticaModel = praticaDbFromUser(user);
  const { id } = await params;
  const { embed } = await searchParams;
  if (!(await canAccessPratica(user, id))) notFound();

  const [pratica, work] = await Promise.all([
    praticaModel.findUnique({
      where: { id },
      include: {
        debitore: true,
        incassi: { include: { user: true }, orderBy: { data: "desc" } },
      },
    }),
    getPraticaWorkContext(user, id),
  ]);
  if (!pratica) notFound();
  const { canWork } = work;
  const canEdit = canWork && can(user, "incassi:create");

  return (
    <div className="h-full min-h-0">
      <PraticaContabileShell
        praticaId={pratica.id}
        numero={pratica.numero}
        debitore={`${pratica.debitore.cognome} ${pratica.debitore.nome}`.trim()}
        attivo="incassi"
        embed={embed === "1"}
        canEditNotes
        esitoContatto={pratica.esitoContatto}
        tipoContatto={pratica.tipoContatto}
        memoAt={datetimeLocalValue(pratica.memoAt)}
        promessaAt={pratica.promessaAt ? dateInputValue(pratica.promessaAt) : ""}
      >
        <IncassiPreview incassi={pratica.incassi} />

        {canEdit ? (
          <IncassoForm praticaId={pratica.id} />
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Solo back office e admin possono registrare gli incassi.
          </p>
        )}
      </PraticaContabileShell>
    </div>
  );
}
