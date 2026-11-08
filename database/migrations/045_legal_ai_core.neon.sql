-- Credixa Legal AI — core fascicoli (Neon/Postgres), fase 1.
-- Idempotente. Non eseguire su SQL Server / Connector.
-- Nessuna dipendenza da Pratiche, Debitori, Mandanti o PraticaGiudiziale.

-- ---------------------------------------------------------------------------
-- Supporto FK compositi (TenantId + entità figlia)
-- Verifica: nessuna migrazione Neon precedente definisce UNIQUE ("Id","TenantId") su Users;
-- "Id" è PK ma Postgres richiede un vincolo UNIQUE esplicito sulle colonne referenziate.
-- ---------------------------------------------------------------------------
DO $legal_ai_users_uidx$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'Users'
      AND indexname = 'Users_Id_TenantId_uidx'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      WHERE t.relname = 'Users'
        AND i.indisunique
        AND pg_get_indexdef(i.indexrelid) ~ '\("Id", "TenantId"\)'
    ) THEN
      CREATE UNIQUE INDEX "Users_Id_TenantId_uidx" ON "Users" ("Id", "TenantId");
    END IF;
  END IF;
END;
$legal_ai_users_uidx$;

-- ---------------------------------------------------------------------------
-- LegalAiClassificazioni (TenantId NULL = catalogo di sistema; NOT NULL = estensione tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LegalAiClassificazioni" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NULL,
  "Ambito" text NOT NULL,
  "Codice" text NOT NULL,
  "Etichetta" text NOT NULL,
  "Ordine" integer NOT NULL DEFAULT 0,
  "Active" boolean NOT NULL DEFAULT true,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "LegalAiClassificazioni_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
  CONSTRAINT "LegalAiClassificazioni_Ambito_check"
    CHECK (
      "Ambito" IN (
        'FASCICOLO_TIPO',
        'FASCICOLO_MATERIA',
        'DOCUMENTO_TIPO',
        'SCADENZA_TIPO',
        'SOGGETTO_RUOLO'
      )
    )
);

CREATE INDEX IF NOT EXISTS "LegalAiClassificazioni_TenantId_idx"
  ON "LegalAiClassificazioni" ("TenantId");

CREATE INDEX IF NOT EXISTS "LegalAiClassificazioni_TenantAmbito_idx"
  ON "LegalAiClassificazioni" ("TenantId", "Ambito");

CREATE UNIQUE INDEX IF NOT EXISTS "LegalAiClassificazioni_system_ambito_codice_uidx"
  ON "LegalAiClassificazioni" ("Ambito", "Codice")
  WHERE "TenantId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "LegalAiClassificazioni_tenant_ambito_codice_uidx"
  ON "LegalAiClassificazioni" ("TenantId", "Ambito", "Codice")
  WHERE "TenantId" IS NOT NULL;

-- Seed catalogo di sistema (nessun dato personale; id fissi per idempotenza)
INSERT INTO "LegalAiClassificazioni" (
  "Id", "TenantId", "Ambito", "Codice", "Etichetta", "Ordine", "Active"
)
SELECT v."Id", NULL, v."Ambito", v."Codice", v."Etichetta", v."Ordine", true
FROM (
  VALUES
    ('a1000001-0001-4001-8001-000000000001'::uuid, 'FASCICOLO_TIPO', 'GENERALE', 'Generale', 10),
    ('a1000001-0001-4001-8001-000000000002'::uuid, 'FASCICOLO_TIPO', 'CIVILE', 'Civile', 20),
    ('a1000001-0001-4001-8001-000000000003'::uuid, 'FASCICOLO_TIPO', 'PENALE', 'Penale', 30),
    ('a1000001-0001-4001-8001-000000000004'::uuid, 'FASCICOLO_TIPO', 'LAVORO', 'Lavoro', 40),
    ('a1000001-0001-4001-8001-000000000005'::uuid, 'FASCICOLO_TIPO', 'AMMINISTRATIVO', 'Amministrativo', 50),
    ('a1000002-0001-4001-8001-000000000001'::uuid, 'FASCICOLO_MATERIA', 'CONTRATTI', 'Contratti', 10),
    ('a1000002-0001-4001-8001-000000000002'::uuid, 'FASCICOLO_MATERIA', 'RESPONSABILITA', 'Responsabilità civile', 20),
    ('a1000003-0001-4001-8001-000000000001'::uuid, 'SOGGETTO_RUOLO', 'CLIENTE', 'Cliente', 10),
    ('a1000003-0001-4001-8001-000000000002'::uuid, 'SOGGETTO_RUOLO', 'CONTROPARTE', 'Controparte', 20),
    ('a1000003-0001-4001-8001-000000000003'::uuid, 'SOGGETTO_RUOLO', 'CONSULENTE', 'Consulente tecnico', 30),
    ('a1000003-0001-4001-8001-000000000004'::uuid, 'SOGGETTO_RUOLO', 'ALTRO', 'Altro', 99)
) AS v("Id", "Ambito", "Codice", "Etichetta", "Ordine")
WHERE NOT EXISTS (
  SELECT 1
  FROM "LegalAiClassificazioni" c
  WHERE c."TenantId" IS NULL
    AND c."Ambito" = v."Ambito"
    AND c."Codice" = v."Codice"
);

