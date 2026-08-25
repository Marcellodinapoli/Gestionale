import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  normalizeRecordingMode,
  type RecordingMode,
} from "@/lib/recordingMode";

export type { RecordingMode } from "@/lib/recordingMode";
export { normalizeRecordingMode } from "@/lib/recordingMode";

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
