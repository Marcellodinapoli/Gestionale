import "server-only";
import type { DialerCampagnaStato } from "@/lib/predictive-dialer/constants";
import { parseCodiciScaricoJson } from "@/lib/predictive-dialer/scope";
import type { DialerCampagnaDto } from "@/lib/predictive-dialer/types";

export function mapDialerCampagna(row: {
  id: string;
  nome: string;
  descrizione: string;
  codiciScarico: string;
  postCallSec: number;
  stato: string;
  pacingRatio: number | null;
  externalId: string | null;
  activatedAt: Date | null;
  createdAt: Date;
}): DialerCampagnaDto {
  return {
    id: row.id,
    nome: row.nome,
    descrizione: row.descrizione,
    codiciScarico: parseCodiciScaricoJson(row.codiciScarico),
    postCallSec: row.postCallSec,
    stato: row.stato as DialerCampagnaStato,
    pacingRatio: row.pacingRatio,
    externalId: row.externalId,
    activatedAt: row.activatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
