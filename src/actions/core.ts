"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { praticaDbFromUser, nextNumeroPratica, type PraticaDbContext } from "@/lib/praticheRepo";
import { mandantiDbFromUser } from "@/lib/mandantiRepo";
import { usersDbFromUser } from "@/lib/usersRepo";
import { debitoriDbFromUser, debitoreRecapitoDb } from "@/lib/debitoriRepo";
import { garantiDbFromUser, garanteRecapitoDb } from "@/lib/garantiRepo";
import { fattureDbFromUser } from "@/lib/fattureRepo";
import { documentiDbFromUser } from "@/lib/documentiRepo";
import { createManyPianoRate, pianoRateDbFromUser } from "@/lib/pianoRateRepo";
import { attivitaDbFromUser, toggleFissaAttivita } from "@/lib/attivitaRepo";
import { aggiornaIncassoWithSideEffects, eliminaIncassoWithSideEffects, registraIncassoWithSideEffects } from "@/lib/incassiRepo";
import { createSession, clearSession, getCurrentUser } from "@/lib/auth";
import { assertCan, can, canClearCodiceScarico, canEditCodiceScaricoBk, canManageMandantePerimetri, mustChoosePostazioneAlLogin, type Role } from "@/lib/permissions";
import {
  canAccessPratica,
  parseDateOnly,
  praticaWhere,
  praticheStessoDebitoreIds,
  ripartiIncasso,
  writeAudit,
} from "@/lib/domain";
import { syncMessaggioAgenda, markMessaggiLetti } from "@/lib/memoAgenda";
import { messaggiInterniFromUser } from "@/lib/messaggiInterniRepo";
import { resolveTenantSlug } from "@/lib/praticheRepo";
import { formatMessaggioCollegaNota } from "@/lib/noteFormat";
import {
  calcolaProvvigione,
  isModoNonProvvigionabile,
  normalizeFatturaIncasso,
  normalizeModoIncasso,
  resolveProvvigionePercentuale,
  resolveProvvigionePercentualeLato,
} from "@/lib/provvigioni";
import {
  codiciScaricoBkOffPerPratica,
  codiciScaricoOperatoriEffettivi,
  codiciScaricoOperatoriPerPratica,
  isCodicePromessaOperatore,
  isCodiceScaricoOperatore,
  resolvePerimetroPratica,
} from "@/lib/mandantePerimetri";
import { CODICI_SCARICO } from "@/lib/scarico";
import { isCodiceScaricoFiltroToken } from "@/lib/filtriCodScarico";
import { requireWritablePermission, requireWritableUser } from "@/lib/guard";
import { STATI_TELEFONO } from "@/lib/statoTelefono";
import { assertPraticaLockHeld, assertPraticaNotLockedByOther, releaseAllUserLocks, lockScopeFromUser } from "@/lib/praticaLock";
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
  finalizePraticheImport,
  initPraticheImportBatch,
  processPraticheImportChunk,
  importPraticheChunkSize,
} from "@/lib/importPraticheBatch";
import { isMetodoIncassoValido } from "@/lib/metodoIncasso";
import {
  isCodiceScaricoConDettagliPagamento,
  statoDaCodiceScaricoBk,
} from "@/lib/scarico";
import { RUOLI_LAVORAZIONE } from "@/lib/praticaOrdine";
import { isPraticaChiusa } from "@/lib/praticaCollegata";

function fail(message: string): never {
  throw new Error(message);
}

async function assertCodiceScaricoOperatoreValido(
  praticaId: string,
  codice: string | null
) {
  if (!codice) return;
  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: {
      numeroMandante: true,
      mandante: { select: { perimetri: true } },
      importBatch: { select: { perimetro: true } },
    },
  });
  if (!pratica) fail("Pratica non valida");
  const codici = codiciScaricoOperatoriEffettivi(
    codiciScaricoOperatoriPerPratica(
      pratica.mandante?.perimetri ?? null,
      pratica.numeroMandante,
      pratica.importBatch?.perimetro
    )
  );
  if (!isCodiceScaricoOperatore(codice, codici)) {
    fail("Codice scarico non valido");
  }
}

async function assertCodiceScaricoBkValido(praticaId: string, codice: string | null) {
  if (!codice) return;
  if (!isCodiceScaricoFiltroToken(codice)) fail("Codice bk off non valido");
  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: {
      numeroMandante: true,
      mandante: { select: { perimetri: true } },
      importBatch: { select: { perimetro: true } },
    },
  });
  if (!pratica) fail("Pratica non valida");
  const bk = codiciScaricoBkOffPerPratica(
    pratica.mandante?.perimetri ?? null,
    pratica.numeroMandante,
    pratica.importBatch?.perimetro
  );
  const allowed = new Set([
    ...bk.map((c) => c.codice.trim().toUpperCase()),
    ...(bk.length ? [] : [...CODICI_SCARICO]),
  ]);
  if (allowed.size > 0 && !allowed.has(codice.trim().toUpperCase())) {
    fail("Codice bk off non valido per questo perimetro");
  }
}

