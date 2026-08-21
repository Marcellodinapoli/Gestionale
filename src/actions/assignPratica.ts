"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canAccessPratica, writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import { parseTipoAffido, dividePraticheEquamente, type TipoAffido } from "@/lib/affido";
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
  tipo: TipoAffido
) {
  const pratica = await prisma.pratica.findUnique({ where: { id: praticaId } });
  if (!pratica) fail("Pratica non trovata");
  if (!(await canAccessPratica(user, praticaId)) && user.role !== "ADMIN") {
    fail("Non puoi assegnare questa pratica");
  }
  await assertPraticaNotLockedByOther(user.id, praticaId);

  const titolareCorrente =
    pratica.operatoreTitolareId ?? pratica.assegnatarioId;

  if (tipo === "ripristina") {
    if (!titolareCorrente) fail("Nessun titolare da ripristinare");
    if (pratica.assegnatarioId === titolareCorrente) {
      fail("La pratica è già presso il titolare");
    }
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
    if (!titolareCorrente) {
      fail("Per l'affido temporaneo serve prima un titolare (affido definitivo)");
    }
    if (assegnatarioId === titolareCorrente) {
      fail("Seleziona un operatore diverso dal titolare");
    }
    await prisma.pratica.update({
      where: { id: praticaId },
      data: {
        assegnatarioId,
        operatoreTitolareId: titolareCorrente,
        stato:
          pratica.stato === "NUOVA" ? "AFFIDATA" : pratica.stato,
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
        stato:
          pratica.stato === "NUOVA" ? "AFFIDATA" : pratica.stato,
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

export async function assignPraticaAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:assign");
  const praticaId = String(formData.get("praticaId") || "");
  const tipo = parseTipoAffido(String(formData.get("tipoAffido") || ""));
  const assegnatarioId =
    tipo === "ripristina"
      ? null
      : String(formData.get("assegnatarioId") || "") || null;
  if (tipo !== "ripristina") await assertPuoAffidareA(user, assegnatarioId);
  await assegnaPratica(user, praticaId, assegnatarioId, tipo);
  revalidateListe();
}

export async function assignPraticheMassiveAction(formData: FormData) {
  const user = await requireWritablePermission("pratiche:assign");
  const ids = [...new Set(formData.getAll("praticaId").map(String).filter(Boolean))];
  const tipo = parseTipoAffido(String(formData.get("tipoAffido") || ""));
  const assegnatarioId =
    tipo === "ripristina"
      ? null
      : String(formData.get("assegnatarioId") || "") || null;
  if (!ids.length) fail("Seleziona almeno una pratica");
  if (tipo !== "ripristina" && !assegnatarioId) fail("Seleziona un operatore");
  if (ids.length > 200) fail("Massimo 200 pratiche per affido massivo");
  if (tipo !== "ripristina") await assertPuoAffidareA(user, assegnatarioId);
  for (const praticaId of ids) {
    await assegnaPratica(user, praticaId, assegnatarioId, tipo);
  }
  revalidateListe();
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

  const buckets = dividePraticheEquamente(ids, operatoriIds);
  const errors: string[] = [];
  for (const bucket of buckets) {
    for (const praticaId of bucket.praticaIds) {
      try {
        await assegnaPratica(user, praticaId, bucket.operatoreId, tipo);
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
