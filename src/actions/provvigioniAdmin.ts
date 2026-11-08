"use server";

import { revalidatePath } from "next/cache";
import { provvigioniDbFromUser } from "@/lib/provvigioniRepo";
import { aggiornaModoIncasso } from "@/lib/incassiRepo";
import { isModoNonProvvigionabile, normalizeModoIncasso } from "@/lib/incassoFattura";
import { importiProvvigionePerModo } from "@/lib/provvigioneImportiModo";
import { resolveTenantSlug } from "@/lib/praticheRepo";
import { writeAudit } from "@/lib/domain";
import { requireWritablePermission } from "@/lib/guard";

function fail(message: string): never {
  throw new Error(message);
}

export async function liquidaProvvigioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const provvigioniModel = provvigioniDbFromUser(user);
  const id = String(formData.get("id") || "").trim();
  const stato = String(formData.get("stato") || "LIQUIDATA").trim();
  if (!id) fail("ID mancante");

  await provvigioniModel.update({
    where: { id },
    data: { stato },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "provvigione",
    entityId: id,
    dettaglio: `stato → ${stato}`,
  });
  revalidatePath("/provigioni");
}

export async function liquidaMassivaAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const provvigioniModel = provvigioniDbFromUser(user);
  const idsRaw = String(formData.get("ids") || "").trim();
  if (!idsRaw) fail("Nessuna provvigione selezionata");
  const ids = JSON.parse(idsRaw) as string[];
  if (!ids.length) fail("Nessuna provvigione selezionata");

  await provvigioniModel.updateMany({
    where: { id: { in: ids }, stato: "MATURATA" },
    data: { stato: "LIQUIDATA" },
  });
  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "provvigione",
    dettaglio: `liquidazione massiva di ${ids.length} provvigioni`,
  });
  revalidatePath("/provigioni");
}

export async function updateImportoProvvigioneAction(formData: FormData) {
  const user = await requireWritablePermission("operatori:manage");
  const provvigioniModel = provvigioniDbFromUser(user);
  const id = String(formData.get("id") || "").trim();
  const importoRaw = String(formData.get("importo") || "").trim();
  const percentualeRaw = String(formData.get("percentuale") || "").trim();
  const modoRaw = formData.has("modo") ? String(formData.get("modo") || "").trim() : "";
  if (!id) fail("ID mancante");

  const aggiornaModo = Boolean(modoRaw);
  if (!importoRaw && !percentualeRaw && !aggiornaModo) fail("Nessun dato da aggiornare");

  const rows = await provvigioniModel.findMany({
    where: { id },
    take: 1,
    include: {
      incasso: { select: { id: true, metodo: true, modo: true } },
      pratica: {
        select: {
          codiceScarico: true,
          numeroMandante: true,
          mandante: {
            select: { provvigionePerc: true, provvigioniMetodo: true, perimetri: true },
          },
        },
      },
    },
  });
  const row = rows[0] as {
    baseImporto?: number;
    incasso?: { id?: string; metodo?: string | null; modo?: string | null };
    pratica?: {
      codiceScarico?: string | null;
      numeroMandante?: string | null;
      mandante?: {
        provvigionePerc?: number | null;
        provvigioniMetodo?: string | null;
        perimetri?: string | null;
      } | null;
    };
  } | undefined;
  if (!row?.incasso?.id) fail("Incasso collegato non trovato");

  const modo = normalizeModoIncasso(aggiornaModo ? modoRaw : row.incasso.modo);
  if (aggiornaModo) {
    await aggiornaModoIncasso(
      { tenantId: user.tenantId, tenantSlug: resolveTenantSlug(user) },
      String(row.incasso.id),
      modo
    );
  }

  const calc = importiProvvigionePerModo({
    modo,
    baseImporto: Number(row.baseImporto) || 0,
    metodo: row.incasso.metodo || "bonifico",
    codiceScarico: row.pratica?.codiceScarico ?? null,
    numeroMandante: row.pratica?.numeroMandante ?? null,
    mandante: row.pratica?.mandante ?? {},
  });

  const data: { importo: number; percentuale: number } = isModoNonProvvigionabile(modo)
    ? { importo: 0, percentuale: 0 }
    : aggiornaModo
      ? { importo: calc.importo, percentuale: calc.percentuale }
      : {
          importo: importoRaw
            ? parseFloat(importoRaw.replace(",", "."))
            : calc.importo,
          percentuale: percentualeRaw
            ? parseFloat(percentualeRaw.replace(",", "."))
            : calc.percentuale,
        };

  await provvigioniModel.update({ where: { id }, data });

  await writeAudit({
    userId: user.id,
    action: "update",
    entity: "provvigione",
    entityId: id,
    dettaglio: `importo: ${data.importo}, %: ${data.percentuale}, esito: ${modo}`,
  });
  revalidatePath("/provigioni");
}
