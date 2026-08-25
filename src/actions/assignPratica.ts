"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canAccessPratica, writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import { parseTipoAffido, dividePraticheEquamente, validaAffidoPratica, titolarePratica, type TipoAffido } from "@/lib/affido";
import { assertPraticaNotLockedByOther } from "@/lib/praticaLock";
import { operatorSigla } from "@/lib/noteFormat";
import type { SessionUser } from "@/lib/permissions";

function fail(message: string): never {
  throw new Error(message);
}

async function assertPuoAffidareA(user: SessionUser, assegnatarioId: string | null) {
  if (user.role === "SUPERVISOR" && assegnatarioId) {
    const op = await prisma.user.findUnique({ where: { id: assegnatarioId } });
    if (!op || (op.supervisorId !== user.id && op.id !== user.id)) {
      fail("Puoi affidare solo al tuo team");
    }
  }
}

async function assegnaPratica(
  user: SessionUser,
  praticaId: string,
  assegnatarioId: string | null,
  tipo: TipoAffido,
  titolareEsplicito?: string | null
) {
  const pratica = await prisma.pratica.findUnique({ where: { id: praticaId } });
  if (!pratica) fail("Pratica non trovata");
  if (!(await canAccessPratica(user, praticaId)) && user.role !== "ADMIN") {
    fail("Non puoi assegnare questa pratica");
  }
  await assertPraticaNotLockedByOther(user.id, praticaId);

  const err = validaAffidoPratica(pratica, tipo, assegnatarioId, titolareEsplicito);
  if (err) fail(err);

  const titolareCorrente = titolarePratica(pratica, titolareEsplicito);

  if (tipo === "ripristina") {
    await prisma.pratica.update({
      where: { id: praticaId },
      data: { assegnatarioId: titolareCorrente },
    });
    await writeAudit({
      userId: user.id,
      action: "assign",
      entity: "pratica",
      entityId: praticaId,
      dettaglio: `ripristina titolare ${titolareCorrente}`,
    });
    revalidatePath(`/pratiche/${praticaId}`);
    return;
  }

  if (!assegnatarioId) {
    await prisma.pratica.update({
      where: { id: praticaId },
      data: {
        assegnatarioId: null,
        operatoreTitolareId: null,
        stato: "NUOVA",
      },
    });
    await writeAudit({
      userId: user.id,
      action: "assign",
      entity: "pratica",
      entityId: praticaId,
      dettaglio: "nessuno",
    });
    revalidatePath(`/pratiche/${praticaId}`);
    return;
  }

  if (tipo === "temporaneo") {
    await prisma.pratica.update({
      where: { id: praticaId },
      data: {
        assegnatarioId,
        operatoreTitolareId: titolareCorrente,
        stato: pratica.stato === "NUOVA" ? "AFFIDATA" : pratica.stato,
      },
    });
    await writeAudit({
      userId: user.id,
      action: "assign",
      entity: "pratica",
      entityId: praticaId,
      dettaglio: `temporaneo ${assegnatarioId} · titolare ${titolareCorrente}`,
    });
  } else {
    await prisma.pratica.update({
      where: { id: praticaId },
      data: {
        assegnatarioId,
        operatoreTitolareId: assegnatarioId,
        stato: pratica.stato === "NUOVA" ? "AFFIDATA" : pratica.stato,
      },
    });
    await writeAudit({
      userId: user.id,
      action: "assign",
      entity: "pratica",
      entityId: praticaId,
      dettaglio: `definitivo ${assegnatarioId}`,
    });
  }
  revalidatePath(`/pratiche/${praticaId}`);
}

function revalidateListe() {
  revalidatePath("/pratiche");
  revalidatePath("/affidi");
}

function titolareDaForm(formData: FormData) {
  const raw = String(formData.get("titolareId") || "").trim();
  return raw || null;
}

export async function assignPraticaAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:assign");
  const praticaId = String(formData.get("praticaId") || "");
  const tipo = parseTipoAffido(String(formData.get("tipoAffido") || ""));
  const titolareId = titolareDaForm(formData);
  const assegnatarioId =
    tipo === "ripristina"
      ? null
      : String(formData.get("assegnatarioId") || "") || null;
  if (tipo !== "ripristina") await assertPuoAffidareA(user, assegnatarioId);
  if (tipo === "temporaneo" && titolareId) await assertPuoAffidareA(user, titolareId);
  await assegnaPratica(user, praticaId, assegnatarioId, tipo, titolareId);
  revalidateListe();
}

