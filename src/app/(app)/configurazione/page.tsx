import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { ConfigurazioneEditor } from "@/components/configurazione/ConfigurazioneEditor";
import { SECRET_CONFIG_KEYS } from "@/lib/configSecrets";
import { writeAudit } from "@/lib/domain";

export default async function ConfigurazionePage() {
  const user = await requirePermission("users:manage");

  const purged = await prisma.configurazioneSistema.deleteMany({
    where: {
      tenantId: user.tenantId,
      chiave: { in: [...SECRET_CONFIG_KEYS] },
    },
  });

  if (purged.count > 0) {
    await writeAudit({
      userId: user.id,
      tenantId: user.tenantId,
      action: "update",
      entity: "configurazione",
      dettaglio: `rimossi automaticamente ${purged.count} parametri secret all'apertura configurazione`,
    });
  }

  const rows = await prisma.configurazioneSistema.findMany({
    where: { tenantId: user.tenantId },
  });
  const config: Record<string, string> = {};
  for (const r of rows) {
    config[r.chiave] = r.valore;
  }

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Configurazione sistema"
        subtitle="Solo parametri operativi — password e chiavi restano fuori dal gestionale"
      />
      <ConfigurazioneEditor config={config} secretsPurged={purged.count} />
    </div>
  );
}
