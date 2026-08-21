"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession, getCurrentUser } from "@/lib/auth";
import { assertCan, can, requiresPostazione, type Role } from "@/lib/permissions";
import {
  canAccessPratica,
  parseDateOnly,
  praticaWhere,
  ripartiIncasso,
  writeAudit,
} from "@/lib/domain";
import { syncMessaggioAgenda, markMessaggiLetti } from "@/lib/memoAgenda";
import { formatMessaggioCollegaNota } from "@/lib/noteFormat";
import { calcolaProvvigione, resolveProvvigionePercentuale } from "@/lib/provvigioni";
import { requireWritablePermission, requireWritableUser } from "@/lib/guard";
import { STATI_TELEFONO } from "@/lib/statoTelefono";
import { assertPraticaLockHeld, assertPraticaNotLockedByOther, releaseAllUserLocks } from "@/lib/praticaLock";
import { isPasswordExpired } from "@/lib/passwordPolicy";
import { normalizeTenantSlug } from "@/lib/tenant";
import { notificaSanzioneIncassoMassivo } from "@/lib/sanzioneIncassoMassivo";
import {
  giornoAffidoRange,
  parseImportContesto,
} from "@/lib/importContesto";

function fail(message: string): never {
  throw new Error(message);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  const slug = normalizeTenantSlug(String(formData.get("tenantSlug") || ""));
  if (!slug) return { error: "Inserisci il codice azienda" };

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !tenant.active) {
    return { error: "Azienda non trovata o non attiva" };
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user || !user.active) {
    return { error: "Credenziali non valide" };
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return { error: "Credenziali non valide" };
  await Promise.all([
    createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      supervisorId: user.supervisorId,
      tenantId: user.tenantId,
      tenantSlug: tenant.slug,
      tenantNome: tenant.nome,
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), postazioneId: null } }),
    writeAudit({
      userId: user.id,
      tenantId: user.tenantId,
      action: "login",
      entity: "user",
      entityId: user.id,
    }),
  ]);

  if (isPasswordExpired(user.passwordChangedAt)) {
    redirect("/cambia-password");
  }

  const needsPostazione = requiresPostazione({ role: user.role as Role });
  redirect(needsPostazione ? "/seleziona-postazione" : "/");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await releaseAllUserLocks(user.id);
  }
  await clearSession();
  if (user) {
    await Promise.all([
      prisma.user.update({ where: { id: user.id }, data: { lastLogoutAt: new Date() } }),
      writeAudit({ userId: user.id, action: "logout", entity: "user", entityId: user.id }),
    ]);
  }
  redirect("/login");
}

async function nextNumero(tenantId: string) {
  const last = await prisma.pratica.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { numero: true },
  });
  const year = new Date().getFullYear();
  const match = last?.numero?.match(/(\d+)$/);
  const n = match ? Number(match[1]) + 1 : 1;
  return `PRC-${year}-${String(n).padStart(4, "0")}`;
}

async function assertPraticaWork(user: Awaited<ReturnType<typeof requireWritableUser>>, praticaId: string) {
  if (!(await canAccessPratica(user, praticaId))) fail("Pratica non visibile");
  if (!can(user, "pratiche:work")) fail("Operazione non consentita");
  await assertPraticaLockHeld(user.id, praticaId);
}

async function assertPraticaEditable(
  user: Awaited<ReturnType<typeof requireWritableUser>>,
  praticaId: string
) {
  if (!(await canAccessPratica(user, praticaId))) fail("Pratica non visibile");
  await assertPraticaLockHeld(user.id, praticaId);
}

async function assertGaranteOnPratica(praticaId: string, garanteId: string) {
  const garante = await prisma.garante.findFirst({
    where: { id: garanteId, praticaId },
    select: { id: true },
  });
  if (!garante) fail("Garante non trovato");
  return garante;
}

export async function updateDebitoreContattiPrincipaliAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaWork(user, praticaId);

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const telefono = String(formData.get("telefono") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;

  await prisma.debitore.update({
    where: { id: pratica.debitoreId },
    data: { telefono, email },
  });

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "debitore",
    entityId: pratica.debitoreId,
    dettaglio: "contatti principali",
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function addDebitoreRecapitoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaWork(user, praticaId);

  const tipo = String(formData.get("tipo") || "");
  if (tipo !== "TELEFONO" && tipo !== "EMAIL") fail("Tipo recapito non valido");

  const valore = String(formData.get("valore") || "").trim();
  if (!valore) fail("Inserisci il valore");

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const count = await prisma.debitoreRecapito.count({
    where: { debitoreId: pratica.debitoreId, tipo },
  });

  await prisma.debitoreRecapito.create({
    data: {
      debitoreId: pratica.debitoreId,
      tipo,
      valore,
      ordine: count + 1,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "create",
    entity: "debitore_recapito",
    entityId: pratica.debitoreId,
    dettaglio: `${tipo} ${valore}`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function removeDebitoreRecapitoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const recapitoId = String(formData.get("recapitoId") || "");
  await assertPraticaWork(user, praticaId);

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const recapito = await prisma.debitoreRecapito.findFirst({
    where: { id: recapitoId, debitoreId: pratica.debitoreId },
  });
  if (!recapito) fail("Recapito non trovato");

  await prisma.debitoreRecapito.delete({ where: { id: recapitoId } });

  await writeAudit({
    userId: user.id,
    action: "delete",
    entity: "debitore_recapito",
    entityId: recapitoId,
    dettaglio: recapito.valore,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function updateDebitoreRecapitoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const recapitoId = String(formData.get("recapitoId") || "");
  const valore = String(formData.get("valore") || "").trim();
  await assertPraticaWork(user, praticaId);
  if (!valore) fail("Inserisci il valore");

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const recapito = await prisma.debitoreRecapito.findFirst({
    where: { id: recapitoId, debitoreId: pratica.debitoreId },
  });
  if (!recapito) fail("Recapito non trovato");

  await prisma.debitoreRecapito.update({
    where: { id: recapitoId },
    data: { valore },
  });

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "debitore_recapito",
    entityId: recapitoId,
    dettaglio: valore,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function updateGaranteContattiPrincipaliAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const garanteId = String(formData.get("garanteId") || "");
  await assertPraticaWork(user, praticaId);
  await assertGaranteOnPratica(praticaId, garanteId);

  const telefono = String(formData.get("telefono") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;

  await prisma.garante.update({
    where: { id: garanteId },
    data: { telefono, email },
  });

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "garante",
    entityId: garanteId,
    dettaglio: "contatti principali",
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function addGaranteRecapitoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const garanteId = String(formData.get("garanteId") || "");
  await assertPraticaWork(user, praticaId);
  await assertGaranteOnPratica(praticaId, garanteId);

  const tipo = String(formData.get("tipo") || "");
  if (tipo !== "TELEFONO" && tipo !== "EMAIL") fail("Tipo recapito non valido");

  const valore = String(formData.get("valore") || "").trim();
  if (!valore) fail("Inserisci il valore");

  const count = await prisma.garanteRecapito.count({
    where: { garanteId, tipo },
  });

  await prisma.garanteRecapito.create({
    data: {
      garanteId,
      tipo,
      valore,
      ordine: count + 1,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "create",
    entity: "garante_recapito",
    entityId: garanteId,
    dettaglio: `${tipo} ${valore}`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function removeGaranteRecapitoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const garanteId = String(formData.get("garanteId") || "");
  const recapitoId = String(formData.get("recapitoId") || "");
  await assertPraticaWork(user, praticaId);
  await assertGaranteOnPratica(praticaId, garanteId);

  const recapito = await prisma.garanteRecapito.findFirst({
    where: { id: recapitoId, garanteId },
  });
  if (!recapito) fail("Recapito non trovato");

  await prisma.garanteRecapito.delete({ where: { id: recapitoId } });

  await writeAudit({
    userId: user.id,
    action: "delete",
    entity: "garante_recapito",
    entityId: recapitoId,
    dettaglio: recapito.valore,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function updateGaranteRecapitoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const garanteId = String(formData.get("garanteId") || "");
  const recapitoId = String(formData.get("recapitoId") || "");
  const valore = String(formData.get("valore") || "").trim();
  await assertPraticaWork(user, praticaId);
  await assertGaranteOnPratica(praticaId, garanteId);
  if (!valore) fail("Inserisci il valore");

  const recapito = await prisma.garanteRecapito.findFirst({
    where: { id: recapitoId, garanteId },
  });
  if (!recapito) fail("Recapito non trovato");

  await prisma.garanteRecapito.update({
    where: { id: recapitoId },
    data: { valore },
  });

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "garante_recapito",
    entityId: recapitoId,
    dettaglio: valore,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function updateStatoTelefonoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const garanteId = String(formData.get("garanteId") || "");
  const target = String(formData.get("target") || "");
  const statoRaw = String(formData.get("stato") || "").trim();
  const stato = statoRaw || null;

  if (stato && !(stato in STATI_TELEFONO)) fail("Stato telefono non valido");
  if (!target) fail("Recapito non specificato");

  await assertPraticaWork(user, praticaId);

  if (garanteId) {
    await assertGaranteOnPratica(praticaId, garanteId);
    if (target === "principale") {
      await prisma.garante.update({
        where: { id: garanteId },
        data: { telefonoStato: stato },
      });
    } else {
      const recapito = await prisma.garanteRecapito.findFirst({
        where: { id: target, garanteId, tipo: "TELEFONO" },
      });
      if (!recapito) fail("Recapito non trovato");
      await prisma.garanteRecapito.update({
        where: { id: target },
        data: { stato },
      });
    }
  } else {
    const pratica = await prisma.pratica.findUnique({
      where: { id: praticaId },
      select: { debitoreId: true },
    });
    if (!pratica) fail("Pratica non trovata");

    if (target === "principale") {
      await prisma.debitore.update({
        where: { id: pratica.debitoreId },
        data: { telefonoStato: stato },
      });
    } else {
      const recapito = await prisma.debitoreRecapito.findFirst({
        where: { id: target, debitoreId: pratica.debitoreId, tipo: "TELEFONO" },
      });
      if (!recapito) fail("Recapito non trovato");
      await prisma.debitoreRecapito.update({
        where: { id: target },
        data: { stato },
      });
    }
  }

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: garanteId ? "garante" : "debitore",
    entityId: garanteId || praticaId,
    dettaglio: `stato telefono ${stato || "—"}`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function addAttivitaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const nota = String(formData.get("nota") || "").trim();
  if (!nota) fail("Inserisci il testo della nota");

  await prisma.attivita.create({
    data: {
      praticaId,
      userId: user.id,
      tipo: "NOTA",
      nota,
    },
  });

  await prisma.pratica.update({
    where: { id: praticaId },
    data: { updatedAt: new Date() },
  });

  await writeAudit({
    userId: user.id,
    action: "attivita",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: nota,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/");
}

/** Nota unica su più pratiche (tutti tranne operatori). */
export async function addAttivitaMassivaAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:nota-massiva");
  const nota = String(formData.get("nota") || "").trim();
  if (!nota) fail("Inserisci il testo della nota");

  const importante =
    String(formData.get("importante") || "") === "1" ||
    String(formData.get("importante") || "").toLowerCase() === "true";
  // Checkbox “Fissa” (accetta anche il vecchio nome “blocca”)
  const fissa =
    String(formData.get("fissa") || "") === "1" ||
    String(formData.get("fissa") || "").toLowerCase() === "true" ||
    String(formData.get("blocca") || "") === "1" ||
    String(formData.get("blocca") || "").toLowerCase() === "true";
  // - importante = solo colore
  // - fissa = pin in alto (come Fissa/Togli in scheda)
  const notaImportante = importante;
  const fissata = fissa;

  const ids = [...new Set(formData.getAll("praticaId").map((v) => String(v).trim()).filter(Boolean))];
  if (!ids.length) fail("Seleziona almeno una pratica");
  if (ids.length > 200) fail("Massimo 200 pratiche per nota massiva");

  const now = new Date();
  let scritte = 0;
  const saltate: string[] = [];

  for (const praticaId of ids) {
    if (!(await canAccessPratica(user, praticaId))) {
      saltate.push(praticaId);
      continue;
    }
    try {
      await assertPraticaNotLockedByOther(user.id, praticaId);
    } catch {
      saltate.push(praticaId);
      continue;
    }

    if (fissata) {
      await prisma.attivita.updateMany({
        where: { praticaId, fissata: true },
        data: { fissata: false },
      });
    }

    await prisma.attivita.create({
      data: {
        praticaId,
        userId: user.id,
        tipo: "NOTA",
        nota,
        fissata,
        importante: notaImportante,
        bloccata: false,
      },
    });
    await prisma.pratica.update({
      where: { id: praticaId },
      data: { updatedAt: now },
    });
    scritte += 1;
  }

  if (!scritte) {
    fail(
      saltate.length
        ? "Nessuna nota scritta: pratiche non accessibili o in uso da altri"
        : "Nessuna pratica valida"
    );
  }

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "attivita_massiva",
    entity: "pratica",
    dettaglio: `nota massiva su ${scritte} pratiche${
      saltate.length ? ` (${saltate.length} saltate)` : ""
    }${notaImportante ? " [importante]" : ""}${fissata ? " [fissa]" : ""}: ${nota.slice(0, 200)}`,
  });

  revalidatePath("/pratiche");
  revalidatePath("/");
  for (const id of ids) {
    if (!saltate.includes(id)) revalidatePath(`/pratiche/${id}`);
  }

  return {
    scritte,
    saltate: saltate.length,
    importante: notaImportante,
    fissata,
  };
}

export async function updateAttivitaAction(formData: FormData) {
  const user = await requireWritableUser();
  const attivitaId = String(formData.get("attivitaId") || "");
  const attivita = await prisma.attivita.findUnique({
    where: { id: attivitaId },
    select: { id: true, praticaId: true, bloccata: true },
  });
  if (!attivita) fail("Nota non trovata");
  await assertPraticaEditable(user, attivita.praticaId);
  if (attivita.bloccata && !can(user, "pratiche:nota-massiva")) {
    fail("Questa nota è bloccata: solo supervisione/admin può modificarla");
  }

  const nota = String(formData.get("nota") || "").trim();
  if (!nota) fail("Inserisci il testo della nota");

  await prisma.attivita.update({
    where: { id: attivitaId },
    data: { nota },
  });

  await prisma.pratica.update({
    where: { id: attivita.praticaId },
    data: { updatedAt: new Date() },
  });

  await writeAudit({
    userId: user.id,
    action: "attivita_update",
    entity: "pratica",
    entityId: attivita.praticaId,
    dettaglio: nota,
  });
  revalidatePath(`/pratiche/${attivita.praticaId}`);
  revalidatePath("/");
}

export async function toggleFissaAttivitaAction(formData: FormData) {
  const user = await requireWritableUser();
  const attivitaId = String(formData.get("attivitaId") || "");
  const attivita = await prisma.attivita.findUnique({
    where: { id: attivitaId },
    select: { id: true, praticaId: true, fissata: true, bloccata: true },
  });
  if (!attivita) fail("Nota non trovata");
  await assertPraticaEditable(user, attivita.praticaId);

  if (attivita.bloccata && !can(user, "pratiche:nota-massiva")) {
    fail("Questa nota è bloccata: non puoi modificare il fissaggio");
  }

  const next = !attivita.fissata;
  await prisma.$transaction([
    prisma.attivita.updateMany({
      where: { praticaId: attivita.praticaId, fissata: true },
      data: { fissata: false },
    }),
    ...(next
      ? [
          prisma.attivita.update({
            where: { id: attivita.id },
            data: { fissata: true },
          }),
        ]
      : []),
  ]);

  await writeAudit({
    userId: user.id,
    action: next ? "attivita_fissa" : "attivita_sfissa",
    entity: "pratica",
    entityId: attivita.praticaId,
    dettaglio: attivitaId,
  });
  revalidatePath(`/pratiche/${attivita.praticaId}`);
}

export async function updateContattoPraticaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const esitoContatto = String(formData.get("esito") || "") || null;
  const tipoContatto = String(formData.get("tipo") || "") || null;
  const scheduledAtRaw = String(formData.get("scheduledAt") || "");
  const memoAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
  const promessaAt =
    esitoContatto === "PROMESSA"
      ? parseDateOnly(String(formData.get("promessaAt") || ""))
      : undefined;
  if (esitoContatto === "PROMESSA" && !promessaAt) {
    fail("Inserisci la data della promessa di pagamento");
  }
  const promessaImportoRaw = String(formData.get("promessaImporto") || "").trim();
  let promessaImporto: number | null = null;
  if (esitoContatto === "PROMESSA" && promessaImportoRaw) {
    promessaImporto = Number(promessaImportoRaw.replace(",", "."));
    if (Number.isNaN(promessaImporto)) {
      fail("Importo promessa non valido");
    }
  }

  await prisma.pratica.update({
    where: { id: praticaId },
    data: {
      esitoContatto,
      tipoContatto,
      memoAt,
      ...(promessaAt ? { promessaAt } : {}),
      promessaImporto: esitoContatto === "PROMESSA" ? promessaImporto : null,
    },
  });
  await syncMessaggioAgenda({ praticaId, userId: user.id, memoAt });

  await writeAudit({
    userId: user.id,
    action: "contatto_update",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${tipoContatto || ""} ${esitoContatto || ""}`.trim(),
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/pratiche");
  revalidatePath("/");
  revalidatePath("/agenda");
}

export async function salvaMemoAgendaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const scheduledAtRaw = String(formData.get("scheduledAt") || "").trim();
  if (!scheduledAtRaw) fail("Seleziona data e ora del richiamo");
  const memoAt = new Date(scheduledAtRaw);
  if (Number.isNaN(memoAt.getTime())) fail("Data/ora non valida");
  const nota = String(formData.get("nota") || "").trim();

  await prisma.pratica.update({
    where: { id: praticaId },
    data: { memoAt },
  });
  await syncMessaggioAgenda({
    praticaId,
    userId: user.id,
    memoAt,
    nota: nota || null,
  });

  if (nota) {
    await prisma.attivita.create({
      data: {
        praticaId,
        userId: user.id,
        tipo: "NOTA",
        nota: `Agenda ${memoAt.toLocaleString("it-IT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })} — ${nota}`,
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "memo_agenda",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: nota || scheduledAtRaw,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/pratiche");
  revalidatePath("/");
  revalidatePath("/agenda");
}

export async function clearMemoPraticaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);

  await prisma.pratica.update({
    where: { id: praticaId },
    data: { memoAt: null },
  });
  await markMessaggiLetti(praticaId);

  await writeAudit({
    userId: user.id,
    action: "memo_clear",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: "Richiamo completato",
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function postponeMemoPraticaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  const mode = String(formData.get("mode") || "sposta");
  await assertPraticaEditable(user, praticaId);

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { memoAt: true },
  });
  if (!pratica?.memoAt) fail("Nessun richiamo da spostare");

  const next = new Date(pratica.memoAt);
  if (mode === "domani") {
    next.setDate(next.getDate() + 1);
  } else {
    next.setMinutes(next.getMinutes() + 30);
  }

  await prisma.pratica.update({
    where: { id: praticaId },
    data: { memoAt: next },
  });
  await syncMessaggioAgenda({ praticaId, userId: user.id, memoAt: next });

  await writeAudit({
    userId: user.id,
    action: "memo_postpone",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: mode === "domani" ? "domani" : "+30 min",
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function markMemoLettoAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);

  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    include: { debitore: true, mandante: true },
  });
  if (!pratica) fail("Pratica non trovata");

  await syncMessaggioAgenda({
    praticaId,
    userId: user.id,
    memoAt: pratica.memoAt,
  });
  await markMessaggiLetti(praticaId);
  await prisma.pratica.update({
    where: { id: praticaId },
    data: { memoAt: null },
  });

  await writeAudit({
    userId: user.id,
    action: "memo_letto",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: "Setta già letto",
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function sendMessaggioInternoAction(formData: FormData) {
  const user = await requireWritableUser();
  const collegata = String(formData.get("collegata") || "1") !== "0";
  const praticaIdRaw = String(formData.get("praticaId") || "");
  const praticaId = collegata ? praticaIdRaw : "";
  const toUserId = String(formData.get("toUserId") || "");
  const toRole = String(formData.get("toRole") || "");
  const testo = String(formData.get("testo") || "").trim();
  if (!testo) fail("Scrivi il messaggio");
  if (collegata) {
    if (!praticaId) fail("Pratica mancante");
    await assertPraticaEditable(user, praticaId);
  }

  let destinatari: { id: string; name: string }[] = [];
  if (toRole === "ALL" || toRole === "OPERATOR" || toRole === "BACK_OFFICE") {
    destinatari = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        active: true,
        id: { not: user.id },
        ...(toRole === "ALL" ? {} : { role: toRole }),
      },
      select: { id: true, name: true },
    });
    if (!destinatari.length) fail("Nessun destinatario per quel gruppo");
  } else {
    if (!toUserId) fail("Seleziona un collega oppure un gruppo");
    if (toUserId === user.id) fail("Non puoi inviare un messaggio a te stesso");
    const dest = await prisma.user.findFirst({
      where: { id: toUserId, tenantId: user.tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!dest) fail("Destinatario non trovato");
    destinatari = [dest];
  }

  await prisma.messaggioInterno.createMany({
    data: destinatari.map((d) => ({
      praticaId: collegata ? praticaId : null,
      fromUserId: user.id,
      toUserId: d.id,
      testo,
    })),
  });

  if (collegata && praticaId) {
    await prisma.attivita.create({
      data: {
        praticaId,
        userId: user.id,
        tipo: "MESSAGGIO",
        nota: formatMessaggioCollegaNota({
          fromName: user.name,
          toNames: destinatari.map((d) => d.name),
          testo,
        }),
      },
    });
    await prisma.pratica.update({
      where: { id: praticaId },
      data: { updatedAt: new Date() },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "msg_interno",
    entity: collegata ? "pratica" : "messaggio",
    entityId: collegata ? praticaId : null,
    dettaglio: `a ${destinatari.map((d) => d.name).join(", ")}: ${testo.slice(0, 80)}`,
  });
  if (collegata) revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/agenda");
  if (collegata) revalidatePath("/");
}

export async function markMessaggioInternoLettoAction(formData: FormData) {
  const user = await requireWritableUser();
  const id = String(formData.get("messageId") || "");
  const msg = await prisma.messaggioInterno.findUnique({ where: { id } });
  if (!msg || msg.toUserId !== user.id) fail("Messaggio non trovato");
  await prisma.messaggioInterno.update({
    where: { id },
    data: { letto: true, lettoAt: new Date() },
  });
  revalidatePath("/agenda");
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}

export async function updatePraticaStatoAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:update:stato");
  const praticaId = String(formData.get("praticaId") || "");
  const stato = String(formData.get("stato") || "");
  if (!stato) fail("Stato obbligatorio");
  await assertPraticaEditable(user, praticaId);
  const promessaAt =
    stato === "PROMESSA"
      ? parseDateOnly(String(formData.get("promessaAt") || ""))
      : undefined;
  if (stato === "PROMESSA" && !promessaAt) {
    fail("Inserisci la data della promessa di pagamento");
  }

  await prisma.pratica.update({
    where: { id: praticaId },
    data: { stato, ...(promessaAt ? { promessaAt } : {}) },
  });

  await writeAudit({
    userId: user.id,
    action: "stato_update",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: stato,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/pratiche");
  revalidatePath("/");
  revalidatePath("/affidi");
  revalidatePath("/report");
}

function parseImportoCsv(raw?: string) {
  const n = Number(String(raw || "").trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseDataCsv(raw?: string) {
  const value = String(raw || "").trim();
  if (!value) return null;
  const iso = parseDateOnly(value);
  if (iso) return iso;
  const it = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (!it) return null;
  return new Date(Number(it[3]), Number(it[2]) - 1, Number(it[1]), 12, 0, 0);
}

async function registraIncassoSuPratica(input: {
  userId: string;
  praticaId: string;
  importo: number;
  metodo?: string;
  causale?: string;
  modo?: string;
  data?: Date;
  dataScadenza?: Date | null;
}) {
  const { praticaId, userId } = input;
  if (input.importo <= 0) fail("Importo non valido");
  const pratica = await prisma.pratica.findUnique({
    where: { id: praticaId },
    include: {
      incassi: true,
      mandante: { select: { provvigionePerc: true, provvigioniMetodo: true } },
    },
  });
  if (!pratica) fail("Pratica non trovata");
  const gia = pratica.incassi.reduce(
    (acc, i) => ({
      capitale: acc.capitale + i.capitale,
      interessi: acc.interessi + i.interessi,
      spese: acc.spese + i.spese,
    }),
    { capitale: 0, interessi: 0, spese: 0 }
  );
  const split = ripartiIncasso(input.importo, pratica, gia);
  const nuovoResiduo = Math.max(0, pratica.residuo - split.usato);
  await prisma.$transaction(async (tx) => {
    const incasso = await tx.incasso.create({
      data: {
        praticaId,
        userId,
        importo: split.usato,
        capitale: split.capitale,
        interessi: split.interessi,
        spese: split.spese,
        metodo: input.metodo || "bonifico",
        modo: input.modo || "VE",
        causale: input.causale || "",
        data: input.data || new Date(),
        dataScadenza: input.dataScadenza ?? null,
      },
    });
    if (pratica.assegnatarioId) {
      const pct = resolveProvvigionePercentuale(
        pratica.mandante,
        input.metodo || "bonifico"
      );
      const prov = calcolaProvvigione(split.usato, pct);
      await tx.provvigione.create({
        data: {
          incassoId: incasso.id,
          praticaId,
          operatoreId: pratica.assegnatarioId,
          baseImporto: prov.baseImporto,
          percentuale: prov.percentuale,
          importo: prov.importo,
        },
      });
    }
    await tx.pratica.update({
      where: { id: praticaId },
      data: {
        residuo: nuovoResiduo,
        stato: nuovoResiduo <= 0.009 ? "INCASSO" : pratica.stato,
      },
    });
  });
  await writeAudit({
    userId,
    action: "incasso",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${split.usato.toFixed(2)} €`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/incassi`);
  revalidatePath(`/pratiche/${praticaId}/estratto`);
  revalidatePath(`/pratiche/${praticaId}/fatture`);
  return split.usato;
}

export async function addIncassoAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  await registraIncassoSuPratica({
    userId: user.id,
    praticaId,
    importo: Number(formData.get("importo") || 0),
    metodo: String(formData.get("metodo") || "bonifico"),
    causale: String(formData.get("causale") || "").trim(),
    modo: String(formData.get("modo") || "VE").trim() || "VE",
    data: parseDateOnly(String(formData.get("data") || "")) || new Date(),
    dataScadenza: parseDateOnly(String(formData.get("dataScadenza") || "")),
  });
  revalidatePath("/provigioni");
  revalidatePath("/");
}

export async function addFatturaAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const numero = String(formData.get("numero") || "").trim();
  const causale = String(formData.get("causale") || "").trim();
  const importo = Number(formData.get("importo") || 0);
  const pagato = Number(formData.get("pagato") || 0);
  const dataFattura = parseDateOnly(String(formData.get("dataFattura") || ""));
  const dataScadenza = parseDateOnly(String(formData.get("dataScadenza") || ""));
  if (!numero) fail("Numero fattura obbligatorio");
  if (importo <= 0) fail("Importo non valido");
  if (!dataFattura || !dataScadenza) fail("Date fattura e scadenza obbligatorie");

  await prisma.fattura.create({
    data: {
      praticaId,
      numero,
      causale,
      importo,
      pagato: Math.max(0, pagato),
      dataFattura,
      dataScadenza,
    },
  });
  await writeAudit({
    userId: user.id,
    action: "fattura",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${numero} ${importo.toFixed(2)} €`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/fatture`);
  revalidatePath(`/pratiche/${praticaId}/estratto`);
}

export async function createPianoAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const nRate = Number(formData.get("nRate") || 0);
  const start = String(formData.get("primaScadenza") || "");
  const pratica = await prisma.pratica.findUnique({ where: { id: praticaId } });
  if (!pratica) fail("Pratica non trovata");
  if (nRate < 2 || nRate > 36 || !start) {
    fail("Indica da 2 a 36 rate e la prima scadenza");
  }
  const quota = Math.round((pratica.residuo / nRate) * 100) / 100;
  await prisma.pianoRata.deleteMany({ where: { praticaId } });
  const startDate = new Date(start);
  for (let i = 0; i < nRate; i++) {
    const scadenza = new Date(startDate);
    scadenza.setMonth(scadenza.getMonth() + i);
    const importo =
      i === nRate - 1
        ? Math.round((pratica.residuo - quota * (nRate - 1)) * 100) / 100
        : quota;
    await prisma.pianoRata.create({
      data: { praticaId, numeroRata: i + 1, importo, scadenza },
    });
  }
  await prisma.pratica.update({
    where: { id: praticaId },
    data: { stato: "PIANO" },
  });
  await writeAudit({
    userId: user.id,
    action: "piano",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${nRate} rate`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function addDocumentoAction(formData: FormData) {
  const user = await requireWritableUser();
  if (!can(user, "pratiche:create") && !can(user, "pratiche:work")) {
    fail("Non puoi allegare documenti");
  }
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const nome = String(formData.get("nome") || "").trim();
  const tipo = String(formData.get("tipo") || "allegato");
  if (!nome) fail("Nome documento obbligatorio");
  await prisma.documento.create({ data: { praticaId, nome, tipo } });
  await writeAudit({
    userId: user.id,
    action: "documento",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: nome,
  });
  revalidatePath(`/pratiche/${praticaId}`);
}

export async function createMandanteAction(formData: FormData) {
  const user = await requireWritablePermission("mandanti:manage");
  const codice = String(formData.get("codice") || "").trim().toUpperCase();
  const ragioneSociale = String(formData.get("ragioneSociale") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  const telefono = String(formData.get("telefono") || "").trim() || null;
  if (!codice || !ragioneSociale) fail("Codice e ragione sociale obbligatori");
  const created = await prisma.mandante.create({
    data: { tenantId: user.tenantId, codice, ragioneSociale, email, telefono },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "create",
    entity: "mandante",
    dettaglio: codice,
  });
  revalidatePath("/mandanti");
  redirect(`/mandanti/${created.id}`);
}

export async function updateMandanteAction(formData: FormData) {
  const user = await requireWritablePermission("mandanti:manage");
  const id = String(formData.get("id") || "");
  if (!id) fail("ID mandante mancante");

  const existing = await prisma.mandante.findFirst({
    where: { id, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!existing) fail("Mandante non trovata");

  const ragioneSociale = String(formData.get("ragioneSociale") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const indirizzo = String(formData.get("indirizzo") || "").trim() || null;
  const citta = String(formData.get("citta") || "").trim() || null;
  const cap = String(formData.get("cap") || "").trim() || null;
  const provincia = String(formData.get("provincia") || "").trim() || null;
  const provvPercRaw = String(formData.get("provvigionePerc") || "").trim();
  const provvigionePerc = provvPercRaw ? parseFloat(provvPercRaw.replace(",", ".")) : null;
  const provvigioniMetodo = String(formData.get("provvigioniMetodo") || "").trim() || null;
  const incentivoTipo = String(formData.get("incentivoTipo") || "").trim() || null;
  const incValRaw = String(formData.get("incentivoValore") || "").trim();
  const incentivoValore = incValRaw ? parseFloat(incValRaw.replace(",", ".")) : null;
  const incSogliaRaw = String(formData.get("incentivoSoglia") || "").trim();
  const incentivoSoglia = incSogliaRaw ? parseFloat(incSogliaRaw.replace(",", ".")) : null;
  const incentivoNote = String(formData.get("incentivoNote") || "").trim() || null;
  const codiciScarico = String(formData.get("codiciScarico") || "").trim() || null;
  const smsPreimpostati = String(formData.get("smsPreimpostati") || "").trim() || null;
  const perimetri = String(formData.get("perimetri") || "").trim() || null;

  if (!ragioneSociale) fail("Ragione sociale obbligatoria");

  await prisma.mandante.update({
    where: { id },
    data: {
      ragioneSociale, email, telefono, indirizzo, citta, cap, provincia,
      provvigionePerc, provvigioniMetodo, incentivoTipo, incentivoValore, incentivoSoglia, incentivoNote,
      codiciScarico, smsPreimpostati, perimetri,
    },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "mandante",
    entityId: id,
    dettaglio: ragioneSociale,
  });
  revalidatePath("/mandanti");
  revalidatePath(`/mandanti/${id}`);
}

export async function createUserAction(formData: FormData) {
  const actor = await requireWritablePermission("operatori:manage");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "OPERATOR") as Role;
  const supervisorId = String(formData.get("supervisorId") || "") || null;
  if (!email || !name || password.length < 6) {
    fail("Email, nome e password (min. 6) obbligatori");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: {
      tenantId: actor.tenantId,
      email,
      name,
      passwordHash,
      passwordChangedAt: new Date(),
      role,
      supervisorId,
    },
  });
  await writeAudit({
    userId: actor.id,
    tenantId: actor.tenantId,
    action: "create",
    entity: "user",
    entityId: created.id,
    dettaglio: `${email} ${role}`,
  });
  revalidatePath("/utenti");
}

export async function importCsvAction(formData: FormData) {
  const user = await requireWritablePermission("import:run");
  const contesto = await parseImportContesto(formData, user.tenantId);
  if ("error" in contesto) return { error: contesto.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleziona un file CSV" };
  }
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "CSV vuoto" };
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const { mandanteId, perimetro, lotto, affidoIl, mandanteCodice } = contesto.ok;

  let created = 0;
  for (const line of lines.slice(1)) {
    const cols = line.split(";");
    const nome = cols[idx("nome")]?.trim();
    if (!nome) continue;
    const capitale = Number(cols[idx("capitale")] || 0);
    const interessi = Number(cols[idx("interessi")] || 0);
    const spese = Number(cols[idx("spese")] || 0);
    const debitore = await prisma.debitore.create({
      data: {
        tenantId: user.tenantId,
        nome,
        cognome: cols[idx("cognome")]?.trim() || "",
        codiceFiscale: cols[idx("cf")]?.trim() || null,
        telefono: cols[idx("telefono")]?.trim() || null,
        citta: cols[idx("citta")]?.trim() || null,
      },
    });
    await prisma.pratica.create({
      data: {
        tenantId: user.tenantId,
        numero: await nextNumero(user.tenantId),
        mandanteId,
        debitoreId: debitore.id,
        numeroMandante: lotto,
        dataAffido: affidoIl,
        capitale,
        interessi,
        spese,
        residuo: capitale + interessi + spese,
        stato: "NUOVA",
      },
    });
    created += 1;
  }
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "import",
    entity: "pratica",
    dettaglio: `${created} pratiche · ${mandanteCodice} · perimetro ${perimetro} · lotto ${lotto}`,
  });
  revalidatePath("/pratiche");
  revalidatePath("/import");
  return {
    ok: `Importate ${created} pratiche (mandante ${mandanteCodice}, perimetro ${perimetro}, lotto ${lotto})`,
  };
}

export async function importIncassiCsvAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const contesto = await parseImportContesto(formData, user.tenantId);
  if ("error" in contesto) return { error: contesto.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Seleziona un file CSV" };
  }
  const text = await file.text();
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "CSV vuoto" };
  const header = lines[0].split(";").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const colNumero = idx("numero") >= 0 ? idx("numero") : idx("pratica");
  const colImporto = idx("importo");
  if (colNumero < 0 || colImporto < 0) {
    return { error: "Intestazione richiesta: numero;importo (opzionali: data;metodo;causale;modo)" };
  }

  const { mandanteId, perimetro, lotto, affidoIl, mandanteCodice } = contesto.ok;
  const { start: affidoStart, end: affidoEnd } = giornoAffidoRange(affidoIl);

  let created = 0;
  const errori: string[] = [];
  const praticaIdsOk: string[] = [];
  for (const [i, line] of lines.slice(1).entries()) {
    const cols = line.split(";");
    const numero = cols[colNumero]?.trim();
    const importo = parseImportoCsv(cols[colImporto]);
    if (!numero || importo <= 0) {
      errori.push(`Riga ${i + 2}: numero o importo non validi`);
      continue;
    }
    const pratica = await prisma.pratica.findFirst({
      where: {
        tenantId: user.tenantId,
        mandanteId,
        numeroMandante: lotto,
        dataAffido: { gte: affidoStart, lte: affidoEnd },
        numero,
      },
      select: { id: true, numero: true },
    });
    if (!pratica) {
      errori.push(
        `Riga ${i + 2}: pratica ${numero} non trovata (mandante/lotto/affido)`
      );
      continue;
    }
    try {
      await registraIncassoSuPratica({
        userId: user.id,
        praticaId: pratica.id,
        importo,
        metodo: cols[idx("metodo")]?.trim() || "bonifico",
        causale: cols[idx("causale")]?.trim() || `import massivo ${pratica.numero}`,
        modo: cols[idx("modo")]?.trim() || "VE",
        data: parseDataCsv(cols[idx("data")]) || new Date(),
      });
      created += 1;
      praticaIdsOk.push(pratica.id);
    } catch (e) {
      errori.push(`Riga ${i + 2}: ${e instanceof Error ? e.message : "errore"}`);
    }
  }

  let notificati = 0;
  if (praticaIdsOk.length) {
    const res = await notificaSanzioneIncassoMassivo({
      fromUserId: user.id,
      tenantId: user.tenantId,
      praticaIds: praticaIdsOk,
    });
    notificati = res.notificati;
  }

  await writeAudit({
    userId: user.id,
    action: "import",
    entity: "incasso",
    dettaglio: `${created} incassi · ${mandanteCodice} · ${perimetro} · lotto ${lotto} · ${notificati} avvisi sanzione`,
  });
  revalidatePath("/pratiche");
  revalidatePath("/import");
  revalidatePath("/provigioni");
  revalidatePath("/");
  revalidatePath("/agenda");
  const suffix = errori.length
    ? ` · ${errori.slice(0, 5).join(" · ")}${errori.length > 5 ? ` (+${errori.length - 5})` : ""}`
    : "";
  const avvisi =
    notificati > 0
      ? ` · ${notificati} operatori avvisati (sanzione attiva)`
      : "";
  return { ok: `Registrati ${created} incassi${avvisi}${suffix}` };
}

export { praticaWhere, assertCan };
