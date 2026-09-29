import { sql } from "../db/pool.js";

export type ScopeInput = {
  tenantId: string;
  role: string;
  userId: string;
  memberIds?: string[];
  /**
   * Nasconde pratiche scadute dallo stragiudiziale / giudiziale avviato.
   * Tipico per OPERATOR/SUPERVISOR in coda operativa; in ricerca anagrafica
   * (`cercaAmpia`) va impostato a false.
   */
  hideFuoriStragiudiziale?: boolean;
};

const STATI_GIUDIZIALE_NASCOSTI = [
  "IN_ATTESA_VALUTAZIONE_LEGALE",
  "GIUDIZIALE_AVVIATO_PROCEDURA_DA_DEFINIRE",
  "IN_PROCEDURA",
  "PROCEDURA_AVVIATA",
  "ARCHIVIATA_SENZA_AZIONE",
  "CONCLUSA_CON_ESITO",
];

function appendHideFuoriStragiudiziale(
  clauses: string[],
  req: sql.Request,
  alias: string
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  req.input("scopeStragiudToday", sql.DateTime2, today);
  STATI_GIUDIZIALE_NASCOSTI.forEach((s, i) => {
    req.input(`scopeGiudStato${i}`, sql.NVarChar(80), s);
  });
  const statiList = STATI_GIUDIZIALE_NASCOSTI.map((_, i) => `@scopeGiudStato${i}`).join(", ");
  clauses.push(`NOT (
    (
      ISNULL(${alias}.ConferimentoTipo, N'') <> N'GIUDIZIALE'
      AND (
        (${alias}.DataPassaggioGiudiziale IS NOT NULL AND ${alias}.DataPassaggioGiudiziale < @scopeStragiudToday)
        OR (${alias}.DataPassaggioGiudiziale IS NULL AND ${alias}.Scadenza IS NOT NULL AND ${alias}.Scadenza < @scopeStragiudToday)
      )
    )
    OR EXISTS (
      SELECT 1 FROM dbo.PraticheGiudiziali g
      WHERE g.PraticaId = ${alias}.Id
        AND g.StatoAvvio IN (${statiList})
    )
  )`);
}

/** Applica scope ruolo come clausole SQL AND su alias `p`. */
export function applyScope(
  scope: ScopeInput,
  req: sql.Request,
  alias = "p"
): string[] {
  const clauses: string[] = [`${alias}.TenantId = @tenantId`];
  req.input("tenantId", sql.UniqueIdentifier, scope.tenantId);

  const role = scope.role;
  const hideFuori =
    scope.hideFuoriStragiudiziale === true ||
    role === "OPERATOR" ||
    role === "SUPERVISOR";

  if (role === "ADMIN" || role === "BACK_OFFICE" || role === "AMMINISTRAZIONE" || role === "LEGAL") {
    if (hideFuori) appendHideFuoriStragiudiziale(clauses, req, alias);
    return clauses;
  }

  req.input("scopeUserId", sql.UniqueIdentifier, scope.userId);

  if (role === "OPERATOR") {
    clauses.push(
      `(${alias}.AssegnatarioId = @scopeUserId OR ${alias}.OperatoreTitolareId = @scopeUserId)`
    );
    if (hideFuori) appendHideFuoriStragiudiziale(clauses, req, alias);
    return clauses;
  }

  if (role === "SUPERVISOR") {
    const memberIds = scope.memberIds?.length ? scope.memberIds : [scope.userId];
    memberIds.forEach((id, i) => {
      req.input(`scopeMember${i}`, sql.UniqueIdentifier, id);
    });
    const inList = memberIds.map((_, i) => `@scopeMember${i}`).join(", ");
    clauses.push(`(
      ${alias}.AssegnatarioId = @scopeUserId
      OR ${alias}.OperatoreTitolareId = @scopeUserId
      OR ${alias}.AssegnatarioId IS NULL
      OR ${alias}.AssegnatarioId IN (${inList})
      OR ${alias}.OperatoreTitolareId IN (${inList})
    )`);
    if (hideFuori) appendHideFuoriStragiudiziale(clauses, req, alias);
    return clauses;
  }

  clauses.push(
    `(${alias}.AssegnatarioId = @scopeUserId OR ${alias}.OperatoreTitolareId = @scopeUserId)`
  );
  if (hideFuori) appendHideFuoriStragiudiziale(clauses, req, alias);
  return clauses;
}
