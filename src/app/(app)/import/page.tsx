import { requirePermission } from "@/lib/guard";
import { PageHeader, Card } from "@/components/ui";
import { ImportPanels } from "@/components/ImportPanels";
import { ImportBatchList } from "@/components/ImportBatchList";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { prisma } from "@/lib/prisma";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { isManutenzione } from "@/lib/permissions";
import { listImportBatchPratiche } from "@/actions/importBatch";

export default async function ImportPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("import:run");
  const sp = (await searchParams) ?? {};
  const integraId = typeof sp.integra === "string" ? sp.integra : "";

  const mandantiRaw = isManutenzione(user)
    ? []
    : await mandantiDbFromUser(user).findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: {
          id: true,
          codice: true,
          ragioneSociale: true,
          perimetri: true,
        },
      });

  const mandanti = mandantiRaw.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetriList(m.perimetri),
  }));

  const importBatches = isManutenzione(user)
    ? []
    : await listImportBatchPratiche(user.tenantId, user.tenantSlug ?? user.tenantId);

  const lottiEsistenti = importBatches.map((b) => ({
    id: b.id,
    mandanteId: b.mandanteId,
    perimetro: b.perimetro,
    lotto: b.lotto,
    affidoIl: b.affidoIl,
    scadenzaMandato: b.scadenzaMandato,
    nPratiche: b.nPratiche,
  }));

  const integraBatch = integraId
    ? importBatches.find((b) => b.id === integraId)
    : null;
  const prefill = integraBatch
    ? {
        mandanteId: integraBatch.mandanteId,
        perimetro: integraBatch.perimetro,
        lotto: integraBatch.lotto,
        affidoIl: integraBatch.affidoIl,
        scadenzaMandato: integraBatch.scadenzaMandato,
      }
    : null;

  return (
    <div className="grid max-w-5xl gap-4">
      <PageHeader
        title="Import CSV"
        subtitle="Carichi massivi di pratiche e incassi (back office)"
      />
      <ImportPanels
        mandanti={mandanti}
        lottiEsistenti={lottiEsistenti}
        prefill={prefill}
        integraId={integraId}
      />
      <Card title="Import effettuati">
        <ImportBatchList items={importBatches} />
      </Card>
    </div>
  );
}
