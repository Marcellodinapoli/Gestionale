"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireNavPage, requireWritablePermission } from "@/lib/guard";
import { parseDateOnly, writeAudit } from "@/lib/domain";
import {
  collegaImportAlPortafoglio,
  createPortafoglio,
  updatePortafoglio,
} from "@/lib/portafogli/repo";
import {
  isPortafoglioStato,
  isPortafoglioTipo,
  type PortafoglioWriteInput,
} from "@/lib/portafogli/types";

function fail(message: string): never {
  throw new Error(message);
}

function num(formData: FormData, key: string, required = false): number | null {
  const raw = String(formData.get(key) || "").trim().replace(",", ".");
  if (!raw) return required ? 0 : null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) fail(`Valore non valido: ${key}`);
  return n;
}

function readWriteInput(formData: FormData): PortafoglioWriteInput {
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) fail("Nome obbligatorio");
  const tipo = String(formData.get("tipo") || "NPL");
  const stato = String(formData.get("stato") || "IN_VALUTAZIONE");
  if (!isPortafoglioTipo(tipo)) fail("Tipo non valido");
  if (!isPortafoglioStato(stato)) fail("Stato non valido");
  const dataCutoffRaw = String(formData.get("dataCutoff") || "").trim();
  const dataAcquistoRaw = String(formData.get("dataAcquisto") || "").trim();
  return {
    nome,
    codice: String(formData.get("codice") || "").trim() || null,
    venditore: String(formData.get("venditore") || "").trim() || null,
    servicer: String(formData.get("servicer") || "").trim() || null,
    tipo,
    stato,
    dataCutoff: dataCutoffRaw ? parseDateOnly(dataCutoffRaw) : null,
    dataAcquisto: dataAcquistoRaw ? parseDateOnly(dataAcquistoRaw) : null,
    nominaleDichiarato: num(formData, "nominaleDichiarato", true) ?? 0,
    prezzoOfferto: num(formData, "prezzoOfferto"),
    prezzoPagato: num(formData, "prezzoPagato"),
    speseAcquisto: num(formData, "speseAcquisto", true) ?? 0,
    recuperoAtteso: num(formData, "recuperoAtteso"),
    note: String(formData.get("note") || "").trim() || null,
  };
}

export async function creaPortafoglioAction(formData: FormData) {
  const user = await requireWritablePermission("portafogli:manage");
  await requireNavPage("portafogli");
  const created = await createPortafoglio(user, readWriteInput(formData));
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "create",
    entity: "portafoglio",
    entityId: created.id,
    dettaglio: created.nome,
  });
  revalidatePath("/portafogli");
  redirect(`/portafogli/${created.id}`);
}

export async function aggiornaPortafoglioAction(formData: FormData) {
  const user = await requireWritablePermission("portafogli:manage");
  await requireNavPage("portafogli");
  const id = String(formData.get("id") || "").trim();
  if (!id) fail("Portafoglio mancante");
  const updated = await updatePortafoglio(user, id, readWriteInput(formData));
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "portafoglio",
    entityId: updated.id,
    dettaglio: updated.nome,
  });
  revalidatePath("/portafogli");
  revalidatePath(`/portafogli/${updated.id}`);
}

export async function collegaLottoPortafoglioAction(formData: FormData) {
  const user = await requireWritablePermission("portafogli:manage");
  await requireNavPage("portafogli");
  const portafoglioId = String(formData.get("portafoglioId") || "").trim();
  const importBatchId = String(formData.get("importBatchId") || "").trim();
  const n = await collegaImportAlPortafoglio(user, portafoglioId, importBatchId);
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "portafoglio",
    entityId: portafoglioId,
    dettaglio: `collegato lotto import ${importBatchId} (${n} pratiche)`,
  });
  revalidatePath(`/portafogli/${portafoglioId}`);
  revalidatePath("/portafogli");
}
