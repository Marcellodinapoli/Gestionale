-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "acronimo" TEXT,
    "interno" TEXT,
    "prefissoChiamata" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "supervisorId" TEXT,
    "gruppoNome" TEXT,
    "gruppoMandanti" TEXT,
    "postazioneId" TEXT,
    "lastLoginAt" DATETIME,
    "lastLogoutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_postazioneId_fkey" FOREIGN KEY ("postazioneId") REFERENCES "Postazione" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Postazione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "interno" TEXT,
    "email" TEXT,
    "numeroFisso" TEXT,
    "sede" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Postazione_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mandante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "codice" TEXT NOT NULL,
    "ragioneSociale" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "indirizzo" TEXT,
    "citta" TEXT,
    "cap" TEXT,
    "provincia" TEXT,
    "provvigionePerc" REAL,
    "provvigioniMetodo" TEXT,
    "incentivoTipo" TEXT,
    "incentivoValore" REAL,
    "incentivoSoglia" REAL,
    "incentivoNote" TEXT,
    "codiciScarico" TEXT,
    "smsPreimpostati" TEXT,
    "perimetri" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mandante_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Debitore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL DEFAULT '',
    "codiceFiscale" TEXT,
    "telefono" TEXT,
    "telefonoStato" TEXT,
    "email" TEXT,
    "indirizzo" TEXT,
    "citta" TEXT,
    "cap" TEXT,
    "provincia" TEXT,
    "ndg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debitore_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DebitoreRecapito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debitoreId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "stato" TEXT,
    "ordine" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebitoreRecapito_debitoreId_fkey" FOREIGN KEY ("debitoreId") REFERENCES "Debitore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pratica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "numeroMandante" TEXT,
    "mandanteId" TEXT NOT NULL,
    "debitoreId" TEXT NOT NULL,
    "assegnatarioId" TEXT,
    "operatoreTitolareId" TEXT,
    "stato" TEXT NOT NULL DEFAULT 'NUOVA',
    "capitale" REAL NOT NULL DEFAULT 0,
    "interessi" REAL NOT NULL DEFAULT 0,
    "spese" REAL NOT NULL DEFAULT 0,
    "residuo" REAL NOT NULL DEFAULT 0,
    "codiceScarico" TEXT,
    "dataAffido" DATETIME,
    "scadenza" DATETIME,
    "esitoContatto" TEXT,
    "tipoContatto" TEXT,
    "memoAt" DATETIME,
    "promessaAt" DATETIME,
    "promessaImporto" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pratica_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pratica_mandanteId_fkey" FOREIGN KEY ("mandanteId") REFERENCES "Mandante" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pratica_debitoreId_fkey" FOREIGN KEY ("debitoreId") REFERENCES "Debitore" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Pratica_assegnatarioId_fkey" FOREIGN KEY ("assegnatarioId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Pratica_operatoreTitolareId_fkey" FOREIGN KEY ("operatoreTitolareId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PraticaLock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastHeartbeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PraticaLock_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PraticaLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Garante" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL DEFAULT '',
    "codiceFiscale" TEXT,
    "telefono" TEXT,
    "telefonoStato" TEXT,
    "email" TEXT,
    "indirizzo" TEXT,
    "citta" TEXT,
    "cap" TEXT,
    "provincia" TEXT,
    "ordine" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Garante_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GaranteRecapito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "garanteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "stato" TEXT,
    "ordine" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GaranteRecapito_garanteId_fkey" FOREIGN KEY ("garanteId") REFERENCES "Garante" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessaggioInterno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "testo" TEXT NOT NULL,
    "letto" BOOLEAN NOT NULL DEFAULT false,
    "lettoAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessaggioInterno_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessaggioInterno_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessaggioInterno_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessaggioAgenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoAt" DATETIME NOT NULL,
    "line" TEXT NOT NULL,
    "letto" BOOLEAN NOT NULL DEFAULT false,
    "lettoAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessaggioAgenda_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessaggioAgenda_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpegnoAgenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "nota" TEXT,
    "memoAt" DATETIME NOT NULL,
    "completato" BOOLEAN NOT NULL DEFAULT false,
    "completatoAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpegnoAgenda_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attivita" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "esito" TEXT,
    "nota" TEXT,
    "scheduledAt" DATETIME,
    "fissata" BOOLEAN NOT NULL DEFAULT false,
    "importante" BOOLEAN NOT NULL DEFAULT false,
    "bloccata" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attivita_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attivita_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Incasso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importo" REAL NOT NULL,
    "capitale" REAL NOT NULL DEFAULT 0,
    "interessi" REAL NOT NULL DEFAULT 0,
    "spese" REAL NOT NULL DEFAULT 0,
    "speseRec" REAL NOT NULL DEFAULT 0,
    "metodo" TEXT NOT NULL DEFAULT 'bonifico',
    "modo" TEXT NOT NULL DEFAULT 'VE',
    "causale" TEXT NOT NULL DEFAULT '',
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataScadenza" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Incasso_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Incasso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Provvigione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incassoId" TEXT NOT NULL,
    "praticaId" TEXT NOT NULL,
    "operatoreId" TEXT NOT NULL,
    "baseImporto" REAL NOT NULL,
    "percentuale" REAL NOT NULL,
    "importo" REAL NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'MATURATA',
    "liquidataAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Provvigione_incassoId_fkey" FOREIGN KEY ("incassoId") REFERENCES "Incasso" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Provvigione_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Provvigione_operatoreId_fkey" FOREIGN KEY ("operatoreId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fattura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "causale" TEXT NOT NULL DEFAULT '',
    "dataFattura" DATETIME NOT NULL,
    "dataScadenza" DATETIME NOT NULL,
    "importo" REAL NOT NULL,
    "pagato" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Fattura_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PianoRata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "numeroRata" INTEGER NOT NULL,
    "importo" REAL NOT NULL,
    "scadenza" DATETIME NOT NULL,
    "pagata" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PianoRata_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'allegato',
    "path" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Documento_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegistrazioneChiamata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "praticaId" TEXT NOT NULL,
    "operatoreId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "direzione" TEXT NOT NULL DEFAULT 'uscita',
    "stato" TEXT NOT NULL DEFAULT 'CONFERMATA_UI',
    "esito" TEXT,
    "durataSec" INTEGER NOT NULL DEFAULT 0,
    "fileName" TEXT NOT NULL DEFAULT '',
    "evidenzaBackOffice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistrazioneChiamata_praticaId_fkey" FOREIGN KEY ("praticaId") REFERENCES "Pratica" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegistrazioneChiamata_operatoreId_fkey" FOREIGN KEY ("operatoreId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "dettaglio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfigurazioneSistema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "chiave" TEXT NOT NULL,
    "valore" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConfigurazioneSistema_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "Postazione_tenantId_idx" ON "Postazione"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Postazione_tenantId_nome_key" ON "Postazione"("tenantId", "nome");

-- CreateIndex
CREATE INDEX "Mandante_tenantId_idx" ON "Mandante"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Mandante_tenantId_codice_key" ON "Mandante"("tenantId", "codice");

-- CreateIndex
CREATE INDEX "Debitore_tenantId_idx" ON "Debitore"("tenantId");

-- CreateIndex
CREATE INDEX "Pratica_tenantId_idx" ON "Pratica"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Pratica_tenantId_numero_key" ON "Pratica"("tenantId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "PraticaLock_praticaId_key" ON "PraticaLock"("praticaId");

-- CreateIndex
CREATE UNIQUE INDEX "Provvigione_incassoId_key" ON "Provvigione"("incassoId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "ConfigurazioneSistema_tenantId_idx" ON "ConfigurazioneSistema"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurazioneSistema_tenantId_chiave_key" ON "ConfigurazioneSistema"("tenantId", "chiave");
