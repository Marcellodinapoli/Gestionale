-- Portafogli UTP/NPL su Neon/Postgres — isolamento per "TenantId".
-- Non eseguire sul DB cliente se non richiesto.

CREATE TABLE IF NOT EXISTS "Portafogli" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "Nome" text NOT NULL,
  "Codice" text,
  "Venditore" text,
  "Tipo" text NOT NULL DEFAULT 'NPL',
  "Stato" text NOT NULL DEFAULT 'IN_VALUTAZIONE',
  "DataCutoff" timestamptz,
  "DataAcquisto" timestamptz,
  "NominaleDichiarato" double precision NOT NULL DEFAULT 0,
  "PrezzoOfferto" double precision,
  "PrezzoPagato" double precision,
  "SpeseAcquisto" double precision NOT NULL DEFAULT 0,
  "RecuperoAtteso" double precision,
  "Note" text,
  "CreatedById" uuid,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Portafogli_TenantId_idx" ON "Portafogli" ("TenantId");
CREATE INDEX IF NOT EXISTS "Portafogli_TenantStato_idx" ON "Portafogli" ("TenantId", "Stato");

ALTER TABLE "Pratiche" ADD COLUMN IF NOT EXISTS "PortafoglioId" uuid;
CREATE INDEX IF NOT EXISTS "Pratiche_TenantPortafoglio_idx" ON "Pratiche" ("TenantId", "PortafoglioId");
