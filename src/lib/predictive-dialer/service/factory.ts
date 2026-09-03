import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DIALER_CONFIG_API_BASE,
  DIALER_CONFIG_CATEGORIA,
  DIALER_CONFIG_PROVIDER,
} from "@/lib/predictive-dialer/constants";
import { NullPredictiveDialerAdapter } from "@/lib/predictive-dialer/service/NullPredictiveDialerAdapter";
import type { PredictiveDialerService } from "@/lib/predictive-dialer/service/PredictiveDialerService";

export async function getPredictiveDialerService(tenantId: string): Promise<PredictiveDialerService> {
  const rows = await prisma.configurazioneSistema.findMany({
    where: { tenantId, categoria: DIALER_CONFIG_CATEGORIA },
    select: { chiave: true, valore: true },
  });
  const map = Object.fromEntries(rows.map((r) => [r.chiave, r.valore]));
  const provider = map[DIALER_CONFIG_PROVIDER]?.trim() || "null";
  const _apiBase = map[DIALER_CONFIG_API_BASE]?.trim();

  switch (provider) {
    case "null":
    default:
      return new NullPredictiveDialerAdapter();
  }
}
