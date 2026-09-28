-- SuspendedAt: timestamp sospensione tenant (platform).
-- Idempotente. Solo Neon/Postgres.

ALTER TABLE "Tenants" ADD COLUMN IF NOT EXISTS "SuspendedAt" timestamptz;

-- Backfill: se già SOSPESA e senza data, usa CreatedAt come fallback debole
UPDATE "Tenants"
SET "SuspendedAt" = COALESCE("SuspendedAt", now())
WHERE "Status" = 'SOSPESA' AND "SuspendedAt" IS NULL;