export async function assignPraticheMassiveAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:assign");
  const ids = [...new Set(formData.getAll("praticaId").map(String).filter(Boolean))];
  const tipo = parseTipoAffido(String(formData.get("tipoAffido") || ""));
  const titolareId = titolareDaForm(formData);
  const assegnatarioId =
    tipo === "ripristina"
      ? null
      : String(formData.get("assegnatarioId") || "") || null;
  if (!ids.length) fail("Seleziona almeno una pratica");
  if (tipo !== "ripristina" && !assegnatarioId) fail("Seleziona un operatore");
  if (ids.length > 200) fail("Massimo 200 pratiche per affido massivo");
  if (tipo !== "ripristina") await assertPuoAffidareA(user, assegnatarioId);
  if (tipo === "temporaneo" && titolareId) await assertPuoAffidareA(user, titolareId);

  const errors: string[] = [];
  for (const praticaId of ids) {
    try {
      await assegnaPratica(user, praticaId, assegnatarioId, tipo, titolareId);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "errore");
    }
  }
  revalidateListe();
  if (errors.length) {
    const unici = [...new Set(errors)];
    fail(
      errors.length === ids.length
        ? unici[0]!
        : `Affido parziale: ${ids.length - errors.length} ok, ${errors.length} errori. ${unici.slice(0, 2).join(" · ")}`
    );
  }
}

function parseCodiciRaw(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((c) => c.trim().toUpperCase().replace(/^\.+/, ""))
        .filter(Boolean)
    ),
  ];
}

function codiceOperatore(op: { name: string; acronimo: string | null }) {
  return (op.acronimo?.trim() || operatorSigla(op.name)).toUpperCase();
}

/** Affido equo: divide le pratiche selezionate tra i codici operatori indicati. */
export async function affidoEquoMassivoAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:assign");
  const ids = [...new Set(formData.getAll("praticaId").map(String).filter(Boolean))];
  const tipo = parseTipoAffido(String(formData.get("tipoAffido") || ""));
  const titolareId = titolareDaForm(formData);
  const codici = parseCodiciRaw(String(formData.get("codiciOperatori") || ""));
  const conferma = String(formData.get("conferma") || "") === "1";

  if (!ids.length) fail("Seleziona almeno una pratica");
  if (tipo === "ripristina") fail("La divisione equa non supporta il ripristino");
  if (codici.length < 1) fail("Inserisci almeno un codice operatore");
  if (ids.length > 500) fail("Massimo 500 pratiche per divisione equa");
  if (!conferma) fail("Conferma richiesta per procedere");

  const teamWhere =
    user.role === "SUPERVISOR"
      ? {
          tenantId: user.tenantId,
          active: true,
          OR: [{ id: user.id }, { supervisorId: user.id }],
        }
      : {
          tenantId: user.tenantId,
          active: true,
          role: { in: ["OPERATOR", "SUPERVISOR"] as const },
        };

  const team = await prisma.user.findMany({
    where: teamWhere,
    select: { id: true, name: true, acronimo: true },
  });

  const byCodice = new Map<string, { id: string; name: string; acronimo: string | null }>();
  for (const op of team) {
    byCodice.set(codiceOperatore(op), op);
  }

  const missing: string[] = [];
  const operatoriIds: string[] = [];
  for (const codice of codici) {
    const op = byCodice.get(codice);
    if (!op) missing.push(codice);
    else if (!operatoriIds.includes(op.id)) operatoriIds.push(op.id);
  }
  if (missing.length) {
    fail(`Codici non trovati nel gruppo: ${missing.join(", ")}`);
  }

  for (const opId of operatoriIds) {
    await assertPuoAffidareA(user, opId);
  }

  if (tipo === "temporaneo" && titolareId) await assertPuoAffidareA(user, titolareId);

  const buckets = dividePraticheEquamente(ids, operatoriIds);
  const errors: string[] = [];
  for (const bucket of buckets) {
    for (const praticaId of bucket.praticaIds) {
      try {
        await assegnaPratica(user, praticaId, bucket.operatoreId, tipo, titolareId);
      } catch (e) {
        errors.push(
          `${praticaId.slice(0, 8)}…: ${e instanceof Error ? e.message : "errore"}`
        );
      }
    }
  }

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "assign_equo",
    entity: "pratica",
    dettaglio: `${tipo} · ${ids.length} prt · codici ${codici.join(",")} · errori ${errors.length}`,
  });

  revalidateListe();
  if (errors.length) {
    fail(
      `Affido equo parziale: ${ids.length - errors.length} ok, ${errors.length} errori. ${errors.slice(0, 3).join(" · ")}`
    );
  }
}
