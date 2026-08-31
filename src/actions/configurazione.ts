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
