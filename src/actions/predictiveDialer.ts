"use server";

import { revalidatePath } from "next/cache";
import { requireWritablePermission, requirePermission } from "@/lib/guard";
import { writeAudit } from "@/lib/domain";
import {
  activateCampagnaRecord,
  attachOperatoriToCampagna,
  attachPraticheToCampagna,
  createCampagnaRecord,
  deactivateCampagnaRecord,
  reintegrateCodiciScaricoInCampagna,
} from "@/lib/predictive-dialer/campaigns";
import { registerDialerCallEvent } from "@/lib/predictive-dialer/callEvents";
import {
  acceptCampagnaSession,
  exitDialerSession,
  finishPostCallManual,
  pauseDialerSession,
  resumeDialerSession,
} from "@/lib/predictive-dialer/operatorSession";
import { prisma } from "@/lib/prisma";
import { canManageDialerCampagna } from "@/lib/predictive-dialer/scope";
import { getPredictiveDialerService } from "@/lib/predictive-dialer/service/factory";
import {
  DIALER_CONFIG_API_BASE,
  DIALER_CONFIG_CATEGORIA,
  DIALER_CONFIG_PROVIDER,
  DIALER_CONFIG_WEBHOOK_SECRET,
} from "@/lib/predictive-dialer/constants";

import { normalizePacingRatio } from "@/lib/predictive-dialer/pacing";
import { providerSupportsSetPacing } from "@/lib/predictive-dialer/dialerSync";

function fail(msg: string): never {
  throw new Error(msg);
}

async function assertManageCampagna(user: Awaited<ReturnType<typeof requireWritablePermission>>, campagnaId: string) {
  const c = await prisma.dialerCampagna.findFirst({ where: { id: campagnaId, tenantId: user.tenantId } });
  if (!c) fail("Campagna non trovata");
  if (!canManageDialerCampagna(user, c)) fail("Non autorizzato");
  return c;
}

