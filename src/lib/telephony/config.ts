import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  parseTenantTelephonyConfig,
  toDialClientConfig,
  type DialClientConfig,
  type TenantTelephonyConfig,
} from "@/lib/telephony/clientConfig";

export {
  normalizeVoipProvider,
  normalizeSoftphoneProtocol,
  parseTenantTelephonyConfig,
  toDialClientConfig,
  type SoftphoneProtocol,
  type VoipProviderKey,
  type TenantTelephonyConfig,
  type DialClientConfig,
} from "@/lib/telephony/clientConfig";

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
