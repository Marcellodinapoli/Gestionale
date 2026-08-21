"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import { assertPraticaLockHeld } from "@/lib/praticaLock";

export async function confermaRegistrazioneTelefonataAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:work");

  const praticaId = String(formData.get("praticaId") || "").trim();
  const numero = String(formData.get("numero") || "").trim();
  const evidenzaBackOffice = String(formData.get("evidenzaBackOffice") || "") === "1";
  const mode = String(formData.get("mode") || "manual").trim() || "manual";

  if (!praticaId) {
    throw new Error("Pratica mancante");
  }

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { id: true, numero: true },
  });
  if (!pratica) {
    throw new Error("Pratica non trovata");
  }

  await assertPraticaLockHeld(user.id, praticaId);

  await prisma.registrazioneChiamata.create({
    data: {
      praticaId,
      operatoreId: user.id,
      numero: numero || "numero-non-specificato",
      direzione: "uscita",
      stato: mode === "continuous" ? "CONFERMATA_CONTINUA" : "CONFERMATA_MANUALE",
      esito: null,
      durataSec: 0,
      fileName: "",
      evidenzaBackOffice,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "conferma_registrazione",
    entity: "registrazione",
    entityId: praticaId,
    dettaglio: `${pratica.numero}${evidenzaBackOffice ? " · evidenza BO" : ""}`,
  });

  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/report");
}
