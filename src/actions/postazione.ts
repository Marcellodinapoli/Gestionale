"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireUser, requireWritablePermission } from "@/lib/guard";
import { isUserPasswordExpired } from "@/lib/passwordPolicy";

export async function selezionaPostazioneAction(formData: FormData) {
  const user = await requireUser({ allowExpiredPassword: true });
  if (await isUserPasswordExpired(user.id)) redirect("/cambia-password");

  const postazioneId = String(formData.get("postazioneId") || "");
  if (!postazioneId) return { error: "Seleziona una postazione" };

  const postazione = await prisma.postazione.findFirst({
    where: { id: postazioneId, tenantId: user.tenantId, active: true },
    include: {
      occupanti: {
        where: { active: true, id: { not: user.id }, tenantId: user.tenantId },
        select: { id: true, name: true },
      },
    },
  });
  if (!postazione) {
    return { error: "Postazione non valida" };
  }
  if (postazione.occupanti.length > 0) {
    return {
      error: `Postazione già occupata da ${postazione.occupanti[0].name}`,
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { postazioneId },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "seleziona_postazione",
    entity: "postazione",
    entityId: postazioneId,
    dettaglio: postazione.nome,
  });

  redirect("/");
}

export async function creaPostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Nome obbligatorio");

  const sedeId = String(formData.get("sedeId") || "").trim();
  if (!sedeId) throw new Error("Sede obbligatoria");

  const sede = await prisma.sede.findFirst({
    where: { id: sedeId, tenantId: user.tenantId, active: true },
  });
  if (!sede) throw new Error("Sede non valida");

  const interno = String(formData.get("interno") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const numeroFisso = String(formData.get("numeroFisso") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const exists = await prisma.postazione.findFirst({
    where: { tenantId: user.tenantId, nome },
  });
  if (exists) throw new Error("Nome postazione già esistente");

  await prisma.postazione.create({
    data: {
      tenantId: user.tenantId,
      nome,
      interno,
      email,
      numeroFisso,
      sedeId,
      note,
    },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "crea_postazione",
    entity: "postazione",
    entityId: nome,
    dettaglio: `${nome} · ${sede.nome}`,
  });

  revalidatePath("/postazioni");
  redirect("/postazioni");
}

export async function aggiornaPostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID mancante");

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Nome obbligatorio");

  const sedeId = String(formData.get("sedeId") || "").trim();
  if (!sedeId) throw new Error("Sede obbligatoria");

  const sede = await prisma.sede.findFirst({
    where: { id: sedeId, tenantId: user.tenantId },
  });
  if (!sede) throw new Error("Sede non valida");

  const interno = String(formData.get("interno") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const numeroFisso = String(formData.get("numeroFisso") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const current = await prisma.postazione.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!current) throw new Error("Postazione non trovata");

  const duplicato = await prisma.postazione.findFirst({
    where: { tenantId: user.tenantId, nome, NOT: { id } },
  });
  if (duplicato) throw new Error("Nome postazione già esistente");

  await prisma.postazione.update({
    where: { id },
    data: { nome, interno, email, numeroFisso, sedeId, note },
  });

  revalidatePath("/postazioni");
  redirect("/postazioni");
}

export async function togglePostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const id = String(formData.get("id") || "");
  const postazione = await prisma.postazione.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!postazione) return;

  await prisma.postazione.update({
    where: { id },
    data: { active: !postazione.active },
  });

  if (postazione.active) {
    await prisma.user.updateMany({
      where: { postazioneId: id, tenantId: user.tenantId },
      data: { postazioneId: null },
    });
  }

  revalidatePath("/postazioni");
  redirect("/postazioni");
}

export async function eliminaPostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const id = String(formData.get("id") || "");
  const postazione = await prisma.postazione.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!postazione) return;

  await prisma.user.updateMany({
    where: { postazioneId: id, tenantId: user.tenantId },
    data: { postazioneId: null },
  });

  await prisma.postazione.delete({ where: { id } });

  revalidatePath("/postazioni");
  redirect("/postazioni");
}
