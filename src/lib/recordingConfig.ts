import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type RecordingMode = "continuous" | "manual";

export function normalizeRecordingMode(value?: string | null): RecordingMode {
  return value === "continuous" ? "continuous" : "manual";
}

export async function getRecordingMode(tenantId?: string): Promise<RecordingMode> {
  let tid = tenantId;
  if (!tid) {
    const user = await getCurrentUser();
    tid = user?.tenantId;
  }
  if (!tid) return "manual";

  const row = await prisma.configurazioneSistema.findUnique({
    where: {
      tenantId_chiave: { tenantId: tid, chiave: "voip_recording_mode" },
    },
    select: { valore: true },
  });
  return normalizeRecordingMode(row?.valore);
}
