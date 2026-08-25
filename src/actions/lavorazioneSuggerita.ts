"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireWritableUser } from "@/lib/guard";
import { writeAudit } from "@/lib/domain";
import {
  loadLavorazioneStore,
  upsertPiano,
  removePiano,
  saveLavorazioneStore,
  type VoceLavorazioneSuggerita,
} from "@/lib/lavorazioneSuggerita";
import { sanitizeAltriFiltri } from "@/lib/praticheAltriFiltri";
import { formatDataIso, parseDataIso } from "@/lib/lavorateOggi";
import { isCodiceScarico } from "@/lib/scarico";

function fail(message: string): never {
  throw new Error(message);
}

async function resolveSupervisorId(
  user: Awaited<ReturnType<typeof requireWritableUser>>,
  raw: string
) {
  const supervisorId = raw.trim() || user.id;
  if (user.role === "SUPERVISOR") {
    if (supervisorId !== user.id) fail("Non autorizzato");
    return user.id;
  }
  if (user.role !== "ADMIN") fail("Non autorizzato");
  const sup = await prisma.user.findFirst({
    where: { id: supervisorId, tenantId: user.tenantId, role: "SUPERVISOR" },
    select: { id: true },
  });
  if (!sup) fail("Supervisor non trovato");
  return sup.id;
}

function parseVociPayload(raw: string): VoceLavorazioneSuggerita[] {
  let arr: unknown;
  try {
    arr = JSON.parse(raw);
  } catch {
    fail("Formato non valido");
  }
  if (!Array.isArray(arr)) fail("Formato non valido");
  return arr.map((item, i) => {
    if (!item || typeof item !== "object") fail(`Voce ${i + 1} non valida`);
    const o = item as Record<string, unknown>;
    const cod = String(o.codiceScarico || "").trim();
    const lavorateDa = String(o.lavorateDa || "").trim();
    const lavorateA = String(o.lavorateA || lavorateDa).trim();
    return {
      id: String(o.id || "").trim() || `lav-${Date.now()}-${i}`,
      descrizione: String(o.descrizione || "").trim(),
      codiceScarico: isCodiceScarico(cod) ? cod : "",
      filtri: sanitizeAltriFiltri(o.filtri ?? migrateLegacyFiltri(o)),
      lavorateDa,
      lavorateA,
      note: String(o.note || "").trim(),
      noteAggiuntive: String(o.noteAggiuntive || "").trim(),
      contestoPerimetro:
        o.contestoPerimetro === "affido" || o.contestoPerimetro === "lavorazione"
          ? o.contestoPerimetro
          : undefined,
    };
  });
}

function migrateLegacyFiltri(o: Record<string, unknown>) {
  const legacy: Record<string, string> = {};
  const dataLavDa = String(o.dataLavDa || o.dataLavorazione || "").trim();
  const dataLavA = String(o.dataLavA || o.dataLavorazione || dataLavDa).trim();
  const promPagDa = String(o.promPagDa || "").trim();
  const promPagA = String(o.promPagA || "").trim();
  if (dataLavDa) legacy.affidoDa = dataLavDa;
  if (dataLavA) legacy.affidoA = dataLavA;
  if (promPagDa) legacy.promPagDa = promPagDa;
  if (promPagA) legacy.promPagA = promPagA;
  return legacy;
}

export async function saveLavorazioneSuggeritaAction(formData: FormData) {
  const user = await requireWritableUser();
  const supervisorId = await resolveSupervisorId(user, String(formData.get("supervisorId") || ""));
  const dataPiano =
    String(formData.get("dataPiano") || "").trim() || formatDataIso(new Date());
  const voci = parseVociPayload(String(formData.get("voci") || "[]"));

  const { store } = await loadLavorazioneStore(supervisorId, user.tenantId);
  const next = upsertPiano(store, dataPiano, voci, { salvatoAt: new Date().toISOString() });
  await saveLavorazioneStore(supervisorId, next);

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "lavorazione_suggerita",
    entityId: supervisorId,
    dettaglio: `Piano ${dataPiano} · ${voci.length} voci`,
  });

  revalidatePath("/lavorazione");
}

export async function deleteLavorazionePianoAction(formData: FormData) {
  const user = await requireWritableUser();
  const supervisorId = await resolveSupervisorId(user, String(formData.get("supervisorId") || ""));
  const dataPiano = String(formData.get("dataPiano") || "").trim();
  if (!parseDataIso(dataPiano)) fail("Data piano non valida");

  const { store } = await loadLavorazioneStore(supervisorId, user.tenantId);
  const next = removePiano(store, dataPiano);
  await saveLavorazioneStore(supervisorId, next);

  await writeAudit({
    userId: user.id,
    action: "delete",
    entity: "lavorazione_suggerita",
    entityId: supervisorId,
    dettaglio: `Piano ${dataPiano} eliminato`,
  });

  revalidatePath("/lavorazione");
}
