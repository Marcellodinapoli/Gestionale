export type DatabaseProvider = "firestore" | "connector" | "sqlite";

export function getDatabaseProvider(): DatabaseProvider {
  const raw = (process.env.DATABASE_PROVIDER || "firestore").trim().toLowerCase();
  if (raw === "connector") return "connector";
  if (raw === "sqlite") return "sqlite";
  return "firestore";
}

export function isSqliteProvider() {
  return getDatabaseProvider() === "sqlite";
}

export function getConnectorBaseUrl(): string {
  return (process.env.CONNECTOR_BASE_URL || "http://localhost:8443").replace(/\/$/, "");
}

export function getConnectorApiKey(): string | undefined {
  const key = (process.env.CONNECTOR_API_KEY || "").trim();
  return key || undefined;
}