-- ---------------------------------------------------------------------------
-- LegalAiFascicoli
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LegalAiFascicoli" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "Codice" text NOT NULL,
  "Titolo" text NOT NULL,
  "Descrizione" text NULL,
  "Stato" text NOT NULL DEFAULT 'BOZZA',
  "TipoClassificazioneId" uuid NULL,
  "MateriaClassificazioneId" uuid NULL,
  "Foro" text NULL,
  "RiferimentoProcedura" text NULL,
  "DataApertura" date NULL,
  "DataChiusura" date NULL,
  "Priorita" smallint NOT NULL DEFAULT 0,
  "NoteInterne" text NULL,
  "CreatedById" uuid NULL,
  "UpdatedById" uuid NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
  "ArchivedAt" timestamptz NULL,
  CONSTRAINT "LegalAiFascicoli_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
  CONSTRAINT "LegalAiFascicoli_Id_TenantId_key" UNIQUE ("Id", "TenantId"),
  CONSTRAINT "LegalAiFascicoli_TenantId_Codice_key" UNIQUE ("TenantId", "Codice"),
  CONSTRAINT "LegalAiFascicoli_Stato_check"
    CHECK (
      "Stato" IN (
        'BOZZA',
        'APERTO',
        'IN_LAVORAZIONE',
        'SOSPESO',
        'CHIUSO',
        'ARCHIVIATO'
      )
    ),
  CONSTRAINT "LegalAiFascicoli_TipoClassificazioneId_fkey"
    FOREIGN KEY ("TipoClassificazioneId") REFERENCES "LegalAiClassificazioni" ("Id") ON DELETE SET NULL,
  CONSTRAINT "LegalAiFascicoli_MateriaClassificazioneId_fkey"
    FOREIGN KEY ("MateriaClassificazioneId") REFERENCES "LegalAiClassificazioni" ("Id") ON DELETE SET NULL,
  CONSTRAINT "LegalAiFascicoli_CreatedById_fkey"
    FOREIGN KEY ("CreatedById", "TenantId") REFERENCES "Users" ("Id", "TenantId") ON DELETE SET NULL,
  CONSTRAINT "LegalAiFascicoli_UpdatedById_fkey"
    FOREIGN KEY ("UpdatedById", "TenantId") REFERENCES "Users" ("Id", "TenantId") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "LegalAiFascicoli_TenantId_idx"
  ON "LegalAiFascicoli" ("TenantId");

CREATE INDEX IF NOT EXISTS "LegalAiFascicoli_TenantId_Stato_idx"
  ON "LegalAiFascicoli" ("TenantId", "Stato");

CREATE INDEX IF NOT EXISTS "LegalAiFascicoli_TenantId_Codice_idx"
  ON "LegalAiFascicoli" ("TenantId", "Codice");

