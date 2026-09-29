export type DatabaseProvider = "firestore" | "connector" | "neon";

export function getDatabaseProvider(): DatabaseProvider {
  const raw = (process.env.DATABASE_PROVIDER || "firestore").trim().toLowerCase();
  if (raw === "connector") return "connector";
  if (raw === "neon") return "neon";
  // sqlite locale non è più supportato come provider operativo
  if (raw === "sqlite") {
    throw new Error(
      "DATABASE_PROVIDER=sqlite non è più supportato. Usa neon (stesso DB di Netlify) o connector."
    );
  }
  return "firestore";
}

export function isNeonProvider() {
  return getDatabaseProvider() === "neon";
}

export function getConnectorBaseUrl(): string {
  return (process.env.CONNECTOR_BASE_URL || "http://localhost:8443").replace(/\/$/, "");
}

export function getConnectorApiKey(): string | undefined {
  const key = (process.env.CONNECTOR_API_KEY || "").trim();
  return key || undefined;
}
