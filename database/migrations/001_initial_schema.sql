-- CredixaDev — schema iniziale (relazionale, multi-tenant)
-- Eseguire su database CredixaDev dopo creazione istanza CREDIXA_DEV

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tenants')
BEGIN
  CREATE TABLE dbo.Tenants (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Tenants PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    Slug        NVARCHAR(50)     NOT NULL,
    Nome        NVARCHAR(200)    NOT NULL,
    Active      BIT              NOT NULL CONSTRAINT DF_Tenants_Active DEFAULT 1,
    CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_Tenants_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Tenants_Slug UNIQUE (Slug)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Sedi')
BEGIN
  CREATE TABLE dbo.Sedi (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Sedi PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    Nome        NVARCHAR(120)    NOT NULL,
    Indirizzo   NVARCHAR(300)    NULL,
    Citta       NVARCHAR(100)    NULL,
    Cap         NVARCHAR(10)     NULL,
    Provincia   NVARCHAR(5)      NULL,
    Telefono    NVARCHAR(30)     NULL,
    Email       NVARCHAR(200)    NULL,
    Note        NVARCHAR(MAX)    NULL,
    Active      BIT              NOT NULL CONSTRAINT DF_Sedi_Active DEFAULT 1,
    CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_Sedi_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Sedi_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_Sedi_Tenant_Nome UNIQUE (TenantId, Nome)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Postazioni')
BEGIN
  CREATE TABLE dbo.Postazioni (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Postazioni PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    SedeId      UNIQUEIDENTIFIER NULL,
    Nome        NVARCHAR(120)    NOT NULL,
    Interno     NVARCHAR(30)     NULL,
    Email       NVARCHAR(200)    NULL,
    NumeroFisso NVARCHAR(30)     NULL,
    Note        NVARCHAR(MAX)    NULL,
    Active      BIT              NOT NULL CONSTRAINT DF_Postazioni_Active DEFAULT 1,
    CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_Postazioni_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Postazioni_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Postazioni_Sede FOREIGN KEY (SedeId) REFERENCES dbo.Sedi(Id),
    CONSTRAINT UQ_Postazioni_Tenant_Nome UNIQUE (TenantId, Nome)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Users')
BEGIN
  CREATE TABLE dbo.Users (
    Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId           UNIQUEIDENTIFIER NOT NULL,
    Email              NVARCHAR(320)    NOT NULL,
    Name               NVARCHAR(200)    NOT NULL,
    PasswordHash       NVARCHAR(500)    NOT NULL,
    PasswordChangedAt  DATETIME2(3)     NOT NULL CONSTRAINT DF_Users_PasswordChangedAt DEFAULT SYSUTCDATETIME(),
    Role               NVARCHAR(50)     NOT NULL,
    Acronimo           NVARCHAR(20)     NULL,
    FormazioneOnly     BIT              NOT NULL CONSTRAINT DF_Users_FormazioneOnly DEFAULT 0,
    Interno            NVARCHAR(30)     NULL,
    PrefissoChiamata   NVARCHAR(20)     NULL,
    Active             BIT              NOT NULL CONSTRAINT DF_Users_Active DEFAULT 1,
    SupervisorId       UNIQUEIDENTIFIER NULL,
    GruppoNome         NVARCHAR(120)    NULL,
    GruppoMandantiJson NVARCHAR(MAX)    NULL,
    PostazioneId       UNIQUEIDENTIFIER NULL,
    PostazioneFissa    BIT              NOT NULL CONSTRAINT DF_Users_PostazioneFissa DEFAULT 0,
    SedeId             UNIQUEIDENTIFIER NULL,
    LastLoginAt        DATETIME2(3)     NULL,
    LastLogoutAt       DATETIME2(3)     NULL,
    CreatedAt          DATETIME2(3)     NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Users_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Users_Supervisor FOREIGN KEY (SupervisorId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_Users_Postazione FOREIGN KEY (PostazioneId) REFERENCES dbo.Postazioni(Id),
    CONSTRAINT FK_Users_Sede FOREIGN KEY (SedeId) REFERENCES dbo.Sedi(Id),
    CONSTRAINT UQ_Users_Tenant_Email UNIQUE (TenantId, Email)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PasswordHistory')
BEGIN
  CREATE TABLE dbo.PasswordHistory (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PasswordHistory PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    UserId       UNIQUEIDENTIFIER NOT NULL,
    PasswordHash NVARCHAR(500)    NOT NULL,
    CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_PasswordHistory_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PasswordHistory_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Mandanti')
BEGIN
  CREATE TABLE dbo.Mandanti (
    Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Mandanti PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId        UNIQUEIDENTIFIER NOT NULL,
    Codice          NVARCHAR(50)     NOT NULL,
    RagioneSociale  NVARCHAR(300)    NOT NULL,
    Email           NVARCHAR(200)    NULL,
    Telefono        NVARCHAR(30)     NULL,
    PerimetriJson   NVARCHAR(MAX)    NULL,
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_Mandanti_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Mandanti_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_Mandanti_Tenant_Codice UNIQUE (TenantId, Codice)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Debitori')
BEGIN
  CREATE TABLE dbo.Debitori (
    Id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Debitori PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId      UNIQUEIDENTIFIER NOT NULL,
    Nome          NVARCHAR(120)    NOT NULL,
    Cognome       NVARCHAR(120)    NOT NULL CONSTRAINT DF_Debitori_Cognome DEFAULT N'',
    CodiceFiscale NVARCHAR(20)     NULL,
    Telefono      NVARCHAR(30)     NULL,
    Email         NVARCHAR(200)    NULL,
    Indirizzo     NVARCHAR(300)    NULL,
    Citta         NVARCHAR(100)    NULL,
    Cap           NVARCHAR(10)     NULL,
    Provincia     NVARCHAR(5)      NULL,
    CreatedAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Debitori_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Debitori_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DebitoreRecapiti')
BEGIN
  CREATE TABLE dbo.DebitoreRecapiti (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_DebitoreRecapiti PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    DebitoreId UNIQUEIDENTIFIER NOT NULL,
    Tipo       NVARCHAR(30)     NOT NULL,
    Valore     NVARCHAR(200)    NOT NULL,
    Stato      NVARCHAR(30)     NULL,
    Ordine     INT              NOT NULL CONSTRAINT DF_DebitoreRecapiti_Ordine DEFAULT 1,
    CreatedAt  DATETIME2(3)     NOT NULL CONSTRAINT DF_DebitoreRecapiti_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_DebitoreRecapiti_Debitore FOREIGN KEY (DebitoreId) REFERENCES dbo.Debitori(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ImportBatch')
BEGIN
  CREATE TABLE dbo.ImportBatch (
    Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ImportBatch PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId       UNIQUEIDENTIFIER NOT NULL,
    Tipo           NVARCHAR(30)     NOT NULL CONSTRAINT DF_ImportBatch_Tipo DEFAULT N'PRATICHE',
    MandanteId     UNIQUEIDENTIFIER NOT NULL,
    MandanteCodice NVARCHAR(50)     NOT NULL,
    Perimetro      NVARCHAR(100)    NOT NULL,
    Lotto          NVARCHAR(100)    NOT NULL,
    AffidoIl       DATETIME2(3)     NOT NULL,
    ScadenzaMandato DATETIME2(3)    NULL,
    FileName       NVARCHAR(300)    NULL,
    NPratiche      INT              NOT NULL CONSTRAINT DF_ImportBatch_NPratiche DEFAULT 0,
    CreatedById    UNIQUEIDENTIFIER NULL,
    CreatedByName  NVARCHAR(200)    NULL,
    CreatedAt      DATETIME2(3)     NOT NULL CONSTRAINT DF_ImportBatch_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ImportBatch_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ImportBatch_Mandante FOREIGN KEY (MandanteId) REFERENCES dbo.Mandanti(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Pratiche')
BEGIN
  CREATE TABLE dbo.Pratiche (
    Id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Pratiche PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId             UNIQUEIDENTIFIER NOT NULL,
    Numero               NVARCHAR(50)     NOT NULL,
    NumeroMandante       NVARCHAR(100)    NULL,
    Contratto            NVARCHAR(100)    NULL,
    Commessa             NVARCHAR(100)    NULL,
    MandanteId           UNIQUEIDENTIFIER NOT NULL,
    DebitoreId           UNIQUEIDENTIFIER NOT NULL,
    AssegnatarioId       UNIQUEIDENTIFIER NULL,
    OperatoreTitolareId  UNIQUEIDENTIFIER NULL,
    Stato                NVARCHAR(50)     NOT NULL CONSTRAINT DF_Pratiche_Stato DEFAULT N'NUOVA',
    Capitale             DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Pratiche_Capitale DEFAULT 0,
    Interessi            DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Pratiche_Interessi DEFAULT 0,
    Spese                DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Pratiche_Spese DEFAULT 0,
    ImportoTotale        AS (Capitale + Interessi + Spese) PERSISTED,
    TotIncassato         DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Pratiche_TotIncassato DEFAULT 0,
    Residuo              DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Pratiche_Residuo DEFAULT 0,
    NumeroRateScadute    INT              NOT NULL CONSTRAINT DF_Pratiche_NumeroRateScadute DEFAULT 0,
    CodiceScarico        NVARCHAR(20)     NULL,
    CodiceScaricoAt      DATETIME2(3)     NULL,
    DataAffido           DATETIME2(3)     NULL,
    Scadenza             DATETIME2(3)     NULL,
    EsitoContatto        NVARCHAR(50)     NULL,
    MemoAt               DATETIME2(3)     NULL,
    PromessaAt           DATETIME2(3)     NULL,
    PromessaImporto      DECIMAL(18,2)    NULL,
    UltimaLavorazioneAt  DATETIME2(3)     NULL,
    Note                 NVARCHAR(MAX)    NULL,
    ImportBatchId        UNIQUEIDENTIFIER NULL,
    CreatedAt            DATETIME2(3)     NOT NULL CONSTRAINT DF_Pratiche_CreatedAt DEFAULT SYSUTCDATETIME(),
    UpdatedAt            DATETIME2(3)     NOT NULL CONSTRAINT DF_Pratiche_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Pratiche_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Pratiche_Mandante FOREIGN KEY (MandanteId) REFERENCES dbo.Mandanti(Id),
    CONSTRAINT FK_Pratiche_Debitore FOREIGN KEY (DebitoreId) REFERENCES dbo.Debitori(Id),
    CONSTRAINT FK_Pratiche_Assegnatario FOREIGN KEY (AssegnatarioId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_Pratiche_Titolare FOREIGN KEY (OperatoreTitolareId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_Pratiche_ImportBatch FOREIGN KEY (ImportBatchId) REFERENCES dbo.ImportBatch(Id),
    CONSTRAINT UQ_Pratiche_Tenant_Numero UNIQUE (TenantId, Numero)
  );
END
GO
