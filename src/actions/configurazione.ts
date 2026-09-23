"use server";

import { revalidatePath } from "next/cache";
import { configurazioneDbFromUser } from "@/lib/configurazioneRepo";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";
import { isSecretConfigKey, SECRET_CONFIG_KEYS } from "@/lib/configSecrets";

/** Elimina eventuali secret già salvati per il tenant (password, API key, ecc.). */
export async function purgeSecretConfigAction() {
  const user = await requireWritablePermission("users:manage");
  const configModel = configurazioneDbFromUser(user);
  const result = await configModel.deleteMany({
    where: {
      tenantId: user.tenantId,
      chiave: { in: [...SECRET_CONFIG_KEYS] },
    },
  });
  if (result.count > 0) {
    await writeAudit({
      userId: user.id,
      tenantId: user.tenantId,
      action: "update",
      entity: "configurazione",
      dettaglio: `rimossi ${result.count} parametri secret dal gestionale`,
    });
    revalidatePath("/configurazione");
    revalidatePath("/telefonia");
  }
  return { removed: result.count };
}

export async function salvaConfigurazioneAction(formData: FormData) {
  const user = await requireWritablePermission("users:manage");
  const categoria = String(formData.get("categoria") || "").trim();
  const entries = JSON.parse(String(formData.get("entries") || "[]")) as Array<{
    chiave: string;
    valore: string;
  }>;

  if (!categoria || !entries.length) throw new Error("Dati mancanti");

  const safe = entries.filter((e) => e.chiave && !isSecretConfigKey(e.chiave));
  if (safe.length === 0) {
    throw new Error(
      "Nessun parametro valido: password e chiavi non possono essere salvate nel gestionale"
    );
  }

  const configModel = configurazioneDbFromUser(user);

  for (const { chiave, valore } of safe) {
    await configModel.upsert({
      where: {
        tenantId_chiave: { tenantId: user.tenantId, chiave },
      },
      create: { tenantId: user.tenantId, chiave, valore, categoria },
      update: { valore, categoria },
    });
  }

  // In caso fossero rimaste chiavi vecchie, le cancella sempre al salvataggio.
  await configModel.deleteMany({
    where: {
      tenantId: user.tenantId,
      chiave: { in: [...SECRET_CONFIG_KEYS] },
    },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "configurazione",
    dettaglio: `aggiornata sezione ${categoria} (${safe.length} parametri, senza secret)`,
  });
  revalidatePath("/configurazione");
  if (categoria === "voip") {
    revalidatePath("/telefonia");
  }
}

/** Accende/spegne i moduli prodotto per questo tenant (senza toccare il codice). */
export async function salvaModuliPiattaformaAction(formData: FormData) {
  const user = await requireWritablePermission("users:manage");
  const { isModuleId, serializeEnabledModules, SELLABLE_MODULE_IDS } = await import(
    "@/lib/platform/modules"
  );
  const { PLATFORM_MODULES_KEY, PLATFORM_CONFIG_CATEGORIA } = await import(
    "@/lib/platform/tenantProfile"
  );

  let parsed: unknown = [];
  try {
    parsed = JSON.parse(String(formData.get("modules") || "[]"));
  } catch {
    throw new Error("Elenco moduli non valido");
  }
  if (!Array.isArray(parsed)) throw new Error("Elenco moduli non valido");

  const sellable = new Set<string>(SELLABLE_MODULE_IDS);
  const ids = parsed
    .map((x) => String(x).trim())
    .filter((id) => isModuleId(id) && (id === "core" || sellable.has(id)));

  const valore = serializeEnabledModules(ids);
  const configModel = configurazioneDbFromUser(user);
  await configModel.upsert({
    where: {
      tenantId_chiave: { tenantId: user.tenantId, chiave: PLATFORM_MODULES_KEY },
    },
    create: {
      tenantId: user.tenantId,
      chiave: PLATFORM_MODULES_KEY,
      valore,
      categoria: PLATFORM_CONFIG_CATEGORIA,
    },
    update: { valore, categoria: PLATFORM_CONFIG_CATEGORIA },
  });

  await writeAudit({
    userId: user.id,
    tenantId: user.tenantId,
    action: "update",
    entity: "configurazione",
    dettaglio: `aggiornati moduli tenant (${ids.join(", ") || "core"})`,
  });
  revalidatePath("/");
  revalidatePath("/configurazione");
}
