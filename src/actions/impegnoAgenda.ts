"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritableUser } from "@/lib/guard";

function fail(message: string): never {
  throw new Error(message);
}

export async function salvaImpegnoLiberoAction(formData: FormData) {
  const user = await requireWritableUser();
  const titolo = String(formData.get("titolo") || "").trim();
  const nota = String(formData.get("nota") || "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();
  if (!titolo) fail("Inserisci un titolo per l'impegno");
  if (!scheduledAtRaw) fail("Seleziona data e ora");
  const memoAt = new Date(scheduledAtRaw);
  if (Number.isNaN(memoAt.getTime())) fail("Data/ora non valida");

  const impegno = await prisma.impegnoAgenda.create({
    data: {
      userId: user.id,
      titolo,
      nota: nota || null,
      memoAt,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "impegno_agenda",
    entity: "impegno",
    entityId: impegno.id,
    dettaglio: titolo,
  });
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function completaImpegnoLiberoAction(formData: FormData) {
  const user = await requireWritableUser();
  const id = String(formData.get("impegnoId") || "");
  const impegno = await prisma.impegnoAgenda.findUnique({ where: { id } });
  if (!impegno || impegno.userId !== user.id) fail("Impegno non trovato");
  if (impegno.completato) return;

  await prisma.impegnoAgenda.update({
    where: { id },
    data: { completato: true, completatoAt: new Date() },
  });
  await writeAudit({
    userId: user.id,
    action: "impegno_completo",
    entity: "impegno",
    entityId: id,
    dettaglio: impegno.titolo,
  });
  revalidatePath("/agenda");
  revalidatePath("/");
}
