-- Performance monitoring Credixa (Neon/Postgres).
-- Idempotente. Non eseguire sul SQL Server / Connector.
-- Dipende da Tenants.PerfMonitoringEnabled (038_platform_tenants.neon.sql).

-- ---------------------------------------------------------------------------
-- PerfSessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PerfSessions" (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id") ON DELETE CASCADE,
  "SessionId" text NOT NULL,
  "UserId" text NULL,
  "UserRole" text NULL,
  "StartedAt" timestamptz NOT NULL DEFAULT now(),
  "LastEventAt" timestamptz NULL,
  "EndedAt" timestamptz NULL,
  "UserAgent" text NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PerfSessions_SessionId_unique" UNIQUE ("SessionId")
);

CREATE INDEX IF NOT EXISTS "PerfSessions_TenantId_SessionId_idx"
  ON "PerfSessions" ("TenantId", "SessionId");

CREATE INDEX IF NOT EXISTS "PerfSessions_TenantId_StartedAt_idx"
  ON "PerfSessions" ("TenantId", "StartedAt" DESC);

-- ---------------------------------------------------------------------------
-- PerfEvents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "PerfEvents" (
  "Id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "TenantId" uuid NOT NULL REFERENCES "Tenants"("Id") ON DELETE CASCADE,
  "SessionId" text NOT NULL,
  "Timestamp" timestamptz NOT NULL DEFAULT now(),
  "Type" text NOT NULL,
  "Route" text NULL,
  "Action" text NULL,
  "Name" text NULL,
  "DurationMs" integer NULL,
  "Status" text NULL,
  "Metadata" jsonb NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "PerfEvents_Type_check"
    CHECK ("Type" IN ('PAGE', 'ACTION', 'API', 'QUERY', 'ERROR', 'SESSION'))
);

CREATE INDEX IF NOT EXISTS "PerfEvents_TenantId_SessionId_idx"
  ON "PerfEvents" ("TenantId", "SessionId");

CREATE INDEX IF NOT EXISTS "PerfEvents_TenantId_Timestamp_idx"
  ON "PerfEvents" ("TenantId", "Timestamp" DESC);

CREATE INDEX IF NOT EXISTS "PerfEvents_SessionId_Timestamp_idx"
  ON "PerfEvents" ("SessionId", "Timestamp");

-- Retention breve: i job futuri possono eliminare per CreatedAt (vedi PERF_RETENTION_DAYS).
COMMENT ON TABLE "PerfSessions" IS 'Sessioni performance Credixa; retention breve (default 14 giorni).';
COMMENT ON TABLE "PerfEvents" IS 'Eventi performance tenant-scoped; non contenere dati sensibili in Metadata.';
