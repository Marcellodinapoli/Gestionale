-- Platform tenants Credixa (Neon/Postgres) — anagrafica, stato, abbonamento, invite.
-- Idempotente. Non eseguire sul SQL Server / Connector.

-- ---------------------------------------------------------------------------
-- Tenants: colonne platform
-- ---------------------------------------------------------------------------
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Status" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "PartitaIva" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "CodiceFiscale" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "EmailAziendale" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Telefono" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Indirizzo" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Cap" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Comune" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Provincia" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "ReferenteNome" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "ReferenteCognome" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "ReferenteEmail" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "ReferenteTelefono" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "Piano" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "DataInizioAbbonamento" timestamptz;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "DataScadenzaAbbonamento" timestamptz;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "StatoPagamento" text;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "PerfMonitoringEnabled" boolean;
ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "SuspensionReason" text;

-- Backfill Status da Active (solo dove Status è ancora NULL)
UPDATE "Tenants"
SET "Status" = CASE
  WHEN COALESCE("Active", true) THEN 'ATTIVA'
  ELSE 'SOSPESA'
END
WHERE "Status" IS NULL;

UPDATE "Tenants"
SET "PerfMonitoringEnabled" = false
WHERE "PerfMonitoringEnabled" IS NULL;

ALTER TABLE "Tenants" ALTER COLUMN "Status" SET DEFAULT 'ATTIVA';
ALTER TABLE "Tenants" ALTER COLUMN "Status" SET NOT NULL;
ALTER TABLE "Tenants" ALTER COLUMN "PerfMonitoringEnabled" SET DEFAULT false;
ALTER TABLE "Tenants" ALTER COLUMN "PerfMonitoringEnabled" SET NOT NULL;

-- CHECK Status (drop+recreate per idempotenza)
ALTER TABLE "Tenants" DROP CONSTRAINT IF EXISTS "Tenants_Status_check";
ALTER TABLE "Tenants"
  ADD CONSTRAINT "Tenants_Status_check"
  CHECK ("Status" IN ('IN_CONFIGURAZIONE', 'ATTIVA', 'SOSPESA'));

ALTER TABLE "Tenants" DROP CONSTRAINT IF EXISTS "Tenants_StatoPagamento_check";
ALTER TABLE "Tenants"
  ADD CONSTRAINT "Tenants_StatoPagamento_check"
  CHECK (
    "StatoPagamento" IS NULL
    OR "StatoPagamento" IN ('NON_IMPOSTATO', 'IN_REGOLA', 'IN_RITARDO', 'SOSPESO')
  );

-- ---------------------------------------------------------------------------
-- TenantInvites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TenantInvites" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "Email" text NOT NULL,
  "Role" text NOT NULL DEFAULT 'ADMIN',
  "TokenHash" text NOT NULL,
  "ExpiresAt" timestamptz NOT NULL,
  "UsedAt" timestamptz,
  "CreatedByPlatformAdmin" text NOT NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "TenantInvites_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantInvites_TokenHash_key"
  ON "TenantInvites" ("TokenHash");

CREATE INDEX IF NOT EXISTS "TenantInvites_TenantId_idx"
  ON "TenantInvites" ("TenantId");

CREATE INDEX IF NOT EXISTS "TenantInvites_TenantEmail_idx"
  ON "TenantInvites" ("TenantId", "Email");