CREATE INDEX IF NOT EXISTS "LegalAiFascicoli_TenantId_CreatedAt_idx"
  ON "LegalAiFascicoli" ("TenantId", "CreatedAt" DESC);

-- Validazione Tipo/Materia: solo classificazioni attive, ambito corretto, globali o stesso tenant.
CREATE OR REPLACE FUNCTION "LegalAiFascicoli_validate_classificazioni"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."TipoClassificazioneId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "LegalAiClassificazioni" c
      WHERE c."Id" = NEW."TipoClassificazioneId"
        AND c."Active" = true
        AND c."Ambito" = 'FASCICOLO_TIPO'
        AND (c."TenantId" IS NULL OR c."TenantId" = NEW."TenantId")
    ) THEN
      RAISE EXCEPTION
        'TipoClassificazioneId % non valido: richiesta classificazione attiva con Ambito FASCICOLO_TIPO e TenantId NULL o uguale al fascicolo (%)',
        NEW."TipoClassificazioneId",
        NEW."TenantId";
    END IF;
  END IF;

  IF NEW."MateriaClassificazioneId" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "LegalAiClassificazioni" c
      WHERE c."Id" = NEW."MateriaClassificazioneId"
        AND c."Active" = true
        AND c."Ambito" = 'FASCICOLO_MATERIA'
        AND (c."TenantId" IS NULL OR c."TenantId" = NEW."TenantId")
    ) THEN
      RAISE EXCEPTION
        'MateriaClassificazioneId % non valido: richiesta classificazione attiva con Ambito FASCICOLO_MATERIA e TenantId NULL o uguale al fascicolo (%)',
        NEW."MateriaClassificazioneId",
        NEW."TenantId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "LegalAiFascicoli_validate_classificazioni_trg" ON "LegalAiFascicoli";
CREATE TRIGGER "LegalAiFascicoli_validate_classificazioni_trg"
  BEFORE INSERT OR UPDATE ON "LegalAiFascicoli"
  FOR EACH ROW
  EXECUTE PROCEDURE "LegalAiFascicoli_validate_classificazioni"();

-- Impedisce di invalidare fascicoli già collegati (TenantId, Ambito, disattivazione).
CREATE OR REPLACE FUNCTION "LegalAiClassificazioni_guard_linked_fascicoli"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."TenantId" IS DISTINCT FROM NEW."TenantId"
       OR OLD."Ambito" IS DISTINCT FROM NEW."Ambito"
       OR (OLD."Active" IS TRUE AND NEW."Active" IS NOT TRUE) THEN
      IF EXISTS (
        SELECT 1
        FROM "LegalAiFascicoli" f
        WHERE f."TipoClassificazioneId" = OLD."Id"
           OR f."MateriaClassificazioneId" = OLD."Id"
      ) THEN
        RAISE EXCEPTION
          'Classificazione % referenziata da fascicoli: vietato cambiare TenantId, Ambito o impostare Active=false',
          OLD."Id";
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "LegalAiClassificazioni_guard_linked_fascicoli_trg" ON "LegalAiClassificazioni";
CREATE TRIGGER "LegalAiClassificazioni_guard_linked_fascicoli_trg"
  BEFORE UPDATE ON "LegalAiClassificazioni"
  FOR EACH ROW
  EXECUTE PROCEDURE "LegalAiClassificazioni_guard_linked_fascicoli"();

-- ---------------------------------------------------------------------------
-- LegalAiFascicoloStorico (append-only: no UPDATE; DELETE ammesso per CASCADE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LegalAiFascicoloStorico" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "FascicoloId" uuid NOT NULL,
  "TipoEvento" text NOT NULL DEFAULT 'STATO',
  "StatoPrecedente" text NULL,
  "StatoNuovo" text NULL,
  "Nota" text NULL,
  "UserId" uuid NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "LegalAiFascicoloStorico_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
  CONSTRAINT "LegalAiFascicoloStorico_Fascicolo_fkey"
    FOREIGN KEY ("FascicoloId", "TenantId") REFERENCES "LegalAiFascicoli" ("Id", "TenantId") ON DELETE CASCADE,
  CONSTRAINT "LegalAiFascicoloStorico_User_fkey"
    FOREIGN KEY ("UserId", "TenantId") REFERENCES "Users" ("Id", "TenantId") ON DELETE SET NULL,
  CONSTRAINT "LegalAiFascicoloStorico_TipoEvento_check"
    CHECK ("TipoEvento" IN ('STATO', 'NOTA', 'SISTEMA'))
);

