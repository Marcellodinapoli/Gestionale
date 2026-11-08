import "server-only";
import type { CreditCalcConnection } from "./types";
import {
  creditCalcLavorazione,
  creditCalcListPratiche,
  creditCalcPraticaDetail,
  creditCalcSessionProfile,
} from "./operationalService";

/** BFF CredixaApp → database operativo (Neon). Mai il Connettore. */
export async function proxyCreditCalcSession(connection: CreditCalcConnection) {
  return creditCalcSessionProfile(connection);
}

export async function proxyCreditCalcPratiche(
  connection: CreditCalcConnection,
  opts?: { take?: number; skip?: number }
) {
  return creditCalcListPratiche(connection, opts);
}

export async function proxyCreditCalcPraticaDetail(
  connection: CreditCalcConnection,
  praticaId: string
) {
  return creditCalcPraticaDetail(connection, praticaId);
}

export async function proxyCreditCalcLavorazione(
  connection: CreditCalcConnection,
  praticaId: string,
  input: { nota?: string | null; codiceScarico?: string | null }
) {
  return creditCalcLavorazione(connection, praticaId, input);
}
