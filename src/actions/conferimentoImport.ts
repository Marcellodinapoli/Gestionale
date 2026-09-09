"use server";

import { revalidatePath } from "next/cache";
import { requireWritablePermission } from "@/lib/guard";
import { importBatchRepoFromUser } from "@/lib/importBatchRepo";
import {
  isConferimentoTipo,
  PROSSIMA_ATTIVITA_PASSAGGIO_GIUDIZIALE,
  type ConferimentoTipo,
} from "@/lib/conferimentoLegale";

function dayStart(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
}

export async function salvaConferimentoImportBatchAction(input: {
  batchId: string;
  conferimentoTipo: string;
  dataPassaggioGiudiziale?: string | null;
  scadenzaMandato?: string | null;
}): Promise<{ ok?: string; error?: string; updatedPratiche?: number }> {
  const user = await requireWritablePermission("import:run");
  const batchId = String(input.batchId || "").trim();
  if (!batchId) return { error: "Batch non valido" };
  if (!isConferimentoTipo(input.conferimentoTipo)) {
    return { error: "Seleziona il tipo di conferimento" };
  }
  const tipo = input.conferimentoTipo as ConferimentoTipo;

  let dataPassaggio: string | null = null;
  let prossima: string | null = null;

  if (tipo === "ENTRAMBI") {
    const raw = input.dataPassaggioGiudiziale?.trim() || "";
    if (raw) {
      const passaggio = dayStart(raw);
      const scadRaw = input.scadenzaMandato?.trim() || "";
      if (scadRaw) {
        const scad = dayStart(scadRaw);
        if (passaggio.getTime() > scad.getTime()) {
          return {
            error: "La data di passaggio giudiziale non può essere successiva alla scadenza mandato",
          };
        }
      }
      dataPassaggio = passaggio.toISOString();
      prossima = PROSSIMA_ATTIVITA_PASSAGGIO_GIUDIZIALE;
    }
  }

  const repo = importBatchRepoFromUser(user);
  const batch = await repo.getById(
    user.tenantSlug || user.tenantId,
    user.tenantId,
    batchId
  );
  if (!batch || batch.tenantId !== user.tenantId) {
    return { error: "Lotto / batch non trovato" };
  }

  const result = await repo.applyConferimento(
    user.tenantSlug || user.tenantId,
    user.tenantId,
    batchId,
    {
      conferimentoTipo: tipo,
      dataPassaggioGiudiziale: dataPassaggio,
      prossimaAttivitaAlloScadere: prossima,
    }
  );

  revalidatePath("/import");
  revalidatePath("/pratiche");
  revalidatePath("/legal");
  revalidatePath("/legal/avvio");
  return {
    ok: "Conferimento salvato sul lotto e sulle pratiche",
    updatedPratiche: result.updatedPratiche,
  };
}
