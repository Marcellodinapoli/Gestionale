"use server";

import { revalidatePath } from "next/cache";
import { usersDbFromUser } from "@/lib/usersRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import { rotateUserPassword } from "@/lib/passwordPolicy";
import { ruoliCreabiliDa, type Role } from "@/lib/permissions";
import { annoNascitaDaCodiceFiscale, normalizeCf } from "@/lib/codiceFiscale";
import {
  assertCondizioneEconomica,
  parseCondizioneEconomica,
  parseImportoFisso,
} from "@/lib/condizioneEconomica";
import bcrypt from "bcryptjs";

function fail(message: string): never {
  throw new Error(message);
}

function parseAccesso(formData: FormData) {
  const raw = String(formData.get("accesso") || "completo").trim();
  return raw === "formazione";
}

function assertRuoloCreabile(creatorRole: Role, role: string) {
  const allowed = ruoliCreabiliDa(creatorRole);
  if (!allowed.includes(role as Role)) {
    fail("Ruolo non consentito per il tuo profilo");
  }
}

export async function updateAcronimoAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const acronimo = String(formData.get("acronimo") || "").trim().toUpperCase() || null;
  if (!targetId) fail("Utente mancante");

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  await userModel.update({
    where: { id: targetId },
    data: { acronimo },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `acronimo ${target.name}: ${acronimo || "rimosso"}`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function createOperatoreAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const name = String(formData.get("name") || "").trim();
  const cognome = String(formData.get("cognome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const acronimo = String(formData.get("acronimo") || "").trim().toUpperCase() || null;
  const codiceFiscaleRaw = String(formData.get("codiceFiscale") || "").trim();
  const codiceFiscale = normalizeCf(codiceFiscaleRaw) || null;
  const residenza = String(formData.get("residenza") || "").trim() || null;
  const annoNascitaRaw = String(formData.get("annoNascita") || "").trim();
  let annoNascita = annoNascitaRaw ? Number(annoNascitaRaw) : null;
  if (codiceFiscale) {
    const derived = annoNascitaDaCodiceFiscale(codiceFiscale);
    if (derived != null) annoNascita = derived;
  }
  const formazioneOnly = parseAccesso(formData);
  let role = String(formData.get("role") || "OPERATOR").trim();
  const supervisorId = String(formData.get("supervisorId") || "").trim() || null;
  const sedeId = String(formData.get("sedeId") || "").trim() || null;

  if (!name || !cognome || !email || !password) fail("Nome, cognome, email e password obbligatori");
  if (password.length < 6) fail("La password deve avere almeno 6 caratteri");
  if (!sedeId) fail("Sede obbligatoria");
  if (codiceFiscale && codiceFiscale.length !== 16) {
    fail("Codice fiscale non valido (16 caratteri)");
  }

  if (formazioneOnly) {
    role = "OPERATOR";
  }

  assertRuoloCreabile(user.role, role);

  const userModel = usersDbFromUser(user);
  const sedeModel = sediDbFromUser(user);

  const sede = await sedeModel.findFirst({
    where: { id: sedeId, tenantId: user.tenantId, active: true },
  });
  if (!sede) fail("Sede non valida");

  const exists = await userModel.findUnique({
    where: { tenantId_email: { tenantId: user.tenantId, email } },
  });
  if (exists) fail("Email già in uso in questa azienda");

  if (supervisorId) {
    const sup = await userModel.findFirst({
      where: { id: supervisorId, tenantId: user.tenantId, role: "SUPERVISOR" },
    });
    if (!sup) fail("Supervisor non valido");
  }

  const condizioneEconomica = formazioneOnly ? "SOLO_PROVV" : parseCondizioneEconomica(formData.get("condizioneEconomica"));
  const importoFisso =
    !formazioneOnly && role === "OPERATOR" && condizioneEconomica === "FISSO_PROVV"
      ? parseImportoFisso(formData.get("importoFisso"))
      : null;
  if (!formazioneOnly && role === "OPERATOR") {
    assertCondizioneEconomica(condizioneEconomica, importoFisso);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await userModel.create({
    data: {
      tenantId: user.tenantId,
      name,
      cognome,
      codiceFiscale,
      annoNascita,
      residenza,
      email,
      passwordHash,
      passwordChangedAt: new Date(),
      role,
      acronimo,
      supervisorId,
      sedeId,
      formazioneOnly,
      condizioneEconomica,
      importoFisso,
    },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "create",
    entity: "user",
    dettaglio: `creato ${name} ${cognome} (${role}${formazioneOnly ? ", solo formazione" : ""})`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function updateFormazioneOnlyAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const formazioneOnly = parseAccesso(formData);
  if (!targetId) fail("Utente mancante");

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");
  if (["ADMIN", "AMMINISTRAZIONE"].includes(target.role)) {
    fail("Non puoi limitare l'accesso a questo ruolo");
  }

  await userModel.update({
    where: { id: targetId },
    data: { formazioneOnly },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `accesso ${target.name}: ${formazioneOnly ? "solo formazione" : "completo"}`,
  });
  revalidatePath("/operatori");
}

export async function deleteOperatoreAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  if (!targetId) fail("Utente mancante");

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");
  if (target.id === user.id) fail("Non puoi eliminare te stesso");

  await userModel.update({
    where: { id: targetId },
    data: { active: false },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "delete",
    entity: "user",
    entityId: targetId,
    dettaglio: `disattivato ${target.name} (${target.role})`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function updateRuoloAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const role = String(formData.get("role") || "").trim();
  if (!targetId || !role) fail("Dati mancanti");

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");
  assertRuoloCreabile(user.role, role);
  if (role === "ADMIN" && user.role !== "ADMIN") {
    fail("Solo l'admin azienda può assegnare il ruolo Admin");
  }

  await userModel.update({
    where: { id: targetId },
    data: {
      role,
      ...(role === "ADMIN" || role === "AMMINISTRAZIONE"
        ? { formazioneOnly: false }
        : {}),
    },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `ruolo ${target.name}: ${target.role} → ${role}`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
}

export async function resetPasswordAmministrazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
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
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `reset password di ${target.name}`,
  });
}

export async function updateSedeUtenteAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const sedeId = String(formData.get("sedeId") || "").trim() || null;
  if (!targetId) fail("Utente mancante");

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  if (sedeId) {
    const sede = await sediDbFromUser(user).findFirst({
      where: { id: sedeId, tenantId: user.tenantId },
    });
    if (!sede) fail("Sede non valida");
  } else if (target.role === "AMMINISTRAZIONE") {
    fail("L'amministrazione deve avere una sede di appartenenza");
  }

  await userModel.update({
    where: { id: targetId },
    data: { sedeId },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `sede ${target.name}: ${sedeId || "nessuna"}`,
  });
  revalidatePath("/operatori");
}

export async function updateOperatoreAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const targetId = String(formData.get("userId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const cognome = String(formData.get("cognome") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const acronimo = String(formData.get("acronimo") || "").trim().toUpperCase() || null;
  const sedeId = String(formData.get("sedeId") || "").trim() || null;
  const supervisorId = String(formData.get("supervisorId") || "").trim() || null;
  const codiceFiscaleRaw = String(formData.get("codiceFiscale") || "").trim();
  const codiceFiscale = normalizeCf(codiceFiscaleRaw) || null;
  const residenza = String(formData.get("residenza") || "").trim() || null;
  const annoNascitaRaw = String(formData.get("annoNascita") || "").trim();
  let annoNascita = annoNascitaRaw ? Number(annoNascitaRaw) : null;
  if (codiceFiscale) {
    const derived = annoNascitaDaCodiceFiscale(codiceFiscale);
    if (derived != null) annoNascita = derived;
  }

  if (!targetId) fail("Utente mancante");
  if (!name || !cognome || !email) fail("Nome, cognome e email obbligatori");
  if (!sedeId) fail("Sede obbligatoria");
  if (codiceFiscale && codiceFiscale.length !== 16) {
    fail("Codice fiscale non valido (16 caratteri)");
  }

  const userModel = usersDbFromUser(user);
  const target = await userModel.findFirst({
    where: { id: targetId, tenantId: user.tenantId },
  });
  if (!target) fail("Utente non trovato");

  const dup = await userModel.findUnique({
    where: { tenantId_email: { tenantId: user.tenantId, email } },
  });
  if (dup && dup.id !== targetId) fail("Email già in uso in questa azienda");

  const sede = await sediDbFromUser(user).findFirst({
    where: { id: sedeId, tenantId: user.tenantId, active: true },
  });
  if (!sede) fail("Sede non valida");

  let condizioneEconomica = parseCondizioneEconomica(target.condizioneEconomica);
  let importoFisso =
    target.importoFisso != null ? Number(target.importoFisso) : null;

  if (target.role === "OPERATOR" && !target.formazioneOnly) {
    condizioneEconomica = parseCondizioneEconomica(formData.get("condizioneEconomica"));
    importoFisso =
      condizioneEconomica === "FISSO_PROVV"
        ? parseImportoFisso(formData.get("importoFisso"))
        : null;
    assertCondizioneEconomica(condizioneEconomica, importoFisso);
  } else {
    condizioneEconomica = "SOLO_PROVV";
    importoFisso = null;
  }

  if (supervisorId) {
    const sup = await userModel.findFirst({
      where: { id: supervisorId, tenantId: user.tenantId, role: "SUPERVISOR" },
    });
    if (!sup) fail("Supervisor non valido");
  }

  const data: Record<string, unknown> = {
    name,
    cognome,
    email,
    acronimo,
    sedeId,
    codiceFiscale,
    annoNascita,
    residenza,
    condizioneEconomica,
    importoFisso,
  };

  if (target.role === "OPERATOR" && !target.formazioneOnly) {
    data.supervisorId = supervisorId;
  }

  await userModel.update({
    where: { id: targetId },
    data,
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "user",
    entityId: targetId,
    dettaglio: `modificato ${name} ${cognome}`,
  });
  revalidatePath("/operatori");
  revalidatePath("/utenti");
  revalidatePath("/provigioni");
}
