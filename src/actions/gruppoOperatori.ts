"use server";

import { revalidatePath } from "next/cache";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { writeAudit } from "@/lib/domain";
import { requireWritableUser } from "@/lib/guard";
import { rotateUserPassword } from "@/lib/passwordPolicy";
import { parseGruppoMandanti, serializeGruppoMandanti } from "@/lib/gruppoMandanti";
import { parsePerimetriList } from "@/lib/mandantePerimetri";
import { messaggioErroreGruppoMandanti } from "@/lib/gruppoMandantiUi";
import { resolveGruppoSupervisorTarget } from "@/lib/gruppoEditor/resolveGruppoSupervisorTarget";

function fail(message: string): never {
  throw new Error(message);
}

async function requireSupervisor() {
  const user = await requireWritableUser();
  if (user.role !== "SUPERVISOR") fail("Solo il supervisor può modificare il gruppo");
  return user;
}

function revalidateGruppo() {
  revalidatePath("/affidi");
  revalidatePath("/statistiche");
  revalidatePath("/pratiche");
  revalidatePath("/provigioni");
  revalidatePath("/");
}

export async function addOperatoreAlGruppoAction(formData: FormData) {
  const user = await requireSupervisor();
  const supervisorId = await resolveGruppoSupervisorTarget(
    user,
    String(formData.get("gruppoSupervisorId") || "")
  );
  const operatoreId = String(formData.get("operatoreId") || "");
  const userModel = usersDbFromUser(user);
  const op = await userModel.findUnique({ where: { id: operatoreId } });
  if (!op || op.role !== "OPERATOR" || !op.active || op.tenantId !== user.tenantId) {
    fail("Seleziona un operatore");
  }
  await userModel.update({
    where: { id: operatoreId },
    data: { supervisorId },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "gruppo",
    entityId: operatoreId,
    dettaglio: `aggiunto ${op.name}`,
  });
  revalidateGruppo();
}

export async function removeOperatoreDalGruppoAction(formData: FormData) {
  const user = await requireSupervisor();
  const supervisorId = await resolveGruppoSupervisorTarget(
    user,
    String(formData.get("gruppoSupervisorId") || "")
  );
  const operatoreId = String(formData.get("operatoreId") || "");
  const userModel = usersDbFromUser(user);
  const op = await userModel.findUnique({ where: { id: operatoreId } });
  if (!op || op.supervisorId !== supervisorId || op.tenantId !== user.tenantId) {
    fail("Operatore non presente nel gruppo");
  }
  await userModel.update({
    where: { id: operatoreId },
    data: { supervisorId: null },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "gruppo",
    entityId: operatoreId,
    dettaglio: `rimosso ${op.name}`,
  });
  revalidateGruppo();
}

export async function updateGruppoNomeAction(formData: FormData) {
  const user = await requireSupervisor();
  const supervisorId = await resolveGruppoSupervisorTarget(
    user,
    String(formData.get("gruppoSupervisorId") || "")
  );
  const userModel = usersDbFromUser(user);
  const nome = String(formData.get("gruppoNome") || "").trim() || null;
  await userModel.update({
    where: { id: supervisorId },
    data: { gruppoNome: nome },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "gruppo",
    entityId: supervisorId,
    dettaglio: `nome gruppo: ${nome || "—"}`,
  });
  revalidateGruppo();
}

export async function updateGruppoMandantiAction(formData: FormData) {
  const user = await requireSupervisor();
  const supervisorId = await resolveGruppoSupervisorTarget(
    user,
    String(formData.get("gruppoSupervisorId") || "")
  );
  const userModel = usersDbFromUser(user);
  const raw = String(formData.get("gruppoMandanti") || "").trim();
  let parsed: ReturnType<typeof parseGruppoMandanti> = [];
  if (raw) {
    try {
      const json = JSON.parse(raw);
      parsed = parseGruppoMandanti(JSON.stringify(json));
    } catch {
      fail("Formato mandanti non valido");
    }
  }

  const errMandanti = messaggioErroreGruppoMandanti(parsed);
  if (errMandanti) fail(errMandanti);

  const mandanteIds = [...new Set(parsed.map((a) => a.mandanteId))];
  const mandantiRows = await mandantiDbFromUser(user).findMany({
    where: { tenantId: user.tenantId, id: { in: mandanteIds } },
    select: { id: true, perimetri: true },
  });
  if (mandantiRows.length !== mandanteIds.length) fail("Una o più mandanti non sono valide");

  for (const a of parsed) {
    const row = mandantiRows.find((m) => m.id === a.mandanteId);
    const perimetri = parsePerimetriList(row?.perimetri ?? null);
    const validIds = new Set(perimetri.map((p) => p.id));
    for (const pid of a.perimetriIds) {
      if (!validIds.has(pid)) fail("Perimetro non valido per la mandante selezionata");
    }
  }

  await userModel.update({
    where: { id: supervisorId },
    data: { gruppoMandanti: serializeGruppoMandanti(parsed) },
  });

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "gruppo",
    entityId: supervisorId,
    dettaglio: `mandanti gruppo: ${mandanteIds.length}`,
  });
  revalidateGruppo();
}

export async function resetPasswordAction(formData: FormData) {
  const user = await requireSupervisor();
  const targetId = String(formData.get("userId") || "").trim();
  const newPassword = String(formData.get("newPassword") || "").trim();
  if (!targetId || !newPassword) fail("Dati mancanti");
  if (newPassword.length < 6) fail("La password deve avere almeno 6 caratteri");

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  await rotateUserPassword(targetId, newPassword);
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `reset password di ${target.name}`,
  });
}
