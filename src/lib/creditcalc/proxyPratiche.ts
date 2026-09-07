import "server-only";
import type { CreditCalcConnection } from "./types";
import {
  connectorFetchTenant,
  creditCalcConnectorPath,
  resolveConnectorForTenant,
} from "./connectorResolve";

/** Proxy server-side: Connection → tenant → Connettore (mai dal client). */
export async function proxyCreditCalcSession(connection: CreditCalcConnection) {
  const resolved = await resolveConnectorForTenant(connection.tenantId);
  return connectorFetchTenant<{ profile: unknown }>(
    connection.tenantId,
    creditCalcConnectorPath(resolved.tenantSlug, "/session"),
    {
      method: "POST",
      body: { userId: connection.gestionaleUserId },
    }
  );
}

export async function proxyCreditCalcPratiche(
  connection: CreditCalcConnection,
  opts?: { take?: number; skip?: number }
) {
  const resolved = await resolveConnectorForTenant(connection.tenantId);
  return connectorFetchTenant<Record<string, unknown>>(
    connection.tenantId,
    creditCalcConnectorPath(resolved.tenantSlug, "/pratiche"),
    {
      method: "POST",
      body: {
        userId: connection.gestionaleUserId,
        take: opts?.take,
        skip: opts?.skip,
      },
    }
  );
}

export async function proxyCreditCalcPraticaDetail(
  connection: CreditCalcConnection,
  praticaId: string
) {
  const resolved = await resolveConnectorForTenant(connection.tenantId);
  return connectorFetchTenant<Record<string, unknown>>(
    connection.tenantId,
    creditCalcConnectorPath(resolved.tenantSlug, `/pratiche/${praticaId}`),
    {
      method: "POST",
      body: { userId: connection.gestionaleUserId },
    }
  );
}

export async function proxyCreditCalcLavorazione(
  connection: CreditCalcConnection,
  praticaId: string,
  input: { nota?: string | null; codiceScarico?: string | null }
) {
  const resolved = await resolveConnectorForTenant(connection.tenantId);
  return connectorFetchTenant<Record<string, unknown>>(
    connection.tenantId,
    creditCalcConnectorPath(
      resolved.tenantSlug,
      `/pratiche/${praticaId}/lavorazione`
    ),
    {
      method: "POST",
      body: {
        userId: connection.gestionaleUserId,
        nota: input.nota,
        codiceScarico: input.codiceScarico,
      },
    }
  );
}
