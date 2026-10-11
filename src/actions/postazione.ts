"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { usersDbFromUser } from "@/lib/usersRepo";
import { postazioniDbFromUser } from "@/lib/postazioniRepo";
import { sediDbFromUser } from "@/lib/sediRepo";
import { writeAudit } from "@/lib/domain";
import { requireUser, requireWritablePermission } from "@/lib/guard";
import { isCurrentUserPasswordExpired } from "@/lib/auth";
import { canImpostarePostazioneFissa, canEnterWithoutPostazione } from "@/lib/permissions";
import { clearPostazioneSkip, setPostazioneSkip } from "@/lib/postazioneGate";
import {
  liberaPostazioneDaResidui,
  validaPostazionePerUtente,
} from "@/lib/postazioneAssign";

// TEMPORANEO (misura tempi): true solo alla prima invocazione in questa istanza.
let misuraPrimaInvocazione = true;

export async function selezionaPostazioneAction(formData: FormData) {
  const tStart = Date.now();
  const primaInvocazione = misuraPrimaInvocazione ? 1 : 0;
  misuraPrimaInvocazione = false;
  const user = await requireUser({ allowExpiredPassword: true });
  const tUser = Date.now();
  if (await isCurrentUserPasswordExpired()) redirect("/cambia-password");
  const tPassword = Date.now();

  const postazioneId = String(formData.get("postazioneId") || "");
  if (!postazioneId) return { error: "Seleziona una postazione" };

  const validazione = await validaPostazionePerUtente(
    postazioneId,
    user.id,
    user.tenantId,
    user.tenantSlug ?? undefined
  );
  const tValida = Date.now();
  if ("error" in validazione) return { error: validazione.error };

  const postazioneFissa =
    canImpostarePostazioneFissa(user.role) && formData.get("postazioneFissa") === "on";

  const internoPostazione = validazione.postazione.interno
    ? String(validazione.postazione.interno).trim() || null
    : null;

  await liberaPostazioneDaResidui(
    postazioneId,
    user.id,
    user.tenantId,
    user.tenantSlug ?? undefined
  );
  const tLibera = Date.now();

  await clearPostazioneSkip();
  const tSkip = Date.now();

  await usersDbFromUser(user).update({
    where: { id: user.id },
    data: {
      postazioneId,
      postazioneFissa,
      ...(internoPostazione ? { interno: internoPostazione } : {}),
    },
  });
  const tUpdate = Date.now();

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    action: "seleziona_postazione",
    entity: "postazione",
    entityId: postazioneId,
    dettaglio: `${validazione.postazione.nome}${postazioneFissa ? " · fissa" : ""}`,
  });

  const tAudit = Date.now();

  // Navigazione verso "/" fatta dal client (router.push): evita il render della home
  // dentro la risposta dell'action (self-fetch) seguito da un secondo render lato client.
  // TEMPORANEO: solo durate in ms, solo per ADMIN/MANUTENZIONE.
  if (user.role === "ADMIN" || user.role === "MANUTENZIONE") {
    return {
      ok: true as const,
      _t: {
        first: primaInvocazione,
        user: tUser - tStart,
        password: tPassword - tUser,
        valida: tValida - tPassword,
        libera: tLibera - tValida,
        skip: tSkip - tLibera,
        update: tUpdate - tSkip,
        audit: tAudit - tUpdate,
        total: Date.now() - tStart,
      },
    };
  }
  return { ok: true as const };
}

/** Admin/amministrazione/bk off: entrano senza postazione se tutte sono occupate. */
export async function entraSenzaPostazioneAction() {
  const user = await requireUser({ allowExpiredPassword: true });
  if (!canEnterWithoutPostazione(user.role)) {
    throw new Error("Non consentito");
  }
  await setPostazioneSkip();
  await usersDbFromUser(user).update({
    where: { id: user.id },
    data: { postazioneId: null, postazioneFissa: false },
  });
  redirect("/");
}

