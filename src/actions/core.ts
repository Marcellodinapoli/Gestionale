"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, clearSession, getCurrentUser } from "@/lib/auth";
import { assertCan, can, canManageMandantePerimetri, mustChoosePostazioneAlLogin, type Role } from "@/lib/permissions";
import {
  canAccessPratica,
  parseDateOnly,
  praticaWhere,
  praticheStessoDebitoreIds,
  ripartiIncasso,
  writeAudit,
} from "@/lib/domain";
import { syncMessaggioAgenda, markMessaggiLetti } from "@/lib/memoAgenda";
import { formatMessaggioCollegaNota } from "@/lib/noteFormat";
import { calcolaProvvigione, resolveProvvigionePercentuale, resolveProvvigionePercentualeLato } from "@/lib/provvigioni";
import { parsePerimetri, perimetroPerNome } from "@/lib/mandantePerimetri";
import { requireWritablePermission, requireWritableUser } from "@/lib/guard";
import { STATI_TELEFONO } from "@/lib/statoTelefono";
import { assertPraticaLockHeld, assertPraticaNotLockedByOther, releaseAllUserLocks } from "@/lib/praticaLock";
import { isPasswordExpired } from "@/lib/passwordPolicy";
import { validatePasswordComplexity } from "@/lib/passwordRules";
import { normalizeTenantSlug } from "@/lib/tenant";
import { notificaSanzioneIncassoMassivo } from "@/lib/sanzioneIncassoMassivo";
import {
  csvColIndex,
  csvInt,
  csvMoney,
  giornoAffidoRange,
  parseCsvHeader,
  parseImportContesto,
  validateCsvLottoRighe,
} from "@/lib/importContesto";
import {
  debitoreUpdateFromCsv,
  ImportPraticaIndex,
  parseCsvPraticaRow,
  praticaUpdateFromCsv,
  type ExistingPraticaImport,
} from "@/lib/importCsvPratiche";
import { isCodiceScarico, statoDaCodiceScarico } from "@/lib/scarico";
import { RUOLI_LAVORAZIONE } from "@/lib/praticaOrdine";
import { isPraticaChiusa } from "@/lib/praticaCollegata";

function fail(message: string): never {
  throw new Error(message);
}

function isRuoloLavorazione(role: string) {
  return (RUOLI_LAVORAZIONE as readonly string[]).includes(role);
}

