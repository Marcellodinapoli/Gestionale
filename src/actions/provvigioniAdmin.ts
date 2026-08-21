"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";

function fail(message: string): never {
  throw new Error(message);
}

export async function liquidaProvvigioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const id = String(formData.get("id") || "").trim();
  const stato = String(formData.get("stato") || "LIQUIDATA").trim();
  if (!id) fail("ID mancante");

  await prisma.provvigione.update({
    where: { id },
    data: { stato },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "provvigione",
    entityId: id,
    dettaglio: `stato → ${stato}`,
  });
  revalidatePath("/provigioni");
}

export async function liquidaMassivaAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const idsRaw = String(formData.get("ids") || "").trim();
  if (!idsRaw) fail("Nessuna provvigione selezionata");
  const ids = JSON.parse(idsRaw) as string[];
  if (!ids.length) fail("Nessuna provvigione selezionata");

  await prisma.provvigione.updateMany({
    where: { id: { in: ids }, stato: "MATURATA" },
    data: { stato: "LIQUIDATA" },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "provvigione",
    dettaglio: `liquidazione massiva di ${ids.length} provvigioni`,
  });
  revalidatePath("/provigioni");
}

export async function updateImportoProvvigioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const id = String(formData.get("id") || "").trim();
  const importoRaw = String(formData.get("importo") || "").trim();
  const percentualeRaw = String(formData.get("percentuale") || "").trim();
  if (!id) fail("ID mancante");

  const data: Record<string, number> = {};
  if (importoRaw) data.importo = parseFloat(importoRaw.replace(",", "."));
  if (percentualeRaw) data.percentuale = parseFloat(percentualeRaw.replace(",", "."));
  if (!Object.keys(data).length) fail("Nessun dato da aggiornare");

  await prisma.provvigione.update({ where: { id }, data });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "provvigione",
    entityId: id,
    dettaglio: `importo: ${importoRaw || "—"}, %: ${percentualeRaw || "—"}`,
  });
  revalidatePath("/provigioni");
}