/** Operatore/supervisor non possono svuotare un codice già impostato. */
async function assertCanClearCodiceScaricoSeNecessario(
  role: string,
  praticaId: string,
  nuovo: string | null,
  campo: "codiceScarico" | "codiceScaricoBk"
) {
  if (nuovo) return;
  if (canClearCodiceScarico(role)) return;
  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { codiceScarico: true, codiceScaricoBk: true },
  });
  const attuale =
    campo === "codiceScaricoBk"
      ? pratica?.codiceScaricoBk
      : pratica?.codiceScarico;
  if (attuale?.trim()) {
    fail(
      campo === "codiceScaricoBk"
        ? "Non puoi cancellare il codice bk off"
        : "Non puoi cancellare il codice scarico"
    );
  }
}

function isRuoloLavorazione(role: string) {
  return (RUOLI_LAVORAZIONE as readonly string[]).includes(role);
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await releaseAllUserLocks(user.id, lockScopeFromUser(user));
  }
  await clearSession();
  if (user) {
    await Promise.all([
      usersDbFromUser(user).update({ where: { id: user.id }, data: { lastLogoutAt: new Date() } }),
      writeAudit({ userId: user.id, action: "logout", entity: "user", entityId: user.id }),
    ]);
  }
  redirect("/login");
}

async function praticaModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return praticaDbFromUser(user);
}

async function mandanteModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return mandantiDbFromUser(user);
}

async function debitoreModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return debitoriDbFromUser(user);
}

async function recapitoModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return debitoreRecapitoDb({
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
  });
}

async function garanteModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return garantiDbFromUser(user);
}

async function garanteRecapitoModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return garanteRecapitoDb({
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
  });
}

async function fatturaModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return fattureDbFromUser(user);
}

async function documentoModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return documentiDbFromUser(user);
}

async function pianoRataModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return pianoRateDbFromUser(user);
}

async function attivitaModel() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessione richiesta");
  return attivitaDbFromUser(user);
}

async function nextNumero(ctx: PraticaDbContext) {
  return nextNumeroPratica(ctx);
}

async function assertPraticaWork(user: Awaited<ReturnType<typeof requireWritableUser>>, praticaId: string) {
  if (!(await canAccessPratica(user, praticaId))) fail("Pratica non visibile");
  if (!can(user, "pratiche:work")) fail("Operazione non consentita");
  await assertPraticaLockHeld(user, praticaId);
}

async function assertPraticaEditable(
  user: Awaited<ReturnType<typeof requireWritableUser>>,
  praticaId: string
) {
  if (!(await canAccessPratica(user, praticaId))) fail("Pratica non visibile");
  await assertPraticaLockHeld(user, praticaId);
}

