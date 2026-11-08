-- Colonne dialer 014–015 su Neon (se le tabelle esistono già senza questi campi)

ALTER TABLE "DialerCampagne" ADD COLUMN IF NOT EXISTS "LockTimeoutSec" integer NOT NULL DEFAULT 120;

ALTER TABLE "DialerCampagnaOperatori" ADD COLUMN IF NOT EXISTS "CallIdCorrente" text;
ALTER TABLE "DialerCampagnaOperatori" ADD COLUMN IF NOT EXISTS "LastHeartbeatAt" timestamptz;

ALTER TABLE "DialerCampagnaPratiche" ADD COLUMN IF NOT EXISTS "ProssimoTentativoAt" timestamptz;
ALTER TABLE "DialerCampagnaPratiche" ADD COLUMN IF NOT EXISTS "NumeroTelefonicoUtilizzato" text NOT NULL DEFAULT '';
ALTER TABLE "DialerCampagnaPratiche" ADD COLUMN IF NOT EXISTS "LockedByCallId" text;
ALTER TABLE "DialerCampagnaPratiche" ADD COLUMN IF NOT EXISTS "LockedAt" timestamptz;

ALTER TABLE "DialerChiamataEventi" ADD COLUMN IF NOT EXISTS "CallId" text NOT NULL DEFAULT '';
ALTER TABLE "DialerChiamataEventi" ADD COLUMN IF NOT EXISTS "ProviderEventId" text;
ALTER TABLE "DialerChiamataEventi" ADD COLUMN IF NOT EXISTS "DedupKey" text NOT NULL DEFAULT '';
ALTER TABLE "DialerChiamataEventi" ADD COLUMN IF NOT EXISTS "Applied" boolean NOT NULL DEFAULT true;
ALTER TABLE "DialerChiamataEventi" ADD COLUMN IF NOT EXISTS "SkipReason" text;

CREATE UNIQUE INDEX IF NOT EXISTS "DialerChiamataEventi_Campagna_DedupKey_key"
  ON "DialerChiamataEventi" ("CampagnaId", "DedupKey");
CREATE INDEX IF NOT EXISTS "DialerChiamataEventi_CampagnaCallId_idx"
  ON "DialerChiamataEventi" ("CampagnaId", "CallId");
