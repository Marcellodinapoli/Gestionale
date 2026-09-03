import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { DialerSupervisorMonitor } from "@/components/predictive-dialer/DialerSupervisorMonitor";
import { DialerCampagnaRequeuePanel } from "@/components/predictive-dialer/DialerCampagnaRequeuePanel";
import {
  activateDialerCampagnaAction,
  deactivateDialerCampagnaAction,
} from "@/actions/predictiveDialer";
import { requirePermission } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { mapDialerCampagna } from "@/lib/predictive-dialer/mappers";
import { canManageDialerCampagna, parseCodiciScaricoJson } from "@/lib/predictive-dialer/scope";
import { loadCampagnaStats, loadMonitorOperatori } from "@/lib/predictive-dialer/stats";
import { DIALER_CAMPAGNA_LABELS } from "@/lib/predictive-dialer/constants";

export default async function PredictiveDialerCampagnaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("dialer:manage");
  const { id } = await params;
  const row = await prisma.dialerCampagna.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      operatori: { include: { operatore: { select: { name: true } } } },
      _count: { select: { pratiche: true, eventi: true } },
    },
  });
  if (!row || !canManageDialerCampagna(user, row)) {
    return <p className="text-sm text-red-700">Campagna non trovata o non autorizzato.</p>;
  }
  const campagna = mapDialerCampagna(row);
  const codici = parseCodiciScaricoJson(row.codiciScarico);
  const [initialStats, initialMonitor] = await Promise.all([
    loadCampagnaStats(user.tenantId, id),
    loadMonitorOperatori(id, row.pacingRatio),
  ]);

  async function activateAction() {
    "use server";
    await activateDialerCampagnaAction(id);
  }

  async function deactivateAction() {
    "use server";
    await deactivateDialerCampagnaAction(id);
  }

  return (
    <>
      <PageHeader
        title={campagna.nome}
        subtitle={`${DIALER_CAMPAGNA_LABELS[campagna.stato]} · ${row._count.pratiche} pratiche · pacing ${(campagna.pacingRatio ?? 1).toFixed(1)}`}
      />
      <div className="mb-4">
        <Link href="/predictive-dialer/campagne" className="text-sm underline">
          ← Campagne
        </Link>
      </div>

      <Card title="Dettaglio campagna">
        {campagna.descrizione ? <p className="mb-2 text-sm">{campagna.descrizione}</p> : null}
        {codici.length ? (
          <p className="mb-2 text-sm">
            Codici scarico: <span className="font-mono">{codici.join(", ")}</span>
          </p>
        ) : null}
        <p className="mb-3 text-sm">Post-call: {campagna.postCallSec}s</p>
        <div className="flex flex-wrap gap-2">
          {campagna.stato !== "ATTIVA" && campagna.stato !== "PAUSA" ? (
            <form action={activateAction}>
              <button
                type="submit"
                className="rounded border-2 border-emerald-700 px-3 py-1.5 text-sm font-bold text-emerald-800"
              >
                Attiva
              </button>
            </form>
          ) : (
            <form action={deactivateAction}>
              <button
                type="submit"
                className="rounded border-2 border-red-700 px-3 py-1.5 text-sm font-bold text-red-800"
              >
                Termina
              </button>
            </form>
          )}
        </div>
        <ul className="mt-4 text-sm">
          {row.operatori.map((o) => (
            <li key={o.id}>
              {o.operatore.name} — {o.sessioneStato}
              {o.accettatoAt ? " (accettato)" : " (in attesa)"}
            </li>
          ))}
        </ul>
      </Card>

      <DialerCampagnaRequeuePanel
        campagnaId={id}
        codiciCampagna={codici}
        campagnaStato={campagna.stato}
      />

      <DialerSupervisorMonitor
        campagnaId={id}
        initialStats={initialStats}
        initialMonitor={initialMonitor}
      />
    </>
  );
}