CREATE INDEX IF NOT EXISTS "LegalAiFascicoloStorico_TenantId_FascicoloId_idx"
  ON "LegalAiFascicoloStorico" ("TenantId", "FascicoloId");

CREATE INDEX IF NOT EXISTS "LegalAiFascicoloStorico_TenantId_CreatedAt_idx"
  ON "LegalAiFascicoloStorico" ("TenantId", "CreatedAt" DESC);

COMMENT ON TABLE "LegalAiFascicoloStorico" IS
  'Cronologia fascicolo Legal AI: solo INSERT; UPDATE bloccato da trigger; DELETE ammesso (es. CASCADE).';

-- ---------------------------------------------------------------------------
-- LegalAiSoggetti (anagrafiche modulo; non Debitori recovery)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LegalAiSoggetti" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "TipoSoggetto" text NOT NULL DEFAULT 'PF',
  "Denominazione" text NULL,
  "Nome" text NULL,
  "Cognome" text NULL,
  "CodiceFiscale" text NULL,
  "PartitaIva" text NULL,
  "Email" text NULL,
  "Telefono" text NULL,
  "Indirizzo" text NULL,
  "Comune" text NULL,
  "Cap" text NULL,
  "Provincia" text NULL,
  "Note" text NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  "UpdatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "LegalAiSoggetti_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
  CONSTRAINT "LegalAiSoggetti_Id_TenantId_key" UNIQUE ("Id", "TenantId"),
  CONSTRAINT "LegalAiSoggetti_TipoSoggetto_check"
    CHECK ("TipoSoggetto" IN ('PF', 'PG'))
);

CREATE INDEX IF NOT EXISTS "LegalAiSoggetti_TenantId_idx"
  ON "LegalAiSoggetti" ("TenantId");

CREATE INDEX IF NOT EXISTS "LegalAiSoggetti_TenantId_Denominazione_idx"
  ON "LegalAiSoggetti" ("TenantId", "Denominazione");

CREATE INDEX IF NOT EXISTS "LegalAiSoggetti_TenantId_CodiceFiscale_idx"
  ON "LegalAiSoggetti" ("TenantId", "CodiceFiscale")
  WHERE "CodiceFiscale" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- LegalAiFascicoloSoggetti (N:N fascicolo ↔ soggetto, stesso tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LegalAiFascicoloSoggetti" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "FascicoloId" uuid NOT NULL,
  "SoggettoId" uuid NOT NULL,
  "Ruolo" text NOT NULL DEFAULT 'ALTRO',
  "Principale" boolean NOT NULL DEFAULT false,
  "Ordine" integer NOT NULL DEFAULT 0,
  "Note" text NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "LegalAiFascicoloSoggetti_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
  CONSTRAINT "LegalAiFascicoloSoggetti_Fascicolo_fkey"
    FOREIGN KEY ("FascicoloId", "TenantId") REFERENCES "LegalAiFascicoli" ("Id", "TenantId") ON DELETE CASCADE,
  CONSTRAINT "LegalAiFascicoloSoggetti_Soggetto_fkey"
    FOREIGN KEY ("SoggettoId", "TenantId") REFERENCES "LegalAiSoggetti" ("Id", "TenantId") ON DELETE CASCADE,
  CONSTRAINT "LegalAiFascicoloSoggetti_unique_parte"
    UNIQUE ("FascicoloId", "SoggettoId", "Ruolo")
);

CREATE INDEX IF NOT EXISTS "LegalAiFascicoloSoggetti_TenantId_FascicoloId_idx"
  ON "LegalAiFascicoloSoggetti" ("TenantId", "FascicoloId");

