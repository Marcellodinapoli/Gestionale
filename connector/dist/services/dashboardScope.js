import { sql } from "../db/pool.js";
export function bindPraticaScope(req, input, alias = "p") {
    req.input("tenantId", sql.UniqueIdentifier, input.tenantId);
    const clauses = [`${alias}.TenantId = @tenantId`];
    let join = "";
    if (input.mode === "none") {
        return { where: "1 = 0", join: "", praticaAlias: alias };
    }
    if (input.sedeId) {
        req.input("sedeId", sql.UniqueIdentifier, input.sedeId);
        join += `
      LEFT JOIN dbo.Users ${alias}_ua ON ${alias}_ua.Id = ${alias}.AssegnatarioId
      LEFT JOIN dbo.Users ${alias}_ut ON ${alias}_ut.Id = ${alias}.OperatoreTitolareId
    `;
        clauses.push(`(${alias}_ua.SedeId = @sedeId OR ${alias}_ut.SedeId = @sedeId)`);
    }
    if (input.mode === "operator" && input.userId) {
        req.input("scopeUserId", sql.UniqueIdentifier, input.userId);
        clauses.push(`(${alias}.AssegnatarioId = @scopeUserId OR ${alias}.OperatoreTitolareId = @scopeUserId)`);
    }
    else if (input.mode === "supervisor" && input.userId) {
        req.input("scopeUserId", sql.UniqueIdentifier, input.userId);
        join += `
      LEFT JOIN dbo.Users ${alias}_ua ON ${alias}_ua.Id = ${alias}.AssegnatarioId
      LEFT JOIN dbo.Users ${alias}_ut ON ${alias}_ut.Id = ${alias}.OperatoreTitolareId
    `;
        clauses.push(`(
      ${alias}.AssegnatarioId = @scopeUserId
      OR ${alias}.OperatoreTitolareId = @scopeUserId
      OR ${alias}.AssegnatarioId IS NULL
      OR ${alias}_ua.SupervisorId = @scopeUserId
      OR ${alias}_ut.SupervisorId = @scopeUserId
    )`);
    }
    else if (input.mode === "members" && input.memberIds?.length) {
        input.memberIds.forEach((id, i) => req.input(`mem${i}`, sql.UniqueIdentifier, id));
        clauses.push(`${alias}.AssegnatarioId IN (${input.memberIds.map((_, i) => `@mem${i}`).join(", ")})`);
    }
    if (input.perimetroOr?.length) {
        const orParts = [];
        input.perimetroOr.forEach((pair, i) => {
            req.input(`pm${i}`, sql.UniqueIdentifier, pair.mandanteId);
            if (pair.numeriMandante?.length) {
                pair.numeriMandante.forEach((n, j) => {
                    req.input(`pmn${i}_${j}`, sql.NVarChar(100), n);
                });
                orParts.push(`(${alias}.MandanteId = @pm${i} AND ${alias}.NumeroMandante IN (${pair.numeriMandante
                    .map((_, j) => `@pmn${i}_${j}`)
                    .join(", ")}))`);
            }
            else {
                orParts.push(`(${alias}.MandanteId = @pm${i})`);
            }
        });
        if (orParts.length)
            clauses.push(`(${orParts.join(" OR ")})`);
    }
    return { where: clauses.join(" AND "), join, praticaAlias: alias };
}
export const CODICE_SLOT_SQL = `
  CASE
    WHEN p.CodiceScarico IN (N'PTC', N'PPC', N'MOV', N'LPP', N'LPT') THEN p.CodiceScarico
    WHEN p.Stato = N'INCASSO' THEN N'PTC'
    WHEN p.Stato = N'PROMESSA' THEN N'PPC'
    WHEN p.Stato = N'INESIGIBILE' THEN N'MOV'
    WHEN p.Stato = N'PIANO' THEN N'LPP'
    WHEN p.Stato = N'RESA' THEN N'LPT'
    ELSE N'ND'
  END
`;
export const STATI_CHIUSI_SQL = `(N'INCASSO', N'RESA', N'INESIGIBILE')`;
