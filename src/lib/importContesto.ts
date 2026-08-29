import { parseDateOnly } from "@/lib/domain";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import { prisma } from "@/lib/prisma";

export {
  csvColIndex,
  csvInt,
  csvMoney,
  csvStr,
  detectCsvDelimiter,
  normalizeCsvColName,
  parseCsvDate,
  parseCsvHeader,
  validateCsvLottoRighe,
} from "@/lib/importCsvUtils";

export type ImportContesto = {
  mandanteId: string;
  mandanteCodice: string;
  perimetro: string;
  lotto: string;
  affidoIl: Date;
  scadenzaMandato: Date | null;
};

/** Legge e valida mandante / perimetro / lotto / affido dal form di import. */
export async function parseImportContesto(
  formData: FormData,
  tenantId: string
): Promise<{ ok: ImportContesto } | { error: string }> {
  const mandanteId = String(formData.get("mandanteId") || "").trim();
  const perimetro = String(formData.get("perimetro") || "").trim();
  const lotto = String(formData.get("lotto") || "").trim();
  const affidoRaw = String(formData.get("affidoIl") || "").trim();
  const scadenzaMandatoRaw = String(formData.get("scadenzaMandato") || "").trim();

  if (!mandanteId) return { error: "Seleziona la mandante" };
  if (!perimetro) return { error: "Seleziona o indica il perimetro" };
  if (!lotto) return { error: "Indica il lotto" };

  const affidoIl = parseDateOnly(affidoRaw);
  if (!affidoIl) return { error: "Data affido non valida" };

  const scadenzaMandato = scadenzaMandatoRaw
    ? parseDateOnly(scadenzaMandatoRaw)
    : null;
  if (scadenzaMandatoRaw && !scadenzaMandato) {
    return { error: "Scadenza mandato non valida" };
  }

  const mandante = await prisma.mandante.findFirst({
    where: { id: mandanteId, tenantId },
    select: { id: true, codice: true, perimetri: true },
  });
  if (!mandante) return { error: "Mandante non trovata" };

  const elenco = parsePerimetri(mandante.perimetri);
  if (
    elenco.length > 0 &&
    !elenco.some(
      (p) =>
        p.nomeMandante === perimetro ||
        p.descrizione === perimetro ||
        p.nomeInterno === perimetro
    )
  ) {
    return { error: "Perimetro non valido per la mandante selezionata" };
  }

  return {
    ok: {
      mandanteId: mandante.id,
      mandanteCodice: mandante.codice,
      perimetro,
      lotto,
      affidoIl,
      scadenzaMandato,
    },
  };
}

/** Intervallo giornata (locale) per filtrare pratiche per data affido. */
export function giornoAffidoRange(affidoIl: Date) {
  const start = new Date(
    affidoIl.getFullYear(),
    affidoIl.getMonth(),
    affidoIl.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    affidoIl.getFullYear(),
    affidoIl.getMonth(),
    affidoIl.getDate(),
    23,
    59,
    59,
    999
  );
  return { start, end };
}