export async function createDialerCampagnaAction(formData: FormData) {
  const user = await requireWritablePermission("dialer:manage");
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) fail("Nome campagna obbligatorio");
  let codici = formData.getAll("codiciScarico").map(String).filter(Boolean);
  if (!codici.length) {
    const raw = String(formData.get("codiciScarico") || "");
    codici = raw
      .split(/[,;\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  }
  const postCallSec = Number(formData.get("postCallSec") || 60);
  const pacingRatio = normalizePacingRatio(formData.get("pacingRatio") || 1);
  const operatoreIds = String(formData.get("operatoreIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const campagna = await createCampagnaRecord(user, {
    nome,
    descrizione: String(formData.get("descrizione") || ""),
    codiciScarico: codici,
    postCallSec: Number.isFinite(postCallSec) ? postCallSec : 60,
    pacingRatio,
    operatoreIds,
  });

  await writeAudit({
    userId: user.id,
    action: "create",
    entity: "dialer_campagna",
    entityId: campagna.id,
    dettaglio: nome,
  });
  revalidatePath("/predictive-dialer");
  return campagna.id;
}

export async function activateDialerCampagnaAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:manage");
  await assertManageCampagna(user, campagnaId);
  await activateCampagnaRecord(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function deactivateDialerCampagnaAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:manage");
  await assertManageCampagna(user, campagnaId);
  await deactivateCampagnaRecord(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function updateDialerPacingAction(campagnaId: string, pacingRatio: number) {
  const user = await requireWritablePermission("dialer:manage");
  const c = await assertManageCampagna(user, campagnaId);
  const ratio = normalizePacingRatio(pacingRatio);
  await prisma.dialerCampagna.update({
    where: { id: campagnaId },
    data: { pacingRatio: ratio },
  });
  if (c.externalId) {
    const service = await getPredictiveDialerService(user.tenantId);
    if (providerSupportsSetPacing(service.providerId) && service.setPacing) {
      await service.setPacing(c.externalId, ratio);
    }
  }
  revalidatePath("/predictive-dialer");
}

export async function acceptDialerCampagnaAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:operate");
  await acceptCampagnaSession(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function pauseDialerAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:operate");
  await pauseDialerSession(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function resumeDialerAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:operate");
  await resumeDialerSession(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function exitDialerAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:operate");
  await exitDialerSession(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function finishPostCallAction(campagnaId: string) {
  const user = await requireWritablePermission("dialer:operate");
  await finishPostCallManual(user, campagnaId);
  revalidatePath("/predictive-dialer");
}

export async function registerDialerEventAction(input: {
  campagnaId: string;
  tipo: string;
  praticaId?: string;
  numero?: string;
  esito?: string;
  durataSec?: number;
  callId?: string;
  externalCallId?: string;
  providerEventId?: string;
}) {
  const user = await requireWritablePermission("dialer:operate");
  return registerDialerCallEvent(user, {
    campagnaId: input.campagnaId,
    operatoreId: user.id,
    praticaId: input.praticaId,
    numero: input.numero,
    tipo: input.tipo as "iniziata",
    esito: input.esito,
    durataSec: input.durataSec,
    callId: input.callId,
    externalCallId: input.externalCallId,
    providerEventId: input.providerEventId,
    affidaSeCollegata: input.tipo === "collegata",
  });
}

export async function saveDialerIntegrationConfigAction(formData: FormData) {
  const user = await requireWritablePermission("dialer:admin");
  const entries = [
    { chiave: DIALER_CONFIG_PROVIDER, valore: String(formData.get("provider") || "null") },
    { chiave: DIALER_CONFIG_API_BASE, valore: String(formData.get("apiBaseUrl") || "") },
    { chiave: DIALER_CONFIG_WEBHOOK_SECRET, valore: String(formData.get("webhookSecret") || "") },
  ];
  for (const e of entries) {
    await prisma.configurazioneSistema.upsert({
      where: { tenantId_chiave: { tenantId: user.tenantId, chiave: e.chiave } },
      create: { tenantId: user.tenantId, chiave: e.chiave, valore: e.valore, categoria: DIALER_CONFIG_CATEGORIA },
      update: { valore: e.valore, categoria: DIALER_CONFIG_CATEGORIA },
    });
  }
  revalidatePath("/predictive-dialer/admin");
}

export async function loadDialerCampagnaDetailAction(campagnaId: string) {
  const user = await requirePermission("dialer:manage");
  const campagna = await prisma.dialerCampagna.findFirst({
    where: { id: campagnaId, tenantId: user.tenantId },
    include: {
      operatori: { include: { operatore: { select: { id: true, name: true } } } },
      _count: { select: { pratiche: true, eventi: true } },
    },
  });
  if (!campagna) fail("Campagna non trovata");
  return campagna;
}

export async function addPraticheToCampagnaAction(campagnaId: string, praticaIds: string[]) {
  const user = await requireWritablePermission("dialer:manage");
  await assertManageCampagna(user, campagnaId);
  const n = await attachPraticheToCampagna(user, campagnaId, { praticaIds });
  revalidatePath("/predictive-dialer");
  return n;
}

export async function addOperatoriToCampagnaAction(campagnaId: string, operatoreIds: string[]) {
  const user = await requireWritablePermission("dialer:manage");
  await assertManageCampagna(user, campagnaId);
  const n = await attachOperatoriToCampagna(user, campagnaId, operatoreIds);
  revalidatePath("/predictive-dialer");
  return n;
}

export async function reintegrateCodiciScaricoAction(
  campagnaId: string,
  input: { codiciScarico: string[]; statiCoda?: string[]; includiNuove?: boolean }
) {
  const user = await requireWritablePermission("dialer:manage");
  await assertManageCampagna(user, campagnaId);
  const result = await reintegrateCodiciScaricoInCampagna(user, campagnaId, input);
  revalidatePath("/predictive-dialer");
  revalidatePath(`/predictive-dialer/campagne/${campagnaId}`);
  return result;
}
