-- Predictive Dialer su Neon/Postgres (allineato a 013–015 SQL Server)

CREATE TABLE IF NOT EXISTS "DialerCampagne" (
  "Id" text PRIMARY KEY,
  "TenantId" text NOT NULL,
  "Nome" text NOT NULL,
  "Descrizione" text NOT NULL DEFAULT '',
  "CodiciScarico" text NOT NULL DEFAULT '[]',
  "PostCallSec" integer NOT NULL DEFAULT 60,
  "LockTimeoutSec" integer NOT NULL DEFAULT 120,
  "Stato" text NOT NULL DEFAULT 'BOZZA',
  "PacingRatio" double precision,
  "ExternalId" text,
  "CreatedById" text NOT NULL,
  "SupervisorId" text,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
  "ActivatedAt" timestamptz
);

CREATE INDEX IF NOT EXISTS "DialerCampagne_TenantId_idx" ON "DialerCampagne" ("TenantId");
CREATE INDEX IF NOT EXISTS "DialerCampagne_TenantStato_idx" ON "DialerCampagne" ("TenantId", "Stato");

CREATE TABLE IF NOT EXISTS "DialerCampagnaOperatori" (
  "Id" text PRIMARY KEY,
  "CampagnaId" text NOT NULL REFERENCES "DialerCampagne" ("Id") ON DELETE CASCADE,
  "OperatoreId" text NOT NULL,
  "InvitatoAt" timestamptz NOT NULL DEFAULT now(),
  "AccettatoAt" timestamptz,
  "SessioneStato" text NOT NULL DEFAULT 'offline',
  "PausaInizioAt" timestamptz,
  "UscitaAt" timestamptz,
  "ChiamateCount" integer NOT NULL DEFAULT 0,
  "DurataTotaleSec" integer NOT NULL DEFAULT 0,
  "PraticaCorrenteId" text,
  "CallIdCorrente" text,
  "PostCallFineAt" timestamptz,
  "LastHeartbeatAt" timestamptz,
  UNIQUE ("CampagnaId", "OperatoreId")
);

CREATE INDEX IF NOT EXISTS "DialerCampagnaOperatori_Op_idx" ON "DialerCampagnaOperatori" ("OperatoreId");

CREATE TABLE IF NOT EXISTS "DialerCampagnaPratiche" (
  "Id" text PRIMARY KEY,
  "CampagnaId" text NOT NULL REFERENCES "DialerCampagne" ("Id") ON DELETE CASCADE,
  "PraticaId" text NOT NULL,
  "Stato" text NOT NULL DEFAULT 'disponibile',
  "Tentativi" integer NOT NULL DEFAULT 0,
  "UltimoEsito" text,
  "UltimaChiamataAt" timestamptz,
  "ProssimoTentativoAt" timestamptz,
  "NumeroTelefonicoUtilizzato" text NOT NULL DEFAULT '',
  "LockedByOperatoreId" text,
  "LockedByCallId" text,
  "LockedAt" timestamptz,
  UNIQUE ("CampagnaId", "PraticaId")
);

CREATE INDEX IF NOT EXISTS "DialerCampagnaPratiche_CampagnaStato_idx"
  ON "DialerCampagnaPratiche" ("CampagnaId", "Stato");

CREATE TABLE IF NOT EXISTS "DialerChiamataEventi" (
  "Id" text PRIMARY KEY,
  "CampagnaId" text NOT NULL REFERENCES "DialerCampagne" ("Id") ON DELETE CASCADE,
  "OperatoreId" text,
  "PraticaId" text,
  "Numero" text NOT NULL DEFAULT '',
  "Tipo" text NOT NULL,
  "Esito" text,
  "DurataSec" integer NOT NULL DEFAULT 0,
  "CallId" text NOT NULL DEFAULT '',
  "ExternalCallId" text,
  "ProviderEventId" text,
  "DedupKey" text NOT NULL DEFAULT '',
  "Applied" boolean NOT NULL DEFAULT true,
  "SkipReason" text,
  "Metadata" text NOT NULL DEFAULT '{}',
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("CampagnaId", "DedupKey")
);

CREATE INDEX IF NOT EXISTS "DialerChiamataEventi_CampagnaCreated_idx"
  ON "DialerChiamataEventi" ("CampagnaId", "CreatedAt");
CREATE INDEX IF NOT EXISTS "DialerChiamataEventi_CampagnaCallId_idx"
  ON "DialerChiamataEventi" ("CampagnaId", "CallId");
