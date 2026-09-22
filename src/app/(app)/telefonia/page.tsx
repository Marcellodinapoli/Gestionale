import { requireNavPage } from "@/lib/guard";
import {
  CounterPathSoftphoneProvider,
  DefaultTelProvider,
  TelephonyRegistry,
  getTenantTelephonyConfig,
} from "@/lib/telephony";
import { TelefoniaDashboard } from "@/components/telefonia/TelefoniaDashboard";

function ensureProvidersRegistered() {
  if (!TelephonyRegistry.get("counterpath-softphone")) {
    TelephonyRegistry.register(
      "counterpath-softphone",
      new CounterPathSoftphoneProvider()
    );
  }
  if (!TelephonyRegistry.get("default-tel")) {
    TelephonyRegistry.register("default-tel", new DefaultTelProvider());
  }
}

export default async function TelefoniaPage() {
  const user = await requireNavPage("telefonia");
  const cfg = await getTenantTelephonyConfig(user.tenantId, user.tenantSlug);
  ensureProvidersRegistered();

  const activeKey =
    cfg.provider === "default-tel" ? "default-tel" : "counterpath-softphone";
  const provider = TelephonyRegistry.get(activeKey);
  if (provider) {
    await provider.initialize({
      softphoneProtocol: cfg.softphoneProtocol,
      sipDomain: cfg.sipDomain,
    });
    TelephonyRegistry.setActive(activeKey);
  }

  return (
    <TelefoniaDashboard
      providerAttivo={TelephonyRegistry.active()?.name ?? null}
      providerCapabilities={TelephonyRegistry.active()?.capabilities ?? null}
      providerDisponibili={TelephonyRegistry.list()}
      tenantConfig={cfg}
    />
  );
}
