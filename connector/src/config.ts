export type ConnectorConfig = {
  port: number;
  db: {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    instanceName?: string;
  };
  defaultTenantSlug: string;
  apiKey: string;
};

export function loadConfig(): ConnectorConfig {
  return {
    port: Number(process.env.CONNECTOR_PORT || 8443),
    db: {
      server: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_NAME || "CredixaDev",
      user: process.env.DB_USER || "credixa_dev",
      password: process.env.DB_PASSWORD || "",
      instanceName: process.env.DB_INSTANCE || "CREDIXA_DEV",
    },
    defaultTenantSlug: process.env.CREDIXA_TENANT_ID || "demo",
    apiKey: (process.env.CONNECTOR_API_KEY || "").trim(),
  };
}