export async function updateAccountPostazioneAction(formData: FormData) {
  const user = await requireUser();

  const postazioneId = String(formData.get("postazioneId") || "");
  if (!postazioneId) throw new Error("Seleziona una postazione");

  const validazione = await validaPostazionePerUtente(
    postazioneId,
    user.id,
    user.tenantId,
    user.tenantSlug ?? undefined
  );
  if ("error" in validazione) throw new Error(validazione.error);

  const postazioneFissa = canImpostarePostazioneFissa(user.role)
    ? formData.get("postazioneFissa") === "on"
    : false;

  await liberaPostazioneDaResidui(
    postazioneId,
    user.id,
    user.tenantId,
    user.tenantSlug ?? undefined
  );

  await clearPostazioneSkip();

  await usersDbFromUser(user).update({
    where: { id: user.id },
    data: {
      postazioneId,
      postazioneFissa,
      // Allinea interno personale a quello della postazione scelta.
      ...(validazione.postazione.interno
        ? { interno: String(validazione.postazione.interno).trim() || null }
        : {}),
    },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "account_postazione",
    entity: "postazione",
    entityId: postazioneId,
    dettaglio: `${validazione.postazione.nome}${postazioneFissa ? " · fissa" : ""}`,
  });

  revalidatePath("/account");
  revalidatePath("/rubrica");
  revalidatePath("/", "layout");
  revalidatePath("/pratiche");
}

export async function creaPostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Nome obbligatorio");

  const sedeId = String(formData.get("sedeId") || "").trim();
  if (!sedeId) throw new Error("Sede obbligatoria");

  const sede = await sediDbFromUser(user).findFirst({
    where: { id: sedeId, tenantId: user.tenantId, active: true },
  });
  if (!sede) throw new Error("Sede non valida");

  const interno = String(formData.get("interno") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const numeroFisso = String(formData.get("numeroFisso") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const postazioneModel = postazioniDbFromUser(user);

  const exists = await postazioneModel.findFirst({
    where: { tenantId: user.tenantId, nome },
  });
  if (exists) throw new Error("Nome postazione già esistente");

  await postazioneModel.create({
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
}

export async function aggiornaPostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("ID mancante");

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) throw new Error("Nome obbligatorio");

  const sedeId = String(formData.get("sedeId") || "").trim();
  if (!sedeId) throw new Error("Sede obbligatoria");

  const sede = await sediDbFromUser(user).findFirst({
    where: { id: sedeId, tenantId: user.tenantId },
  });
  if (!sede) throw new Error("Sede non valida");

  const interno = String(formData.get("interno") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const numeroFisso = String(formData.get("numeroFisso") || "").trim() || null;
  const note = String(formData.get("note") || "").trim() || null;

  const postazioneModel = postazioniDbFromUser(user);

  const current = await postazioneModel.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!current) throw new Error("Postazione non trovata");

  const duplicato = await postazioneModel.findFirst({
    where: { tenantId: user.tenantId, nome, NOT: { id } },
  });
  if (duplicato) throw new Error("Nome postazione già esistente");

  await postazioneModel.update({
    where: { id },
    data: { nome, interno, email, numeroFisso, sedeId, note },
  });

  revalidatePath("/postazioni");
  redirect("/postazioni");
}

export async function togglePostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const id = String(formData.get("id") || "");
  const postazioneModel = postazioniDbFromUser(user);
  const postazione = await postazioneModel.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!postazione) return;

  await postazioneModel.update({
    where: { id },
    data: { active: !postazione.active },
  });

  if (postazione.active) {
    await usersDbFromUser(user).updateMany({
      where: { postazioneId: id, tenantId: user.tenantId },
      data: { postazioneId: null, postazioneFissa: false },
    });
  }

  revalidatePath("/postazioni");
  redirect("/postazioni");
}

export async function eliminaPostazioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");

  const id = String(formData.get("id") || "");
  const postazioneModel = postazioniDbFromUser(user);
  const postazione = await postazioneModel.findFirst({
    where: { id, tenantId: user.tenantId },
  });
  if (!postazione) return;

  await usersDbFromUser(user).updateMany({
    where: { postazioneId: id, tenantId: user.tenantId },
    data: { postazioneId: null },
  });

  await postazioneModel.delete({ where: { id } });

  revalidatePath("/postazioni");
  redirect("/postazioni");
}
