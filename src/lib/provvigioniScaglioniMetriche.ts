import "server-only";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/permissions";
import { praticaWhere } from "@/lib/domain";
import { conteggiAffidatePerCodicePerimetro } from "@/lib/lavorazioneSuggerita";
import {
  COLONNE_CODICI,
  type CodiceConteggioKey,
} from "@/lib/codiciMandantePerimetro";
import type { PerformanceProvvigioni } from "@/lib/provvigioniPerimetroUi";
import type { PerimetroProvvigioniConfig } from "@/lib/provvigioniPerimetro";
import { resolveTenantSlug } from "@/lib/praticheRepo";

function chiavePerimetroCodice(mandanteId: string, perimetro: string, codice: CodiceConteggioKey) {
  return `${mandanteId}|${perimetro}|${codice}`;
}

/** Conteggi pezzi affido per perimetro (stato attuale pratiche), per calcolo scaglioni. */
export async function metricheScaglioniPerPerimetro(
  user: SessionUser,
  configs: PerimetroProvvigioniConfig[],
  extraScope?: Prisma.PraticaWhereInput
): Promise<Map<string, PerformanceProvvigioni>> {
  if (!configs.length) return new Map();

  const scope: Prisma.PraticaWhereInput = extraScope
    ? { AND: [praticaWhere(user), extraScope] }
    : praticaWhere(user);

  const affidatePerCodice = await conteggiAffidatePerCodicePerimetro(scope, {
    tenantId: user.tenantId,
    tenantSlug: resolveTenantSlug(user),
  });

  const out = new Map<string, PerformanceProvvigioni>();

  for (const cfg of configs) {
    const perimetro = cfg.nome;
    let pezziAffido = 0;
    const perCodice: PerformanceProvvigioni["perCodice"] = {};

    for (const col of COLONNE_CODICI) {
      const n =
        affidatePerCodice.get(chiavePerimetroCodice(cfg.mandanteId, perimetro, col.key)) ?? 0;
      pezziAffido += n;
      if (col.key !== "ND") {
        perCodice[col.key] = {
          incassato: 0,
          affidatoTotale: 0,
          affidatoPeriodo: 0,
          pezzi: n,
        };
      }
    }

    for (const entry of Object.values(perCodice)) {
      entry.pezziAffido = pezziAffido;
    }

    out.set(perimetro, {
      incassato: 0,
      affidatoTotale: pezziAffido,
      affidatoPeriodo: pezziAffido,
      pezziAffido,
      perCodice,
    });
  }

  return out;
}
