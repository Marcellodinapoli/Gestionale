import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";
import { praticaDbFromUser } from "@/lib/praticheRepo";

export type AffidiMonitoraggioDto = {
  nuove: number;
  nonAssegnate: number;
  inLavorazione: number;
  inScadenza7gg: number;
};

export type AffidiAllerta =
  | "nuove"
  | "non_assegnate"
  | "in_lavorazione"
  | "in_scadenza";

export function parseAffidiAllerta(raw?: string | null): AffidiAllerta | undefined {
  const v = raw?.trim();
  if (
    v === "nuove" ||
    v === "non_assegnate" ||
    v === "in_lavorazione" ||
    v === "in_scadenza"
  ) {
    return v;
  }
  return undefined;
}

export function etichettaAffidiAllerta(a?: AffidiAllerta) {
  if (a === "nuove") return "Nuove (senza codice scarico)";
  if (a === "non_assegnate") return "Non assegnate (senza affidatario)";
  if (a === "in_lavorazione") return "In lavorazione";
  if (a === "in_scadenza") return "In scadenza 7 gg";
  return null;
}

export function praticaMonitorWhere(
  tenantId: string,
  mandanteId?: string,
  perimetro?: string,
  numeriMandante?: string[]
): Prisma.PraticaWhereInput {
  if (perimetro?.trim() && !(numeriMandante && numeriMandante.length)) {
    return {
      tenantId,
      id: "00000000-0000-0000-0000-000000000000",
    };
  }
  const numeri = numeriMandante?.length ? numeriMandante : [];
  return {
    tenantId,
    ...(mandanteId ? { mandanteId } : {}),
    ...(numeri.length === 1
      ? { numeroMandante: numeri[0] }
      : numeri.length > 1
        ? { numeroMandante: { in: numeri } }
        : {}),
  };
}

const STATI_CHIUSE = ["INCASSO", "RESA", "INESIGIBILE"] as const;
const STATI_IN_LAVORAZIONE = ["IN_LAVORAZIONE", "AFFIDATA", "PROMESSA", "PIANO"] as const;

function isChiusa(stato: string) {
  return (STATI_CHIUSE as readonly string[]).includes(stato);
}

/** Nuove = nessun codice scarico (nessuna lavorazione). */
export function isPraticaSenzaCodiceScarico(codiceScarico?: string | null) {
  return !(codiceScarico || "").trim();
}

/** Non assegnate = senza affidatario. */
export function isPraticaNonAssegnata(p: {
  stato: string;
  assegnatarioId?: string | null;
}) {
  return p.assegnatarioId == null && !isChiusa(p.stato);
}

export function wherePraticheSenzaCodiceScarico(): Prisma.PraticaWhereInput {
  return {
    OR: [{ codiceScarico: null }, { codiceScarico: "" }],
  };
}

export function wherePraticheNonAssegnate(): Prisma.PraticaWhereInput {
  return {
    assegnatarioId: null,
    stato: { notIn: [...STATI_CHIUSE] },
  };
}

/** Filtra l’elenco Affida in base alla card Allerte cliccata. */
export function filtraPratichePerAllerta<
  T extends {
    stato: string;
    assegnatarioId?: string | null;
    codiceScarico?: string | null;
    scadenza?: Date | string | null;
  },
>(pratiche: T[], allerta?: AffidiAllerta): T[] {
  if (!allerta) return pratiche;
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const tra7gg = new Date(oggi);
  tra7gg.setDate(tra7gg.getDate() + 7);

  if (allerta === "nuove") {
    return pratiche.filter(
      (p) => !isChiusa(p.stato) && isPraticaSenzaCodiceScarico(p.codiceScarico)
    );
  }
  if (allerta === "non_assegnate") {
    return pratiche.filter((p) => isPraticaNonAssegnata(p));
  }
  if (allerta === "in_lavorazione") {
    return pratiche.filter((p) =>
      (STATI_IN_LAVORAZIONE as readonly string[]).includes(p.stato)
    );
  }
  return pratiche.filter((p) => {
    if (isChiusa(p.stato) || !p.scadenza) return false;
    const d = p.scadenza instanceof Date ? p.scadenza : new Date(p.scadenza);
    if (Number.isNaN(d.getTime())) return false;
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    return day >= oggi && day <= tra7gg;
  });
}

export async function loadAffidiMonitoraggio(
  user: SessionUser,
  opts: {
    mandanteId?: string;
    perimetro?: string;
    numeriMandante?: string[];
    mese?: string;
  }
): Promise<AffidiMonitoraggioDto> {
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const tra7gg = new Date(oggi);
  tra7gg.setDate(tra7gg.getDate() + 7);

  const praticaWhere = praticaMonitorWhere(
    user.tenantId,
    opts.mandanteId,
    opts.perimetro,
    opts.numeriMandante
  );

  const praticaModel = praticaDbFromUser(user);

  const [nuove, inLavorazione, inScadenza7gg, nonAssegnate] = await Promise.all([
    // Nuove ≠ Non assegnate: solo senza codice scarico.
    praticaModel.count({
      where: {
        AND: [
          praticaWhere,
          { stato: { notIn: [...STATI_CHIUSE] } },
          wherePraticheSenzaCodiceScarico(),
        ],
      },
    }),
    praticaModel.count({
      where: {
        ...praticaWhere,
        stato: { in: [...STATI_IN_LAVORAZIONE] },
      },
    }),
    praticaModel.count({
      where: {
        ...praticaWhere,
        scadenza: { gte: oggi, lte: tra7gg },
        stato: { notIn: [...STATI_CHIUSE] },
      },
    }),
    // Non assegnate: senza affidatario.
    praticaModel.count({
      where: { ...praticaWhere, ...wherePraticheNonAssegnate() },
    }),
  ]);

  return {
    nuove,
    nonAssegnate,
    inLavorazione,
    inScadenza7gg,
  };
}
