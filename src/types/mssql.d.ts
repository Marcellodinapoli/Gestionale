declare module "mssql" {
  // Tipizzazione minimale: evita TS7016 e mantiene `sql.X` usabile.
  const mssql: any;
  export default mssql;
}
