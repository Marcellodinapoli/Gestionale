import { configurazioneDbForTenant } from "@/lib/configurazioneRepo";
import { getCurrentUser } from "@/lib/auth";
import { resolveTenantSlugForConnector } from "@/lib/tenant";
import {
  normalizeRecordingMode,
  type RecordingMode,
} from "@/lib/recordingMode";

export type { RecordingMode } from "@/lib/recordingMode";
export { normalizeRecordingMode } from "@/lib/recordingMode";

export async function getRecordingMode(
  tenantId?: string,
  tenantSlug?: string | null
): Promise<RecordingMode> {
  const user = await getCurrentUser();
  const tid = tenantId ?? user?.tenantId;
  if (!tid) return "manual";

  const slug = await resolveTenantSlugForConnector(tid, tenantSlug ?? user?.tenantSlug);

  const row = await configurazioneDbForTenant(tid, slug).findUnique({
    where: {
      tenantId_chiave: { tenantId: tid, chiave: "voip_recording_mode" },
    },
    select: { valore: true },
  });
  return normalizeRecordingMode(row?.valore);
}