async function assertGaranteOnPratica(praticaId: string, garanteId: string) {
  const garante = await (await garanteModel()).findFirst({
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

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const telefono = String(formData.get("telefono") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;

  await (await debitoreModel()).update({
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

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const count = await (await recapitoModel()).count({
    where: { debitoreId: pratica.debitoreId, tipo },
  });

  await (await recapitoModel()).create({
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

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const recapito = await (await recapitoModel()).findFirst({
    where: { id: recapitoId, debitoreId: pratica.debitoreId },
  });
  if (!recapito) fail("Recapito non trovato");

  await (await recapitoModel()).delete({ where: { id: recapitoId } });

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

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { debitoreId: true },
  });
  if (!pratica) fail("Pratica non trovata");

  const recapito = await (await recapitoModel()).findFirst({
    where: { id: recapitoId, debitoreId: pratica.debitoreId },
  });
  if (!recapito) fail("Recapito non trovato");

  await (await recapitoModel()).update({
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

  await (await garanteModel()).update({
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

  const count = await (await garanteRecapitoModel()).count({
    where: { garanteId, tipo },
  });

  await (await garanteRecapitoModel()).create({
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

  const recapito = await (await garanteRecapitoModel()).findFirst({
    where: { id: recapitoId, garanteId },
  });
  if (!recapito) fail("Recapito non trovato");

  await (await garanteRecapitoModel()).delete({ where: { id: recapitoId } });

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

  const recapito = await (await garanteRecapitoModel()).findFirst({
    where: { id: recapitoId, garanteId },
  });
  if (!recapito) fail("Recapito non trovato");

  await (await garanteRecapitoModel()).update({
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
      await (await garanteModel()).update({
        where: { id: garanteId },
        data: { telefonoStato: stato },
      });
    } else {
      const recapito = await (await garanteRecapitoModel()).findFirst({
        where: { id: target, garanteId, tipo: "TELEFONO" },
      });
      if (!recapito) fail("Recapito non trovato");
      await (await garanteRecapitoModel()).update({
        where: { id: target },
        data: { stato },
      });
    }
  } else {
    const pratica = await (await praticaModel()).findUnique({
      where: { id: praticaId },
      select: { debitoreId: true },
    });
    if (!pratica) fail("Pratica non trovata");

    if (target === "principale") {
      await (await debitoreModel()).update({
        where: { id: pratica.debitoreId },
        data: { telefonoStato: stato },
      });
    } else {
      const recapito = await (await recapitoModel()).findFirst({
        where: { id: target, debitoreId: pratica.debitoreId, tipo: "TELEFONO" },
      });
      if (!recapito) fail("Recapito non trovato");
      await (await recapitoModel()).update({
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

  await (await attivitaModel()).create({
    data: {
      praticaId,
      userId: user.id,
      tipo: "NOTA",
      nota,
    },
  });

  const now = new Date();
  await (await praticaModel()).update({
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
    hasDettagliPagamento: boolean;
    isPromessa: boolean;
    promessaAt?: Date;
    promessaImporto: number | null;
    promessaMetodo: string | null;
  },
  opts?: { ultimaLavorazione?: boolean }
) {
  const praticaCorrente = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { codiceScarico: true },
  });
  const codiceScaricoCambiato =
    (praticaCorrente?.codiceScarico || null) !== (input.codiceScarico || null);
  const now = new Date();

  // Il codice scarico operatore non modifica Sit. affido (chiusure = solo bk off).
  await (await praticaModel()).update({
    where: { id: praticaId },
    data: {
      codiceScarico: input.codiceScarico,
      ...(codiceScaricoCambiato ? { codiceScaricoAt: now } : {}),
      ...(input.isPromessa ? { esitoContatto: "PROMESSA" } : {}),
      ...(input.hasDettagliPagamento && input.promessaAt
        ? { promessaAt: input.promessaAt }
        : {}),
      promessaImporto: input.hasDettagliPagamento ? input.promessaImporto : null,
      promessaMetodo: input.hasDettagliPagamento ? input.promessaMetodo : null,
      updatedAt: now,
      ...(opts?.ultimaLavorazione ? { ultimaLavorazioneAt: now } : {}),
    },
  });
}

async function applyCodiceScaricoBkPratica(
  praticaId: string,
  codiceScaricoBk: string | null
) {
  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { assegnatarioId: true, stato: true, codiceScaricoBk: true },
  });
  const stato = statoDaCodiceScaricoBk(codiceScaricoBk, {
    assegnatarioId: pratica?.assegnatarioId,
    statoCorrente: pratica?.stato,
  });
  const bkCambiato =
    (pratica?.codiceScaricoBk || null) !== (codiceScaricoBk || null);
  const now = new Date();
  await (await praticaModel()).update({
    where: { id: praticaId },
    data: {
      codiceScaricoBk,
      ...(bkCambiato ? { codiceScaricoBkAt: now } : {}),
      stato,
      updatedAt: now,
    },
  });
}

/** Salva nota + codice scarico (+ promessa) sulla pratica e propaga sulle collegate in lavorazione. */
export async function salvaNotaServizioPraticaAction(formData: FormData) {
  const user = await requireWritableUser();
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);

  const main = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    select: { tenantId: true, mandanteId: true },
  });
  if (!main || main.tenantId !== user.tenantId) fail("Pratica non valida");

  const nota = String(formData.get("nota") || "").trim();
  const codScaricoRaw = String(formData.get("codScarico") || "").trim();
  const codiceScarico = codScaricoRaw || null;
  await assertCodiceScaricoOperatoreValido(praticaId, codiceScarico);
  await assertCanClearCodiceScaricoSeNecessario(
    user.role,
    praticaId,
    codiceScarico,
    "codiceScarico"
  );

  const canBk = canEditCodiceScaricoBk(user.role);
  const aggiornaBk = canBk && formData.has("codScaricoBk");
  const codiceScaricoBk = aggiornaBk
    ? String(formData.get("codScaricoBk") || "")
        .trim()
        .toUpperCase() || null
    : undefined;
  if (aggiornaBk) {
    await assertCodiceScaricoBkValido(praticaId, codiceScaricoBk ?? null);
    await assertCanClearCodiceScaricoSeNecessario(
      user.role,
      praticaId,
      codiceScaricoBk ?? null,
      "codiceScaricoBk"
    );
  }

  const hasDettagliPagamento = Boolean(
    codiceScarico && isCodiceScaricoConDettagliPagamento(codiceScarico)
  );
  const isPromessa = Boolean(codiceScarico && isCodicePromessaOperatore(codiceScarico));
  const promessaAt = hasDettagliPagamento
    ? parseDateOnly(String(formData.get("promessaAt") || ""))
    : undefined;
  if (hasDettagliPagamento && !promessaAt) {
    fail("Inserisci la data della promessa di pagamento");
  }
  const promessaImportoRaw = String(formData.get("promessaImporto") || "").trim();
  let promessaImporto: number | null = null;
  if (hasDettagliPagamento && promessaImportoRaw) {
    promessaImporto = Number(promessaImportoRaw.replace(",", "."));
    if (Number.isNaN(promessaImporto)) {
      fail("Importo promessa non valido");
    }
  }
  const promessaMetodoRaw = String(formData.get("promessaMetodo") || "").trim();
  let promessaMetodo: string | null = null;
  if (hasDettagliPagamento && promessaMetodoRaw) {
    if (!isMetodoIncassoValido(promessaMetodoRaw)) {
      fail("Modalità di pagamento non valida");
    }
    promessaMetodo = promessaMetodoRaw;
  }

  const scaricoInput = {
    codiceScarico,
    hasDettagliPagamento,
    isPromessa,
    promessaAt: promessaAt ?? undefined,
    promessaImporto,
    promessaMetodo,
  };
  const lavorazione = isRuoloLavorazione(user.role);

  if (nota) {
    await (await attivitaModel()).create({
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

  if (aggiornaBk) {
    await applyCodiceScaricoBkPratica(praticaId, codiceScaricoBk ?? null);
  }

  const collegateIds = (
    await praticheStessoDebitoreIds(praticaId, "aperta", {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug ?? user.tenantId,
    })
  ).filter((id) => id !== praticaId);

  const collegate = collegateIds.length
    ? await (await praticaModel()).findMany({
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
      await assertPraticaNotLockedByOther(user, collegata.id);
    } catch {
      continue;
    }

    await (await attivitaModel()).create({
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
    if (aggiornaBk) {
      await applyCodiceScaricoBkPratica(collegata.id, codiceScaricoBk ?? null);
    }
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
      await assertPraticaNotLockedByOther(user, praticaId);
    } catch {
      saltate.push(praticaId);
      continue;
    }

    if (fissata) {
      await (await attivitaModel()).updateMany({
        where: { praticaId, fissata: true },
        data: { fissata: false },
      });
    }

    await (await attivitaModel()).create({
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
    await (await praticaModel()).update({
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
  const attivita = await (await attivitaModel()).findUnique({
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

  await (await attivitaModel()).update({
    where: { id: attivitaId },
    data: { nota },
  });

  await (await praticaModel()).update({
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
  const attivita = await (await attivitaModel()).findUnique({
    where: { id: attivitaId },
    select: { id: true, praticaId: true, fissata: true, bloccata: true },
  });
  if (!attivita) fail("Nota non trovata");
  await assertPraticaEditable(user, attivita.praticaId);

  if (attivita.bloccata && !can(user, "pratiche:nota-massiva")) {
    fail("Questa nota è bloccata: non puoi modificare il fissaggio");
  }

  const next = !attivita.fissata;
  await toggleFissaAttivita(
    { tenantId: user.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId },
    attivita.id,
    attivita.praticaId,
    next
  );

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
  if (aggiornaCodice) {
    await assertCodiceScaricoOperatoreValido(praticaId, codiceScarico);
    await assertCanClearCodiceScaricoSeNecessario(
      user.role,
      praticaId,
      codiceScarico,
      "codiceScarico"
    );
  }

  const isPromessa =
    (aggiornaCodice && codiceScarico && isCodicePromessaOperatore(codiceScarico)) ||
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

  const praticaCorrente = aggiornaCodice
    ? await (await praticaModel()).findUnique({
        where: { id: praticaId },
        select: { codiceScarico: true },
      })
    : null;
  const codiceScaricoCambiato =
    aggiornaCodice &&
    (praticaCorrente?.codiceScarico || null) !== (codiceScarico || null);

  await (await praticaModel()).update({
    where: { id: praticaId },
    data: {
      ...(aggiornaEsito ? { esitoContatto } : {}),
      ...(aggiornaTipo ? { tipoContatto } : {}),
      ...(aggiornaMemo ? { memoAt } : {}),
      ...(aggiornaCodice
        ? {
            codiceScarico,
            ...(codiceScaricoCambiato ? { codiceScaricoAt: new Date() } : {}),
            // Sit. affido non dipende dal codice operatore (solo bk off / incasso).
            ...(codiceScarico && isCodicePromessaOperatore(codiceScarico)
              ? { esitoContatto: "PROMESSA" }
              : {}),
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
    await syncMessaggioAgenda({ praticaId, userId: user.id, tenantId: user.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId, memoAt });
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

  await (await praticaModel()).update({
    where: { id: praticaId },
    data: { memoAt },
  });
  await syncMessaggioAgenda({
    praticaId,
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    memoAt,
    nota: nota || null,
  });

  if (nota) {
    await (await attivitaModel()).create({
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
      await (await praticaModel()).update({
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

  await (await praticaModel()).update({
    where: { id: praticaId },
    data: { memoAt: null },
  });
  await markMessaggiLetti(praticaId, user.tenantId, user.tenantSlug ?? user.tenantId);

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

  const pratica = await (await praticaModel()).findUnique({
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

  await (await praticaModel()).update({
    where: { id: praticaId },
    data: { memoAt: next },
  });
  await syncMessaggioAgenda({ praticaId, userId: user.id, tenantId: user.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId, memoAt: next });

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

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    include: { debitore: true, mandante: true },
  });
  if (!pratica) fail("Pratica non trovata");

  await syncMessaggioAgenda({
    praticaId,
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    memoAt: pratica.memoAt,
  });
  await markMessaggiLetti(praticaId, user.tenantId, user.tenantSlug ?? user.tenantId);
  await (await praticaModel()).update({
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
    destinatari = await usersDbFromUser(user).findMany({
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
    const dest = await usersDbFromUser(user).findFirst({
      where: { id: toUserId, tenantId: user.tenantId, active: true },
      select: { id: true, name: true },
    });
    if (!dest) fail("Destinatario non trovato");
    destinatari = [dest];
  }

  await messaggiInterniFromUser(user).createMany(resolveTenantSlug(user), user.tenantId,
    destinatari.map((d) => ({
      fromUserId: user.id,
      toUserId: d.id,
      praticaId: collegata ? praticaId : null,
      testo,
    }))
  );

  if (collegata && praticaId) {
    await (await attivitaModel()).create({
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
    await (await praticaModel()).update({
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
  const repo = messaggiInterniFromUser(user);
  const tenantSlug = resolveTenantSlug(user);
  const msg = await repo.getById(tenantSlug, user.tenantId, id);
  if (!msg || msg.toUserId !== user.id) fail("Messaggio non trovato");
  await repo.markLetto(tenantSlug, user.tenantId, id, true);
  revalidatePath("/agenda");
  revalidatePath("/messaggi");
  if (msg.praticaId) revalidatePath(`/pratiche/${msg.praticaId}`);
}

export async function updateMessaggioInternoAction(formData: FormData) {
  const user = await requireWritableUser();
  const id = String(formData.get("messageId") || "");
  const testo = String(formData.get("testo") || "").trim();
  if (!testo) fail("Scrivi il messaggio");
  const repo = messaggiInterniFromUser(user);
  const tenantSlug = resolveTenantSlug(user);
  const msg = await repo.getById(tenantSlug, user.tenantId, id);
  if (!msg || msg.fromUserId !== user.id) fail("Messaggio non trovato");
  await repo.updateTesto(tenantSlug, user.tenantId, id, testo);
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
  const repo = messaggiInterniFromUser(user);
  const tenantSlug = resolveTenantSlug(user);
  const msg = await repo.getById(tenantSlug, user.tenantId, id);
  if (!msg || msg.fromUserId !== user.id) fail("Messaggio non trovato");
  await repo.delete(tenantSlug, user.tenantId, id);
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

export async function updatePraticaStatoAction(_formData: FormData) {
  await requireWritablePermission("pratiche:update:stato");
  fail(
    "Lo stato pratica è automatico (nuova / in lavorazione / scaduta) e non è modificabile."
  );
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

function parseRipartoManuale(input: {
  capitale?: number;
  interessi?: number;
  spese?: number;
  speseRec?: number;
}): { capitale: number; interessi: number; spese: number; speseRec: number; usato: number } | null {
  if (
    input.capitale == null &&
    input.interessi == null &&
    input.spese == null &&
    input.speseRec == null
  ) {
    return null;
  }
  const capitale = Math.max(0, Number(input.capitale) || 0);
  const interessi = Math.max(0, Number(input.interessi) || 0);
  const spese = Math.max(0, Number(input.spese) || 0);
  const speseRec = Math.max(0, Number(input.speseRec) || 0);
  return {
    capitale,
    interessi,
    spese,
    speseRec,
    usato: capitale + interessi + spese + speseRec,
  };
}

async function registraIncassoSuPratica(input: {
  userId: string;
  praticaId: string;
  importo: number;
  metodo?: string;
  causale?: string;
  fattura?: string;
  modo?: string;
  data?: Date;
  dataScadenza?: Date | null;
  capitale?: number;
  interessi?: number;
  spese?: number;
  speseRec?: number;
}) {
  const { praticaId, userId } = input;
  if (input.importo <= 0) fail("Importo non valido");
  const pratica = await (await praticaModel()).findUnique({
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
      speseRec: acc.speseRec + (i.speseRec ?? 0),
    }),
    { capitale: 0, interessi: 0, spese: 0, speseRec: 0 }
  );
  const manuale = parseRipartoManuale(input);
  let split = manuale ?? ripartiIncasso(input.importo, pratica, gia);
  if (manuale) {
    if (Math.abs(manuale.usato - input.importo) > 0.02) {
      fail("Il riparto (capitale/mora/spese) non coincide con l'importo totale");
    }
    split = manuale;
  }
  const nuovoResiduo = Math.max(0, pratica.residuo - split.usato);
  const user = await getCurrentUser();
  if (!user) fail("Sessione richiesta");

  const fattura = normalizeFatturaIncasso(input.fattura);
  const modo = normalizeModoIncasso(input.modo);
  const nonProvv = isModoNonProvvigionabile(modo);

  let provvigioneInput: {
    praticaId: string;
    operatoreId: string;
    baseImporto: number;
    percentuale: number;
    importo: number;
  } | null = null;
  if (pratica.assegnatarioId) {
    if (nonProvv) {
      // Riga in lista con importo 0: visibile come "np", esclusa dal calcolo.
      provvigioneInput = {
        praticaId,
        operatoreId: pratica.assegnatarioId,
        baseImporto: split.usato,
        percentuale: 0,
        importo: 0,
      };
    } else {
      const metodo = input.metodo || "bonifico";
      const perimetro = resolvePerimetroPratica(
        pratica.mandante.perimetri,
        pratica.numeroMandante
      );
      const pct = perimetro
        ? resolveProvvigionePercentualeLato(perimetro.pagata, metodo, pratica.codiceScarico)
        : resolveProvvigionePercentuale(pratica.mandante, metodo);
      const prov = calcolaProvvigione(split.usato, pct);
      provvigioneInput = {
        praticaId,
        operatoreId: pratica.assegnatarioId,
        baseImporto: prov.baseImporto,
        percentuale: prov.percentuale,
        importo: prov.importo,
      };
    }
  }

  await registraIncassoWithSideEffects(
    { tenantId: pratica.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId },
    {
      incasso: {
        praticaId,
        userId,
        importo: split.usato,
        capitale: split.capitale,
        interessi: split.interessi,
        spese: split.spese,
        speseRec: split.speseRec ?? 0,
        metodo: input.metodo || "bonifico",
        modo,
        causale: input.causale || "",
        fattura,
        data: input.data || new Date(),
        dataScadenza: input.dataScadenza ?? null,
      },
      provvigione: provvigioneInput,
      praticaUpdate: {
        residuo: nuovoResiduo,
        stato: statoDopoResiduo(nuovoResiduo, pratica.stato),
      },
    }
  );

  await writeAudit({
    userId,
    action: "incasso",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${split.usato.toFixed(2)} € · ${modo}${fattura ? ` · fattura ${fattura}` : ""}`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/incassi`);
  revalidatePath(`/pratiche/${praticaId}/estratto`);
  revalidatePath(`/pratiche/${praticaId}/fatture`);
  revalidatePath("/provigioni");
  return split.usato;
}

function statoDopoResiduo(residuo: number, statoAttuale: string) {
  if (residuo <= 0.009) return "INCASSO";
  if (statoAttuale === "INCASSO") return "IN_LAVORAZIONE";
  return statoAttuale;
}

function buildProvvigioneIncasso(input: {
  praticaId: string;
  assegnatarioId: string | null;
  codiceScarico: string | null;
  numeroMandante: string | null;
  mandante: {
    provvigionePerc?: number | null;
    provvigioniMetodo?: string | null;
    perimetri?: string | null;
  };
  metodo: string;
  modo: string;
  baseImporto: number;
}) {
  if (!input.assegnatarioId) return null;
  if (isModoNonProvvigionabile(input.modo)) {
    return {
      praticaId: input.praticaId,
      operatoreId: input.assegnatarioId,
      baseImporto: input.baseImporto,
      percentuale: 0,
      importo: 0,
    };
  }
  const perimetro = resolvePerimetroPratica(
    input.mandante.perimetri,
    input.numeroMandante
  );
  const pct = perimetro
    ? resolveProvvigionePercentualeLato(
        perimetro.pagata,
        input.metodo,
        input.codiceScarico
      )
    : resolveProvvigionePercentuale(input.mandante, input.metodo);
  const prov = calcolaProvvigione(input.baseImporto, pct);
  return {
    praticaId: input.praticaId,
    operatoreId: input.assegnatarioId,
    baseImporto: prov.baseImporto,
    percentuale: prov.percentuale,
    importo: prov.importo,
  };
}

export async function addIncassoAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const hasRiparto =
    formData.has("capitale") ||
    formData.has("interessi") ||
    formData.has("spese") ||
    formData.has("speseRec");
  await registraIncassoSuPratica({
    userId: user.id,
    praticaId,
    importo: Number(formData.get("importo") || 0),
    metodo: String(formData.get("metodo") || "bonifico"),
    causale: String(formData.get("causale") || "").trim(),
    fattura: String(formData.get("fattura") || "").trim(),
    modo: String(formData.get("modo") || "ve").trim() || "ve",
    data: parseDateOnly(String(formData.get("data") || "")) || new Date(),
    dataScadenza: parseDateOnly(String(formData.get("dataScadenza") || "")),
    ...(hasRiparto
      ? {
          capitale: Number(formData.get("capitale") || 0),
          interessi: Number(formData.get("interessi") || 0),
          spese: Number(formData.get("spese") || 0),
          speseRec: Number(formData.get("speseRec") || 0),
        }
      : {}),
  });
  revalidatePath("/provigioni");
  revalidatePath("/");
}

export async function updateIncassoAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:update");
  const praticaId = String(formData.get("praticaId") || "");
  const incassoId = String(formData.get("incassoId") || "");
  if (!incassoId) fail("Incasso non indicato");
  await assertPraticaEditable(user, praticaId);

  const importoRaw = Number(formData.get("importo") || 0);
  if (importoRaw <= 0) fail("Importo non valido");

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    include: {
      incassi: true,
      mandante: { select: { provvigionePerc: true, provvigioniMetodo: true, perimetri: true } },
    },
  });
  if (!pratica) fail("Pratica non trovata");
  const existing = pratica.incassi.find((i) => i.id === incassoId);
  if (!existing) fail("Incasso non trovato");

  const altri = pratica.incassi.filter((i) => i.id !== incassoId);
  const gia = altri.reduce(
    (acc, i) => ({
      capitale: acc.capitale + i.capitale,
      interessi: acc.interessi + i.interessi,
      spese: acc.spese + i.spese,
    }),
    { capitale: 0, interessi: 0, spese: 0 }
  );
  const split = ripartiIncasso(importoRaw, pratica, gia);
  const nuovoResiduo = Math.max(0, pratica.residuo + existing.importo - split.usato);
  const metodo = String(formData.get("metodo") || existing.metodo || "bonifico");
  const fattura = normalizeFatturaIncasso(String(formData.get("fattura") || "").trim());
  const modo = normalizeModoIncasso(String(formData.get("modo") || existing.modo || "ve"));
  const causale = String(formData.get("causale") || "").trim();
  const data =
    parseDateOnly(String(formData.get("data") || "")) ||
    (existing.data instanceof Date ? existing.data : new Date(existing.data));
  const dataScadenza = parseDateOnly(String(formData.get("dataScadenza") || ""));

  const provvigioneInput = buildProvvigioneIncasso({
    praticaId,
    assegnatarioId: pratica.assegnatarioId,
    codiceScarico: pratica.codiceScarico,
    numeroMandante: pratica.numeroMandante,
    mandante: pratica.mandante,
    metodo,
    modo,
    baseImporto: split.usato,
  });

  await aggiornaIncassoWithSideEffects(
    { tenantId: pratica.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId },
    incassoId,
    {
      incasso: {
        importo: split.usato,
        capitale: split.capitale,
        interessi: split.interessi,
        spese: split.spese,
        metodo,
        modo,
        causale,
        fattura,
        data,
        dataScadenza: dataScadenza ?? existing.dataScadenza ?? null,
      },
      provvigione: provvigioneInput,
      praticaUpdate: {
        residuo: nuovoResiduo,
        stato: statoDopoResiduo(nuovoResiduo, pratica.stato),
      },
    }
  );

  await writeAudit({
    userId: user.id,
    action: "incasso.update",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${incassoId} → ${split.usato.toFixed(2)} € · ${modo}${fattura ? ` · fattura ${fattura}` : ""}`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/incassi`);
  revalidatePath(`/pratiche/${praticaId}/estratto`);
  revalidatePath(`/pratiche/${praticaId}/fatture`);
  revalidatePath("/provigioni");
  revalidatePath("/");
}

export async function deleteIncassoAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:update");
  const praticaId = String(formData.get("praticaId") || "");
  const incassoId = String(formData.get("incassoId") || "");
  if (!incassoId) fail("Incasso non indicato");
  await assertPraticaEditable(user, praticaId);

  const pratica = await (await praticaModel()).findUnique({
    where: { id: praticaId },
    include: { incassi: true },
  });
  if (!pratica) fail("Pratica non trovata");
  const existing = pratica.incassi.find((i) => i.id === incassoId);
  if (!existing) fail("Incasso non trovato");

  const nuovoResiduo = Math.max(0, pratica.residuo + existing.importo);

  await eliminaIncassoWithSideEffects(
    { tenantId: pratica.tenantId, tenantSlug: user.tenantSlug ?? user.tenantId },
    incassoId,
    {
      praticaUpdate: {
        residuo: nuovoResiduo,
        stato: statoDopoResiduo(nuovoResiduo, pratica.stato),
      },
    }
  );

  await writeAudit({
    userId: user.id,
    action: "incasso.delete",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `${incassoId} · ${existing.importo.toFixed(2)} €`,
  });
  revalidatePath(`/pratiche/${praticaId}`);
  revalidatePath(`/pratiche/${praticaId}/incassi`);
  revalidatePath(`/pratiche/${praticaId}/estratto`);
  revalidatePath(`/pratiche/${praticaId}/fatture`);
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

  await (await fatturaModel()).create({
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
  const pratica = await (await praticaModel()).findUnique({ where: { id: praticaId } });
  if (!pratica) fail("Pratica non trovata");
  if (nRate < 2 || nRate > 36 || !start) {
    fail("Indica da 2 a 36 rate e la prima scadenza");
  }
  const quota = Math.round((pratica.residuo / nRate) * 100) / 100;
  await (await pianoRataModel()).deleteMany({ where: { praticaId } });
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
  await createManyPianoRate(
    {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug ?? user.tenantId,
    },
    rateData
  );
  await (await praticaModel()).update({
    where: { id: praticaId },
    data: {
      codiceScarico: "LPP",
      // LPP = codice scarico; il ciclo di vita resta in lavorazione
      stato: pratica.stato === "NUOVA" ? "IN_LAVORAZIONE" : pratica.stato === "PIANO" ? "IN_LAVORAZIONE" : pratica.stato,
    },
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

/** Piano da saldo e stralcio (residuo negoziato, 1–10 rate come CreditCalc). */
export async function createStralcioPianoAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const praticaId = String(formData.get("praticaId") || "");
  await assertPraticaEditable(user, praticaId);
  const nRate = Number(formData.get("nRate") || 0);
  const start = String(formData.get("primaScadenza") || "");
  const importoResiduo = Number(
    String(formData.get("importoResiduo") || "").replace(",", ".")
  );
  const metodoPagamento = String(formData.get("metodoPagamento") || "").trim();
  const percentualeStralcio = String(formData.get("percentualeStralcio") || "").trim();
  const pratica = await (await praticaModel()).findUnique({ where: { id: praticaId } });
  if (!pratica) fail("Pratica non trovata");
  if (nRate < 1 || nRate > 10 || !start) {
    fail("Indica da 1 a 10 rate e la data della prima rata");
  }
  if (!Number.isFinite(importoResiduo) || importoResiduo <= 0) {
    fail("Residuo da pagare non valido");
  }
  if (!metodoPagamento) fail("Seleziona la modalità di pagamento");

  const totalCents = Math.round(importoResiduo * 100);
  const baseCents = Math.floor(totalCents / nRate);
  const remainder = totalCents - baseCents * (nRate - 1);
  const startDate = new Date(`${start}T12:00:00`);
  if (Number.isNaN(startDate.getTime())) fail("Data prima rata non valida");

  function addMonthsSameCalendarDay(base: Date, months: number) {
    const day = base.getDate();
    const d = new Date(base.getFullYear(), base.getMonth() + months, 1, 12, 0, 0);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d;
  }

  await (await pianoRataModel()).deleteMany({ where: { praticaId } });
  const rateData = Array.from({ length: nRate }, (_, i) => {
    const cents = i === nRate - 1 ? remainder : baseCents;
    return {
      praticaId,
      numeroRata: i + 1,
      importo: cents / 100,
      scadenza: addMonthsSameCalendarDay(startDate, i),
    };
  });
  await createManyPianoRate(
    {
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug ?? user.tenantId,
    },
    rateData
  );
  await (await praticaModel()).update({
    where: { id: praticaId },
    data: {
      codiceScarico: "LPP",
      stato: pratica.stato === "NUOVA" || pratica.stato === "PIANO" ? "IN_LAVORAZIONE" : pratica.stato,
    },
  });
  await writeAudit({
    userId: user.id,
    action: "stralcio",
    entity: "pratica",
    entityId: praticaId,
    dettaglio: `residuo ${importoResiduo} · ${nRate} rate · ${metodoPagamento}${
      percentualeStralcio ? ` · stralcio ${percentualeStralcio}%` : ""
    }`,
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
  await (await documentoModel()).create({ data: { praticaId, nome, tipo } });
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
  const created = await (await mandanteModel()).create({
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

  const existing = await (await mandanteModel()).findFirst({
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

  await (await mandanteModel()).update({
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

  const existing = await (await mandanteModel()).findFirst({
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

  await (await mandanteModel()).delete({ where: { id } });

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
  const created = await usersDbFromUser(actor).create({
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
  const contesto = await parseImportContesto(formData, user.tenantId, user.tenantSlug ?? user.tenantId);
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

  const ctx = await initPraticheImportBatch({
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    userId: user.id,
    userName: user.name,
    mandanteId,
    mandanteCodice,
    perimetro,
    lotto,
    affidoIl,
    scadenzaMandato,
    fileName,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let maxScadenzaCsv: Date | null = null;

  const chunkSize = importPraticheChunkSize();
  for (let i = 1; i < lines.length; i += chunkSize) {
    const chunkLines = lines.slice(i, i + chunkSize);
    const res = await processPraticheImportChunk({
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug ?? user.tenantId,
      ctx,
      header,
      delim,
      lines: chunkLines,
    });
    created += res.created;
    updated += res.updated;
    skipped += res.skipped;
    if (res.maxScadenza) {
      const d = new Date(res.maxScadenza);
      if (!maxScadenzaCsv || d.getTime() > maxScadenzaCsv.getTime()) maxScadenzaCsv = d;
    }
  }

  const { imported, totale } = await finalizePraticheImport({
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug ?? user.tenantId,
    userId: user.id,
    ctx,
    totals: { created, updated, skipped },
    maxScadenzaCsv,
  });

  revalidatePath("/pratiche");
  revalidatePath("/import");
  if (imported === 0) {
    return {
      error: `Nessuna pratica importata (${skipped} righe saltate). Controlla che il CSV abbia la colonna «nome» e il separatore ; o ,`,
    };
  }
  return {
    ok: ctx.isIntegrazione
      ? `Integrazione completata sul lotto ${lotto}.`
      : `Import completato sul lotto ${lotto}.`,
    importSummary: {
      isIntegrazione: ctx.isIntegrazione,
      lotto,
      mandanteCodice,
      perimetro,
      created,
      updated,
      skipped,
      totale,
    },
  };
}

export async function importIncassiCsvAction(formData: FormData) {
  const user = await requireWritablePermission("incassi:create");
  const contesto = await parseImportContesto(formData, user.tenantId, user.tenantSlug ?? user.tenantId);
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
    const pratica = await (await praticaModel()).findFirst({
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
      tenantSlug: user.tenantSlug ?? user.tenantId,
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
