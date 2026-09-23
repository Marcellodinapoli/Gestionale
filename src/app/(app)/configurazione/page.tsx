import { configurazioneDbFromUser } from "@/lib/configurazioneRepo";
import { requireNavPage } from "@/lib/guard";
import { PageHeader } from "@/components/ui";
import { ConfigurazioneEditor } from "@/components/configurazione/ConfigurazioneEditor";
import { TenantModulesEditor } from "@/components/configurazione/TenantModulesEditor";
import { SECRET_CONFIG_KEYS } from "@/lib/configSecrets";
import { writeAudit } from "@/lib/domain";
import { getTenantPlatformConfig } from "@/lib/platform/tenantProfile";

export default async function ConfigurazionePage() {
  const user = await requireNavPage("configurazione");

  const configModel = configurazioneDbFromUser(user);

  const purged = await configModel.deleteMany({
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

  const rows = await configModel.findMany({
    where: { tenantId: user.tenantId },
  });
  const config: Record<string, string> = {};
  for (const r of rows) {
    config[r.chiave] = r.valore;
  }
  const platform = await getTenantPlatformConfig(user.tenantId, user.tenantSlug);

  return (
    <div className="space-y-4 pb-8">
      <PageHeader
        title="Configurazione sistema"
        subtitle="Solo parametri operativi — password e chiavi restano fuori dal gestionale"
      />
      <TenantModulesEditor enabledModules={platform.enabledModules} />
      <ConfigurazioneEditor config={config} secretsPurged={purged.count} />
    </div>
  );
}
