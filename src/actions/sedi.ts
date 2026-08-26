"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/domain";
import { requireWritableUser } from "@/lib/guard";
import { canManageSedi } from "@/lib/permissions";

async function requireSediManager() {
  const user = await requireWritableUser();
  if (!canManageSedi(user)) {
    throw new Error("Operazione non consentita per il tuo ruolo");
  }
  return user;
}

function sedeFieldsFromForm(formData: FormData, prefix = "") {
  const nome = String(formData.get(`${prefix}nome`) || "").trim();
  const indirizzo = String(formData.get(`${prefix}indirizzo`) || "").trim() || null;
  const citta = String(formData.get(`${prefix}citta`) || "").trim() || null;
  const cap = String(formData.get(`${prefix}cap`) || "").trim() || null;
  const provincia = String(formData.get(`${prefix}provincia`) || "").trim() || null;
  const telefono = String(formData.get(`${prefix}telefono`) || "").trim() || null;
  const email = String(formData.get(`${prefix}email`) || "").trim() || null;
  const note = String(formData.get(`${prefix}note`) || "").trim() || null;
  return { nome, indirizzo, citta, cap, provincia, telefono, email, note };
}

export async function completaSetupSediAction(formData: FormData) {
  const user = await requireSediManager();
  const existing = await prisma.sede.count({
    where: { tenantId: user.tenantId, active: true },
  });
  if (existing > 0) {
    redirect("/sedi");
  }

  const count = Math.min(15, Math.max(1, Number(formData.get("count") || 0)));
  if (!count) throw new Error("Indica quante sedi creare");

  const createdIds: string[] = [];
  const nomiVisti = new Set<string>();

  for (let i = 0; i < count; i++) {
    const fields = sedeFieldsFromForm(formData, `sede_${i}_`);
    if (!fields.nome) throw new Error(`Nome obbligatorio per la sede ${i + 1}`);
    const key = fields.nome.toLowerCase();
    if (nomiVisti.has(key)) throw new Error(`Nome sede duplicato: ${fields.nome}`);
    nomiVisti.add(key);

    const sede = await prisma.sede.create({
      data: {
        tenantId: user.tenantId,
        ...fields,
        active: true,
      },
    });
    createdIds.push(sede.id);
  }

  if (!user.sedeId && createdIds[0]) {
    await prisma.user.update({
      where: { id: user.id },
      data: { sedeId: createdIds[0] },
    });
  }

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "setup_sedi",
    entity: "sede",
    dettaglio: `create ${createdIds.length} sedi (primo accesso)`,
  });

  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  revalidatePath("/operatori");
  revalidatePath("/");
  redirect("/sedi");
}

export async function creaSedeAction(formData: FormData) {
  const user = await requireSediManager();
  const fields = sedeFieldsFromForm(formData);
  if (!fields.nome) throw new Error("Nome obbligatorio");

  const exists = await prisma.sede.findUnique({
    where: { tenantId_nome: { tenantId: user.tenantId, nome: fields.nome } },
  });
  if (exists) throw new Error("Nome sede già esistente");

  const sede = await prisma.sede.create({
    data: { tenantId: user.tenantId, ...fields, active: true },
  });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "crea_sede",
    entity: "sede",
    entityId: sede.id,
    dettaglio: fields.nome,
  });
  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  revalidatePath("/operatori");
}

export async function aggiornaSedeAction(formData: FormData) {
  const user = await requireSediManager();
  const id = String(formData.get("id") || "");
  const fields = sedeFieldsFromForm(formData);
  if (!id || !fields.nome) throw new Error("Dati mancanti");

  const current = await prisma.sede.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!current) throw new Error("Sede non trovata");

  const duplicato = await prisma.sede.findFirst({
    where: { tenantId: user.tenantId, nome: fields.nome, NOT: { id } },
  });
  if (duplicato) throw new Error("Nome sede già esistente");

  await prisma.sede.update({ where: { id }, data: fields });
  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "aggiorna_sede",
    entity: "sede",
    entityId: id,
    dettaglio: `${current.nome} → ${fields.nome}`,
  });
  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  revalidatePath("/operatori");
  redirect("/sedi");
}

export async function toggleSedeAction(formData: FormData) {
  const user = await requireSediManager();
  const id = String(formData.get("id") || "");
  const sede = await prisma.sede.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!sede) return;

  await prisma.sede.update({
    where: { id },
    data: { active: !sede.active },
  });
  revalidatePath("/sedi");
  revalidatePath("/postazioni");
  redirect("/sedi");
}
