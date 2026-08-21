import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Protocollo click-to-call verso softphone CounterPath / SIP sul PC operatore. */
export type SoftphoneProtocol = "callto" | "sip" | "tel" | "c2c";

export type VoipProviderKey = "counterpath" | "default-tel" | "altro";

export type TenantTelephonyConfig = {
  provider: VoipProviderKey;
  softphoneProtocol: SoftphoneProtocol;
  sipDomain: string;
  pbxHost: string;
  pbxPort: string;
  proxy: string;
  callerId: string;
  vpnObbligatoria: boolean;
  vpnHost: string;
  vpnTipo: string;
  vpnNote: string;
  note: string;
  configured: boolean;
};

const PROVIDER_KEYS = new Set<VoipProviderKey>(["counterpath", "default-tel", "altro"]);
const PROTOCOL_KEYS = new Set<SoftphoneProtocol>(["callto", "sip", "tel", "c2c"]);

export function normalizeVoipProvider(value?: string | null): VoipProviderKey {
  const v = (value || "").trim().toLowerCase();
  if (PROVIDER_KEYS.has(v as VoipProviderKey)) return v as VoipProviderKey;
  if (v.includes("counter") || v.includes("bria") || v.includes("x-lite")) return "counterpath";
  if (v === "tel" || v === "default") return "default-tel";
  return v ? "altro" : "counterpath";
}

export function normalizeSoftphoneProtocol(value?: string | null): SoftphoneProtocol {
  const v = (value || "").trim().toLowerCase();
  if (PROTOCOL_KEYS.has(v as SoftphoneProtocol)) return v as SoftphoneProtocol;
  return "callto";
}

export function parseTenantTelephonyConfig(
  map: Record<string, string>
): TenantTelephonyConfig {
  const provider = normalizeVoipProvider(map.voip_provider);
  const softphoneProtocol = normalizeSoftphoneProtocol(map.voip_softphone_protocol);
  const pbxHost = (map.voip_host || "").trim();
  const sipDomain = (map.voip_sip_domain || pbxHost || "").trim();
  const vpnObbligatoria =
    (map.voip_vpn_obbligatoria || "").trim().toLowerCase() !== "false";

  const configured = Boolean(
    map.voip_provider ||
      map.voip_host ||
      map.voip_sip_domain ||
      map.voip_softphone_protocol
  );

  return {
    provider,
    softphoneProtocol,
    sipDomain,
    pbxHost,
    pbxPort: (map.voip_porta || "").trim(),
    proxy: (map.voip_proxy || "").trim(),
    callerId: (map.voip_caller_id || "").trim(),
    vpnObbligatoria,
    vpnHost: (map.voip_vpn_host || map.db_vpn_host || "").trim(),
    vpnTipo: (map.voip_vpn_tipo || map.db_vpn_tipo || "").trim(),
    vpnNote: (map.voip_vpn_note || "").trim(),
    note: (map.voip_note || "").trim(),
    configured,
  };
}

/** Config pubblica per click-to-call lato client (senza secret). */
export type DialClientConfig = {
  protocol: SoftphoneProtocol;
  sipDomain: string;
  provider: VoipProviderKey;
};

export function toDialClientConfig(cfg: TenantTelephonyConfig): DialClientConfig {
  return {
    protocol: cfg.softphoneProtocol,
    sipDomain: cfg.sipDomain,
    provider: cfg.provider,
  };
}

export async function getTenantTelephonyConfig(
  tenantId?: string
): Promise<TenantTelephonyConfig> {
  let tid = tenantId;
  if (!tid) {
    const user = await getCurrentUser();
    tid = user?.tenantId;
  }
  if (!tid) {
    return parseTenantTelephonyConfig({});
  }

  const rows = await prisma.configurazioneSistema.findMany({
    where: {
      tenantId: tid,
      OR: [
        { chiave: { startsWith: "voip_" } },
        { chiave: { in: ["db_vpn_host", "db_vpn_tipo"] } },
      ],
    },
    select: { chiave: true, valore: true },
  });

  const map: Record<string, string> = {};
  for (const r of rows) map[r.chiave] = r.valore;
  return parseTenantTelephonyConfig(map);
}

export async function getDialClientConfig(
  tenantId?: string
): Promise<DialClientConfig> {
  return toDialClientConfig(await getTenantTelephonyConfig(tenantId));
}
