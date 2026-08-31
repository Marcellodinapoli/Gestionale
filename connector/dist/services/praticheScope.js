import { sql } from "../db/pool.js";
/** Applica scope ruolo come clausole SQL AND su alias `p`. */
export function applyScope(scope, req, alias = "p") {
    const clauses = [`${alias}.TenantId = @tenantId`];
    req.input("tenantId", sql.UniqueIdentifier, scope.tenantId);
    const role = scope.role;
    if (role === "ADMIN" || role === "BACK_OFFICE" || role === "AMMINISTRAZIONE") {
        return clauses;
    }
    req.input("scopeUserId", sql.UniqueIdentifier, scope.userId);
    if (role === "OPERATOR") {
        clauses.push(`(${alias}.AssegnatarioId = @scopeUserId OR ${alias}.OperatoreTitolareId = @scopeUserId)`);
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
        return clauses;
    }
    clauses.push(`(${alias}.AssegnatarioId = @scopeUserId OR ${alias}.OperatoreTitolareId = @scopeUserId)`);
    return clauses;
}