export async function loginAction(input: {
  email?: string;
  password?: string;
  tenantSlug?: string;
}) {
  const email = String(input?.email || "")
    .trim()
    .toLowerCase();
  const password = String(input?.password || "");
  const slug = normalizeTenantSlug(String(input?.tenantSlug || ""));
  if (!slug) return { error: "Inserisci il codice azienda" };
  if (!email) return { error: "Inserisci l'email" };
  if (!password) return { error: "Inserisci la password" };

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || tenant.active === false) {
    return { error: "Azienda non trovata o non attiva" };
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (!user) {
    console.error("[login] utente assente", { slug, email, tenantId: tenant.id });
    return { error: "Credenziali non valide" };
  }
  if (user.active === false) {
    console.error("[login] utente disattivo", { email });
    return { error: "Credenziali non valide" };
  }
  const hash = String(user.passwordHash || "");
  const ok = hash ? await bcrypt.compare(password, hash) : false;
  if (!ok) {
    console.error("[login] password non valida", {
      email,
      hashLen: hash.length,
      passwordLen: password.length,
    });
    return { error: "Credenziali non valide" };
  }
  const keepPostazione = Boolean(user.postazioneFissa && user.postazioneId);
  let postazioneIdDopoLogin: string | null = user.postazioneId;

  if (keepPostazione) {
    const postazione = await prisma.postazione.findFirst({
      where: { id: user.postazioneId!, tenantId: tenant.id, active: true },
    });
    if (!postazione) {
      postazioneIdDopoLogin = null;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), postazioneId: null, postazioneFissa: false },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }
  } else {
    postazioneIdDopoLogin = null;
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), postazioneId: null },
    });
  }

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
      formazioneOnly: user.formazioneOnly,
    }),
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

  const needsPostazione = mustChoosePostazioneAlLogin({
    role: user.role as Role,
    formazioneOnly: user.formazioneOnly,
    postazioneId: postazioneIdDopoLogin,
    postazioneFissa: keepPostazione && Boolean(postazioneIdDopoLogin),
  });
  if (user.formazioneOnly) {
    redirect("/formazione/progressi");
  }
  const { needsSediSetup } = await import("@/lib/sediSetup");
  if (
    await needsSediSetup({
      role: user.role as Role,
      tenantId: user.tenantId,
    })
  ) {
    redirect("/setup-sedi");
  }
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

  const now = new Date();
  await prisma.pratica.update({
    where: { id: praticaId },
    data: {
      updatedAt: now,
      ...(isRuoloLavorazione(user.role) ? { ultimaLavorazioneAt: now } : {}),
    },
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

const NOTA_COLLEGATA_PRINCIPALE = "note nella pratica principale";

async function applyScaricoPromessaPratica(
  praticaId: string,
  input: {
    codiceScarico: string | null;
    isPromessa: boolean;
    promessaAt?: Date;
    promessaImporto: number | null;
  },
  opts?: { ultimaLavorazione?: boolean }
) {
  const praticaCorrente = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { codiceScarico: true },
  });
  const codiceScaricoCambiato =
    (praticaCorrente?.codiceScarico || null) !== (input.codiceScarico || null);
  const statoDaCodice = input.codiceScarico
    ? statoDaCodiceScarico(input.codiceScarico)
    : null;
  const now = new Date();

  await prisma.pratica.update({
    where: { id: praticaId },
    data: {
      codiceScarico: input.codiceScarico,
      ...(codiceScaricoCambiato ? { codiceScaricoAt: now } : {}),
      ...(statoDaCodice ? { stato: statoDaCodice } : {}),
      ...(input.codiceScarico === "PPC" ? { esitoContatto: "PROMESSA" } : {}),
      ...(input.promessaAt ? { promessaAt: input.promessaAt } : {}),
      promessaImporto: input.isPromessa ? input.promessaImporto : null,
      updatedAt: now,
      ...(opts?.ultimaLavorazione ? { ultimaLavorazioneAt: now } : {}),
    },
  });
}

