"use server";

import { revalidatePath } from "next/cache";
import { requireWritableUser } from "@/lib/guard";
import { markAnnouncementRead } from "@/lib/avvisi/credixaAnnouncements";

export async function marcaAvvisoLettoAction(formData: FormData) {
  const user = await requireWritableUser();
  if (user.role !== "ADMIN") throw new Error("Solo l'admin può gestire gli avvisi");
  const announcementId = String(formData.get("announcementId") || "").trim();
  if (!announcementId) throw new Error("Avviso non valido");

  await markAnnouncementRead({
    announcementId,
    tenantId: user.tenantId,
    userId: user.id,
  });
  revalidatePath("/avvisi");
}