CREATE INDEX IF NOT EXISTS "LegalAiFascicoloSoggetti_TenantId_SoggettoId_idx"
  ON "LegalAiFascicoloSoggetti" ("TenantId", "SoggettoId");

-- ---------------------------------------------------------------------------
-- LegalAiAssegnazioni (Users interni / avvocati; validità temporale)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LegalAiAssegnazioni" (
  "Id" uuid PRIMARY KEY,
  "TenantId" uuid NOT NULL,
  "FascicoloId" uuid NOT NULL,
  "UserId" uuid NOT NULL,
  "Ruolo" text NOT NULL,
  "Dal" timestamptz NOT NULL DEFAULT now(),
  "Al" timestamptz NULL,
  "CreatedById" uuid NULL,
  "CreatedAt" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "LegalAiAssegnazioni_TenantId_fkey"
    FOREIGN KEY ("TenantId") REFERENCES "Tenants" ("Id") ON DELETE CASCADE,
  CONSTRAINT "LegalAiAssegnazioni_Fascicolo_fkey"
    FOREIGN KEY ("FascicoloId", "TenantId") REFERENCES "LegalAiFascicoli" ("Id", "TenantId") ON DELETE CASCADE,
  CONSTRAINT "LegalAiAssegnazioni_User_fkey"
    FOREIGN KEY ("UserId", "TenantId") REFERENCES "Users" ("Id", "TenantId") ON DELETE RESTRICT,
  CONSTRAINT "LegalAiAssegnazioni_CreatedBy_fkey"
    FOREIGN KEY ("CreatedById", "TenantId") REFERENCES "Users" ("Id", "TenantId") ON DELETE SET NULL,
  CONSTRAINT "LegalAiAssegnazioni_Ruolo_check"
    CHECK ("Ruolo" IN ('RESPONSABILE', 'COLLABORATORE', 'SUPERVISORE')),
  CONSTRAINT "LegalAiAssegnazioni_Dal_Al_check"
    CHECK ("Al" IS NULL OR "Al" >= "Dal")
);

CREATE INDEX IF NOT EXISTS "LegalAiAssegnazioni_TenantId_FascicoloId_idx"
  ON "LegalAiAssegnazioni" ("TenantId", "FascicoloId");

CREATE INDEX IF NOT EXISTS "LegalAiAssegnazioni_TenantId_UserId_idx"
  ON "LegalAiAssegnazioni" ("TenantId", "UserId");

CREATE INDEX IF NOT EXISTS "LegalAiAssegnazioni_TenantId_Fascicolo_attive_idx"
  ON "LegalAiAssegnazioni" ("TenantId", "FascicoloId", "Ruolo")
  WHERE "Al" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "LegalAiAssegnazioni_one_responsabile_attivo_uidx"
  ON "LegalAiAssegnazioni" ("TenantId", "FascicoloId")
  WHERE "Ruolo" = 'RESPONSABILE' AND "Al" IS NULL;

-- ---------------------------------------------------------------------------
-- Trigger: storico — solo UPDATE vietato (append-only contenuto)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "LegalAiFascicoloStorico_append_only"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'LegalAiFascicoloStorico è append-only: UPDATE non consentito';
END;
$$;

DROP TRIGGER IF EXISTS "LegalAiFascicoloStorico_no_update" ON "LegalAiFascicoloStorico";
CREATE TRIGGER "LegalAiFascicoloStorico_no_update"
  BEFORE UPDATE ON "LegalAiFascicoloStorico"
  FOR EACH ROW
  EXECUTE PROCEDURE "LegalAiFascicoloStorico_append_only"();

COMMENT ON TABLE "LegalAiFascicoli" IS
  'Fascicoli Credixa Legal AI; isolamento per TenantId; nessun legame obbligatorio al recovery.';
COMMENT ON TABLE "LegalAiSoggetti" IS
  'Soggetti anagrafici del modulo Legal AI (distinti da Debitori/Mandanti).';
COMMENT ON TABLE "LegalAiAssegnazioni" IS
  'Assegnazione fascicolo a utenti Credixa (es. AVVOCATO); Ruolo e intervallo Dal/Al.';