/** Salva nota + codice scarico (+ promessa) sulla pratica e propaga sulle collegate in lavorazione. */
export async function salvaNotaServizioPraticaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);

  const main = await prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { tenantId: true, mandanteId: true },
  });
  if (!main || main.tenantId !== user.tenantId) fail("Pratica non valida");

  const nota = String(formData.get("nota") || "").trim();
  const codScaricoRaw = String(formData.get("codScarico") || "").trim();
  const codiceScarico = codScaricoRaw || null;
  if (codiceScarico && !isCodiceScarico(codiceScarico)) {
    fail("Codice scarico non valido");
  }

  const isPromessa = codiceScarico === "PPC";
  const promessaAt = isPromessa
    ? parseDateOnly(String(formData.get("promessaAt") || ""))
    : undefined;
  if (isPromessa && !promessaAt) {
    fail("Inserisci la data della promessa di pagamento");
  }
  const promessaImportoRaw = String(formData.get("promessaImporto") || "").trim();
  let promessaImporto: number | null = null;
  if (isPromessa && promessaImportoRaw) {
    promessaImporto = Number(promessaImportoRaw.replace(",", "."));
    if (Number.isNaN(promessaImporto)) {
      fail("Importo promessa non valido");
    }
  }

  const scaricoInput = {
    codiceScarico,
    isPromessa,
    promessaAt: promessaAt ?? undefined,
    promessaImporto,
  };
  const lavorazione = isRuoloLavorazione(user.role);

  if (nota) {
    await prisma.attivita.create({
      data: {
        praticaId,
        userId: user.id,
        tipo: "NOTA",
        nota,
      },
    });
  }

  await applyScaricoPromessaPratica(praticaId, scaricoInput, {
    ultimaLavorazione: lavorazione && Boolean(nota),
  });

  const collegateIds = (
    await praticheStessoDebitoreIds(praticaId, "aperta")
  ).filter((id) => id !== praticaId);

  const collegate = collegateIds.length
    ? await prisma.pratica.findMany({
        where: {
          id: { in: collegateIds },
          tenantId: user.tenantId,
          mandanteId: main.mandanteId,
        },
        select: { id: true, stato: true },
      })
    : [];

  let collegateAggiornate = 0;
  for (const collegata of collegate) {
    if (isPraticaChiusa(collegata.stato)) continue;
    try {
      await assertPraticaNotLockedByOther(user.id, collegata.id);
    } catch {
      continue;
    }

    await prisma.attivita.create({
      data: {
        praticaId: collegata.id,
        userId: user.id,
        tipo: "NOTA",
        nota: NOTA_COLLEGATA_PRINCIPALE,
      },
    });
    await applyScaricoPromessaPratica(collegata.id, scaricoInput, {
      ultimaLavorazione: lavorazione,
    });
    collegateAggiornate += 1;
    revalidatePath(`/pratiche/${collegata.id}`);
  }

  await writeAudit({
    userId: user.id,
    action: "nota_servizio_collegate",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: [
      codiceScarico || "—",
      collegateAggiornate
        ? `propagata su ${collegateAggiornate} collegate`
        : "nessuna collegata aggiornata",
      nota ? nota.slice(0, 120) : "",
    ]
      .filter(Boolean)
      .join(" · "),
  });

  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath("/pratiche");
  revalidatePath("/");
  revalidatePath("/agenda");

  return { collegateAggiornate };
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

  const aggiornaEsito = formData.has("esito");
  const esitoContatto = String(formData.get("esito") || "") || null;

  const aggiornaTipo = formData.has("tipo");
  const tipoContatto = String(formData.get("tipo") || "") || null;

  const aggiornaMemo = formData.has("scheduledAt");
  const scheduledAtRaw = String(formData.get("scheduledAt") || "");
  const memoAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

  const aggiornaCodice = formData.has("codScarico");
  const codScaricoRaw = String(formData.get("codScarico") || "").trim();
  const codiceScarico = codScaricoRaw || null;
  if (aggiornaCodice && codiceScarico && !isCodiceScarico(codiceScarico)) {
    fail("Codice scarico non valido");
  }

  const isPromessa =
    (aggiornaCodice && codiceScarico === "PPC") ||
    (aggiornaEsito && esitoContatto === "PROMESSA");

  const promessaAt = isPromessa
    ? parseDateOnly(String(formData.get("promessaAt") || ""))
    : undefined;
  if (isPromessa && !promessaAt) {
    fail("Inserisci la data della promessa di pagamento");
  }
  const promessaImportoRaw = String(formData.get("promessaImporto") || "").trim();
  let promessaImporto: number | null = null;
  if (isPromessa && promessaImportoRaw) {
    promessaImporto = Number(promessaImportoRaw.replace(",", "."));
    if (Number.isNaN(promessaImporto)) {
      fail("Importo promessa non valido");
    }
  }

  const statoDaCodice =
    aggiornaCodice && codiceScarico ? statoDaCodiceScarico(codiceScarico) : null;

  const praticaCorrente = aggiornaCodice
    ? await prisma.pratica.findUnique({
        where: { id: praticaId },
        select: { codiceScarico: true },
      })
    : null;
  const codiceScaricoCambiato =
    aggiornaCodice &&
    (praticaCorrente?.codiceScarico || null) !== (codiceScarico || null);

  await prisma.pratica.update({
    where: { id: praticaId },
    data: {
      ...(aggiornaEsito ? { esitoContatto } : {}),
      ...(aggiornaTipo ? { tipoContatto } : {}),
      ...(aggiornaMemo ? { memoAt } : {}),
      ...(aggiornaCodice
        ? {
            codiceScarico,
            ...(codiceScaricoCambiato ? { codiceScaricoAt: new Date() } : {}),
            ...(statoDaCodice ? { stato: statoDaCodice } : {}),
            ...(codiceScarico === "PPC" ? { esitoContatto: "PROMESSA" } : {}),
          }
        : {}),
      ...(promessaAt ? { promessaAt } : {}),
      ...(isPromessa || aggiornaEsito || aggiornaCodice
        ? {
            promessaImporto: isPromessa ? promessaImporto : null,
          }
        : {}),
    },
  });
  if (aggiornaMemo) {
    await syncMessaggioAgenda({ praticaId, userId: user.id, memoAt });
  }

  const dettaglioParts = [
    aggiornaCodice ? codiceScarico || "" : "",
    aggiornaTipo && tipoContatto ? tipoContatto : "",
    aggiornaEsito ? esitoContatto || "" : "",
  ].filter(Boolean);

  await writeAudit({
    userId: user.id,
    action: aggiornaCodice ? "scarico_update" : "contatto_update",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: dettaglioParts.join(" "),
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
    if (isRuoloLavorazione(user.role)) {
      await prisma.pratica.update({
        where: { id: praticaId },
        data: { ultimaLavorazioneAt: new Date() },
      });
    }
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
        role: toRole === "ALL" ? { not: "MANUTENZIONE" } : toRole,
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
    const now = new Date();
    await prisma.pratica.update({
      where: { id: praticaId },
      data: {
        updatedAt: now,
        ...(isRuoloLavorazione(user.role) ? { ultimaLavorazioneAt: now } : {}),
      },
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
  revalidatePath("/messaggi");
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
  revalidatePath("/messaggi");
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}

export async function updateMessaggioInternoAction(formData: FormData) {
  const user = await requireWritableUser();
  const id = String(formData.get("messageId") || "");
  const testo = String(formData.get("testo") || "").trim();
  if (!testo) fail("Scrivi il messaggio");
  const msg = await prisma.messaggioInterno.findUnique({ where: { id } });
  if (!msg || msg.fromUserId !== user.id) fail("Messaggio non trovato");
  await prisma.messaggioInterno.update({
    where: { id },
    data: { testo, letto: false, lettoAt: null },
  });
  await writeAudit({
    userId: user.id,
    action: "msg_interno_edit",
    entity: msg.praticaId ? "pratica" : "messaggio",
    entityId: msg.praticaId,
    dettaglio: testo.slice(0, 80),
  });
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}

export async function deleteMessaggioInternoAction(formData: FormData) {
  const user = await requireWritableUser();
  const id = String(formData.get("messageId") || "");
  const msg = await prisma.messaggioInterno.findUnique({ where: { id } });
  if (!msg || msg.fromUserId !== user.id) fail("Messaggio non trovato");
  await prisma.messaggioInterno.delete({ where: { id } });
  await writeAudit({
    userId: user.id,
    action: "msg_interno_del",
    entity: msg.praticaId ? "pratica" : "messaggio",
    entityId: msg.praticaId,
    dettaglio: msg.testo.slice(0, 80),
  });
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
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
      mandante: { select: { provvigionePerc: true, provvigioniMetodo: true, perimetri: true } },
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
      const metodo = input.metodo || "bonifico";
      const perimetro = perimetroPerNome(
        parsePerimetri(pratica.mandante.perimetri),
        pratica.numeroMandante
      );
      const pct = perimetro
        ? resolveProvvigionePercentualeLato(
            perimetro.pagata,
            metodo,
            pratica.codiceScarico
          )
        : resolveProvvigionePercentuale(pratica.mandante, metodo);
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
  const rateData = Array.from({ length: nRate }, (_, i) => {
    const scadenza = new Date(startDate);
    scadenza.setMonth(scadenza.getMonth() + i);
    const importo =
      i === nRate - 1
        ? Math.round((pratica.residuo - quota * (nRate - 1)) * 100) / 100
        : quota;
    return { praticaId, numeroRata: i + 1, importo, scadenza };
  });
  await Promise.all(
    rateData.map((data) => prisma.pianoRata.create({ data }))
  );
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
  const referente = String(formData.get("referente") || "").trim() || null;
  const referenteTelefono = String(formData.get("referenteTelefono") || "").trim() || null;
  const referenteEmail = String(formData.get("referenteEmail") || "").trim() || null;
  const pec = String(formData.get("pec") || "").trim() || null;
  const perimetriRaw = String(formData.get("perimetri") || "").trim() || null;
  if (!codice || !ragioneSociale) fail("Acronimo interno e ragione sociale obbligatori");
  const created = await prisma.mandante.create({
    data: {
      tenantId: user.tenantId,
      codice,
      ragioneSociale,
      email,
      telefono,
      referente,
      referenteTelefono,
      referenteEmail,
      pec,
      ...(canManageMandantePerimetri(user) && perimetriRaw ? { perimetri: perimetriRaw } : {}),
    },
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
    select: { id: true, perimetri: true },
  });
  if (!existing) fail("Mandante non trovata");

  const ragioneSociale = String(formData.get("ragioneSociale") || "").trim();
  const email = String(formData.get("email") || "").trim() || null;
  const telefono = String(formData.get("telefono") || "").trim() || null;
  const referente = String(formData.get("referente") || "").trim() || null;
  const referenteTelefono = String(formData.get("referenteTelefono") || "").trim() || null;
  const referenteEmail = String(formData.get("referenteEmail") || "").trim() || null;
  const pec = String(formData.get("pec") || "").trim() || null;
  const indirizzo = String(formData.get("indirizzo") || "").trim() || null;
  const citta = String(formData.get("citta") || "").trim() || null;
  const cap = String(formData.get("cap") || "").trim() || null;
  const provincia = String(formData.get("provincia") || "").trim() || null;
  const perimetriRaw = formData.has("perimetri")
    ? String(formData.get("perimetri") ?? "").trim()
    : null;
  const managesPerimetri = canManageMandantePerimetri(user);
  const perimetri =
    managesPerimetri && perimetriRaw !== null ? perimetriRaw : existing.perimetri;

  if (!ragioneSociale) fail("Ragione sociale obbligatoria");

  await prisma.mandante.update({
    where: { id },
    data: {
      ragioneSociale,
      email,
      telefono,
      referente,
      referenteTelefono,
      referenteEmail,
      pec,
      indirizzo,
      citta,
      cap,
      provincia,
      ...(managesPerimetri
        ? {
            perimetri,
            codiciScarico: null,
            smsPreimpostati: null,
            provvigionePerc: null,
            provvigioniMetodo: null,
            incentivoTipo: null,
            incentivoValore: null,
            incentivoSoglia: null,
            incentivoNote: null,
          }
        : {}),
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

export async function deleteMandanteAction(formData: FormData) {
  const user = await requireWritablePermission("mandanti:delete");
  const id = String(formData.get("id") || "");
  if (!id) fail("ID mandante mancante");

  const existing = await prisma.mandante.findFirst({
    where: { id, tenantId: user.tenantId },
    select: {
      id: true,
      codice: true,
      ragioneSociale: true,
      _count: { select: { pratiche: true } },
    },
  });
  if (!existing) fail("Mandante non trovata");

  if ((existing._count?.pratiche ?? 0) > 0) {
    fail(
      `Impossibile eliminare: sono collegate ${existing._count?.pratiche ?? 0} pratiche`
    );
  }

  await prisma.mandante.delete({ where: { id } });

  await writeAudit({
    userId: user.id,
    action: "delete",
    entity: "mandante",
    entityId: id,
    dettaglio: `${existing.codice} — ${existing.ragioneSociale}`,
  });

  revalidatePath("/mandanti");
  redirect("/mandanti");
}

export async function createUserAction(formData: FormData) {
  const actor = await requireWritablePermission("operatori:manage");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "OPERATOR") as Role;
  const supervisorId = String(formData.get("supervisorId") || "") || null;
  if (!email || !name || !password) {
    fail("Email, nome e password obbligatori");
  }
  const complexityErr = validatePasswordComplexity(password);
  if (complexityErr) fail(complexityErr);
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
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "CSV vuoto" };
  const { delim, header } = parseCsvHeader(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  if (idx("nome") < 0) {
    return {
      error:
        "Colonna «nome» mancante nell'intestazione CSV (separatore ; o ,). Colonne utili: nome;cognome;cf;telefono;citta;lotto;commessa;contratto;stato;capitale;mora;spese;spese_di_recupero;debito_residuo;importo_rata;rate_arretrate;netto_da_pagare",
    };
  }
  const { mandanteId, perimetro, lotto, affidoIl, mandanteCodice, scadenzaMandato } =
    contesto.ok;

  const lottoCheck = validateCsvLottoRighe(lines, delim, header, lotto);
  if ("error" in lottoCheck) return { error: lottoCheck.error };

  const fileName = file instanceof File ? file.name : null;

  const existing = await prisma.importBatch.findFirst({
    where: {
      tenantId: user.tenantId,
      tipo: "PRATICHE",
      mandanteId,
      perimetro,
      lotto,
    },
    orderBy: { createdAt: "desc" },
  });

  const isIntegrazione = Boolean(existing);
  const batch =
    existing ??
    (await prisma.importBatch.create({
      data: {
        tenantId: user.tenantId,
        tipo: "PRATICHE",
        mandanteId,
        mandanteCodice,
        perimetro,
        lotto,
        affidoIl,
        scadenzaMandato: scadenzaMandato ?? undefined,
        fileName,
        nPratiche: 0,
        createdById: user.id,
        createdByName: user.name,
      },
    }));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let maxScadenzaCsv: Date | null = null;

  const existingPratiche: ExistingPraticaImport[] = isIntegrazione
    ? await prisma.pratica.findMany({
        where: { tenantId: user.tenantId, importBatchId: batch.id },
        select: {
          id: true,
          debitoreId: true,
          contratto: true,
          commessa: true,
          stato: true,
          codiceScarico: true,
          note: true,
          debitore: { select: { codiceFiscale: true } },
        },
      })
    : [];

  const index = new ImportPraticaIndex(existingPratiche);

  for (const line of lines.slice(1)) {
    const cols = line.split(delim);
    const row = parseCsvPraticaRow(cols, header, lotto);
    if (!row) {
      skipped += 1;
      continue;
    }

    if (row.scadenza && (!maxScadenzaCsv || row.scadenza.getTime() > maxScadenzaCsv.getTime())) {
      maxScadenzaCsv = row.scadenza;
    }

    const match = isIntegrazione ? index.find(row) : null;

    if (match) {
      await prisma.debitore.update({
        where: { id: match.debitoreId },
        data: debitoreUpdateFromCsv(row),
      });
      await prisma.pratica.update({
        where: { id: match.id },
        data: praticaUpdateFromCsv(row, match),
      });
      updated += 1;
      continue;
    }

    const debitore = await prisma.debitore.create({
      data: {
        tenantId: user.tenantId,
        nome: row.nome,
        cognome: row.cognome,
        codiceFiscale: row.cf,
        telefono: row.telefono,
        citta: row.citta,
        indirizzo: row.indirizzo,
        cap: row.cap,
        provincia: row.provincia,
      },
    });
    const pratica = await prisma.pratica.create({
      data: {
        tenantId: user.tenantId,
        numero: await nextNumero(user.tenantId),
        mandanteId,
        debitoreId: debitore.id,
        numeroMandante: row.lottoRiga,
        contratto: row.contratto,
        commessa: row.commessa,
        dataAffido: affidoIl,
        scadenza: row.scadenza,
        capitale: row.capitale,
        interessi: row.interessi,
        spese: row.spese,
        speseRecupero: row.speseRecupero,
        residuo: row.residuo,
        importoRata: row.importoRata,
        rateArretrate: row.rateArretrate,
        nettoDaPagare: row.nettoDaPagare,
        stato: row.statoPratica,
        importBatchId: batch.id,
      },
    });
    if (isIntegrazione) {
      index.register(
        {
          id: pratica.id,
          debitoreId: debitore.id,
          contratto: row.contratto,
          commessa: row.commessa,
          stato: row.statoPratica,
          codiceScarico: null,
          note: null,
          debitore: { codiceFiscale: row.cf },
        },
        row
      );
    }
    created += 1;
  }

  const imported = created + updated;
  if (imported === 0) {
    if (!isIntegrazione) {
      await prisma.importBatch.delete({ where: { id: batch.id } }).catch(() => undefined);
    }
  } else {
    const totale = await prisma.pratica.count({
      where: { tenantId: user.tenantId, importBatchId: batch.id },
    });
    const scadenzaToSave =
      scadenzaMandato ??
      maxScadenzaCsv ??
      (batch as { scadenzaMandato?: Date | null }).scadenzaMandato ??
      null;
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        nPratiche: totale,
        ...(fileName ? { fileName } : {}),
        ...(scadenzaToSave ? { scadenzaMandato: scadenzaToSave } : {}),
      },
    });
  }

  if (imported > 0) {
    await writeAudit({
      userId: user.id,
      tenantId: user.tenantId,
      action: isIntegrazione ? "import_integrazione" : "import",
      entity: "pratica",
      entityId: batch.id,
      dettaglio: isIntegrazione
        ? `Integrazione +${created} nuove · ${updated} aggiornate · ${mandanteCodice} · perimetro ${perimetro} · lotto ${lotto}`
        : `${created} pratiche · ${mandanteCodice} · perimetro ${perimetro} · lotto ${lotto}`,
    });
  }
  revalidatePath("/pratiche");
  revalidatePath("/import");
  if (imported === 0) {
    return {
      error: `Nessuna pratica importata (${skipped} righe saltate). Controlla che il CSV abbia la colonna «nome» e il separatore ; o ,`,
    };
  }
  return {
    ok: isIntegrazione
      ? `Integrazione completata sul lotto ${lotto}.`
      : `Import completato sul lotto ${lotto}.`,
    importSummary: {
      isIntegrazione,
      lotto,
      mandanteCodice,
      perimetro,
      created,
      updated,
      skipped,
    },
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
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { error: "CSV vuoto" };
  const { delim, header } = parseCsvHeader(lines[0]);
  const idx = (name: string) => header.indexOf(name);
  const colNumero = idx("numero") >= 0 ? idx("numero") : idx("pratica");
  const colImporto = idx("importo");
  if (colNumero < 0 || colImporto < 0) {
    return { error: "Intestazione richiesta: numero;importo (opzionali: data;metodo;causale;modo). Separatore ; o ," };
  }

  const { mandanteId, perimetro, lotto, affidoIl, mandanteCodice } = contesto.ok;
  const { start: affidoStart, end: affidoEnd } = giornoAffidoRange(affidoIl);

  let created = 0;
  const errori: string[] = [];
  const praticaIdsOk: string[] = [];
  for (const [i, line] of lines.slice(1).entries()) {
    const cols = line.split(delim);    const numero = cols[colNumero]?.trim();
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
