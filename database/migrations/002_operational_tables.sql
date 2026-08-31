-- CredixaDev — tabelle operative (Garanti, Incassi, Attivita, Lock, messaggistica, audit)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Garanti')
BEGIN
  CREATE TABLE dbo.Garanti (
    Id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Garanti PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId      UNIQUEIDENTIFIER NOT NULL,
    PraticaId     UNIQUEIDENTIFIER NOT NULL,
    Nome          NVARCHAR(120)    NOT NULL,
    Cognome       NVARCHAR(120)    NOT NULL CONSTRAINT DF_Garanti_Cognome DEFAULT N'',
    CodiceFiscale NVARCHAR(20)     NULL,
    Telefono      NVARCHAR(30)     NULL,
    TelefonoStato NVARCHAR(30)     NULL,
    Email         NVARCHAR(200)    NULL,
    Indirizzo     NVARCHAR(300)    NULL,
    Citta         NVARCHAR(100)    NULL,
    Cap           NVARCHAR(10)     NULL,
    Provincia     NVARCHAR(5)      NULL,
    Ordine        INT              NOT NULL CONSTRAINT DF_Garanti_Ordine DEFAULT 1,
    CreatedAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_Garanti_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Garanti_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_Garanti_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GaranteRecapiti')
BEGIN
  CREATE TABLE dbo.GaranteRecapiti (
    Id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_GaranteRecapiti PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    GaranteId UNIQUEIDENTIFIER NOT NULL,
    Tipo      NVARCHAR(30)     NOT NULL,
    Valore    NVARCHAR(200)    NOT NULL,
    Stato     NVARCHAR(30)     NULL,
    Ordine    INT              NOT NULL CONSTRAINT DF_GaranteRecapiti_Ordine DEFAULT 1,
    CreatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_GaranteRecapiti_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_GaranteRecapiti_Garante FOREIGN KEY (GaranteId) REFERENCES dbo.Garanti(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PianoRate')
BEGIN
  CREATE TABLE dbo.PianoRate (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PianoRate PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId   UNIQUEIDENTIFIER NOT NULL,
    PraticaId  UNIQUEIDENTIFIER NOT NULL,
    NumeroRata INT              NOT NULL,
    Importo    DECIMAL(18,2)    NOT NULL,
    Scadenza   DATETIME2(3)     NOT NULL,
    Pagata     BIT              NOT NULL CONSTRAINT DF_PianoRate_Pagata DEFAULT 0,
    CONSTRAINT FK_PianoRate_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_PianoRate_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Incassi')
BEGIN
  CREATE TABLE dbo.Incassi (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Incassi PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId     UNIQUEIDENTIFIER NOT NULL,
    PraticaId    UNIQUEIDENTIFIER NOT NULL,
    UserId       UNIQUEIDENTIFIER NOT NULL,
    Importo      DECIMAL(18,2)    NOT NULL,
    Capitale     DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Incassi_Capitale DEFAULT 0,
    Interessi    DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Incassi_Interessi DEFAULT 0,
    Spese        DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Incassi_Spese DEFAULT 0,
    SpeseRec     DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Incassi_SpeseRec DEFAULT 0,
    Metodo       NVARCHAR(30)     NOT NULL CONSTRAINT DF_Incassi_Metodo DEFAULT N'bonifico',
    Modo         NVARCHAR(10)     NOT NULL CONSTRAINT DF_Incassi_Modo DEFAULT N'VE',
    Causale      NVARCHAR(500)    NOT NULL CONSTRAINT DF_Incassi_Causale DEFAULT N'',
    Data         DATETIME2(3)     NOT NULL CONSTRAINT DF_Incassi_Data DEFAULT SYSUTCDATETIME(),
    DataScadenza DATETIME2(3)     NULL,
    CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_Incassi_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Incassi_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_Incassi_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Incassi_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Attivita')
BEGIN
  CREATE TABLE dbo.Attivita (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Attivita PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    PraticaId   UNIQUEIDENTIFIER NOT NULL,
    UserId      UNIQUEIDENTIFIER NOT NULL,
    Tipo        NVARCHAR(50)     NOT NULL,
    Esito       NVARCHAR(50)     NULL,
    Nota        NVARCHAR(MAX)    NULL,
    ScheduledAt DATETIME2(3)     NULL,
    Fissata     BIT              NOT NULL CONSTRAINT DF_Attivita_Fissata DEFAULT 0,
    Importante  BIT              NOT NULL CONSTRAINT DF_Attivita_Importante DEFAULT 0,
    Bloccata    BIT              NOT NULL CONSTRAINT DF_Attivita_Bloccata DEFAULT 0,
    CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_Attivita_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Attivita_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_Attivita_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Attivita_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Provvigioni')
BEGIN
  CREATE TABLE dbo.Provvigioni (
    Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Provvigioni PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId    UNIQUEIDENTIFIER NOT NULL,
    IncassoId   UNIQUEIDENTIFIER NOT NULL,
    PraticaId   UNIQUEIDENTIFIER NOT NULL,
    OperatoreId UNIQUEIDENTIFIER NOT NULL,
    BaseImporto DECIMAL(18,2)    NOT NULL,
    Percentuale DECIMAL(8,4)     NOT NULL,
    Importo     DECIMAL(18,2)    NOT NULL,
    Stato       NVARCHAR(30)     NOT NULL CONSTRAINT DF_Provvigioni_Stato DEFAULT N'MATURATA',
    LiquidataAt DATETIME2(3)     NULL,
    CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_Provvigioni_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Provvigioni_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_Provvigioni_Incasso FOREIGN KEY (IncassoId) REFERENCES dbo.Incassi(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Provvigioni_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id),
    CONSTRAINT FK_Provvigioni_Operatore FOREIGN KEY (OperatoreId) REFERENCES dbo.Users(Id),
    CONSTRAINT UQ_Provvigioni_Incasso UNIQUE (IncassoId)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Fatture')
BEGIN
  CREATE TABLE dbo.Fatture (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Fatture PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId     UNIQUEIDENTIFIER NOT NULL,
    PraticaId    UNIQUEIDENTIFIER NOT NULL,
    Numero       NVARCHAR(50)     NOT NULL,
    Causale      NVARCHAR(500)    NOT NULL CONSTRAINT DF_Fatture_Causale DEFAULT N'',
    DataFattura  DATETIME2(3)     NOT NULL,
    DataScadenza DATETIME2(3)     NOT NULL,
    Importo      DECIMAL(18,2)    NOT NULL,
    Pagato       DECIMAL(18,2)    NOT NULL CONSTRAINT DF_Fatture_Pagato DEFAULT 0,
    CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_Fatture_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Fatture_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_Fatture_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Documenti')
BEGIN
  CREATE TABLE dbo.Documenti (
    Id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Documenti PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId  UNIQUEIDENTIFIER NOT NULL,
    PraticaId UNIQUEIDENTIFIER NOT NULL,
    Nome      NVARCHAR(300)    NOT NULL,
    Tipo      NVARCHAR(50)     NOT NULL CONSTRAINT DF_Documenti_Tipo DEFAULT N'allegato',
    Path      NVARCHAR(500)    NULL,
    CreatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_Documenti_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Documenti_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_Documenti_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RegistrazioniChiamate')
BEGIN
  CREATE TABLE dbo.RegistrazioniChiamate (
    Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_RegistrazioniChiamate PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId           UNIQUEIDENTIFIER NOT NULL,
    PraticaId          UNIQUEIDENTIFIER NOT NULL,
    OperatoreId        UNIQUEIDENTIFIER NOT NULL,
    Numero             NVARCHAR(30)     NOT NULL,
    Direzione          NVARCHAR(20)     NOT NULL CONSTRAINT DF_RegChiamate_Direzione DEFAULT N'uscita',
    Stato              NVARCHAR(30)     NOT NULL CONSTRAINT DF_RegChiamate_Stato DEFAULT N'CONFERMATA_UI',
    Esito              NVARCHAR(50)     NULL,
    DurataSec          INT              NOT NULL CONSTRAINT DF_RegChiamate_DurataSec DEFAULT 0,
    FileName           NVARCHAR(300)    NOT NULL CONSTRAINT DF_RegChiamate_FileName DEFAULT N'',
    EvidenzaBackOffice BIT              NOT NULL CONSTRAINT DF_RegChiamate_Evidenza DEFAULT 0,
    CreatedAt          DATETIME2(3)     NOT NULL CONSTRAINT DF_RegChiamate_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_RegChiamate_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_RegChiamate_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RegChiamate_Operatore FOREIGN KEY (OperatoreId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PraticheLock')
BEGIN
  CREATE TABLE dbo.PraticheLock (
    PraticaId       UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_PraticheLock PRIMARY KEY,
    TenantId        UNIQUEIDENTIFIER NOT NULL,
    UserId          UNIQUEIDENTIFIER NOT NULL,
    LastHeartbeatAt DATETIME2(3)     NOT NULL CONSTRAINT DF_PraticheLock_Heartbeat DEFAULT SYSUTCDATETIME(),
    CreatedAt       DATETIME2(3)     NOT NULL CONSTRAINT DF_PraticheLock_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PraticheLock_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PraticheLock_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_PraticheLock_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MessaggiInterni')
BEGIN
  CREATE TABLE dbo.MessaggiInterni (
    Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MessaggiInterni PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId   UNIQUEIDENTIFIER NOT NULL,
    PraticaId  UNIQUEIDENTIFIER NULL,
    FromUserId UNIQUEIDENTIFIER NOT NULL,
    ToUserId   UNIQUEIDENTIFIER NOT NULL,
    Testo      NVARCHAR(MAX)    NOT NULL,
    Letto      BIT              NOT NULL CONSTRAINT DF_MessaggiInterni_Letto DEFAULT 0,
    LettoAt    DATETIME2(3)     NULL,
    CreatedAt  DATETIME2(3)     NOT NULL CONSTRAINT DF_MessaggiInterni_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MessaggiInterni_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_MessaggiInterni_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MessaggiInterni_From FOREIGN KEY (FromUserId) REFERENCES dbo.Users(Id),
    CONSTRAINT FK_MessaggiInterni_To FOREIGN KEY (ToUserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'MessaggiAgenda')
BEGIN
  CREATE TABLE dbo.MessaggiAgenda (
    Id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_MessaggiAgenda PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId  UNIQUEIDENTIFIER NOT NULL,
    PraticaId UNIQUEIDENTIFIER NOT NULL,
    UserId    UNIQUEIDENTIFIER NOT NULL,
    MemoAt    DATETIME2(3)     NOT NULL,
    Line      NVARCHAR(500)    NOT NULL,
    Letto     BIT              NOT NULL CONSTRAINT DF_MessaggiAgenda_Letto DEFAULT 0,
    LettoAt   DATETIME2(3)     NULL,
    CreatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_MessaggiAgenda_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_MessaggiAgenda_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_MessaggiAgenda_Pratica FOREIGN KEY (PraticaId) REFERENCES dbo.Pratiche(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MessaggiAgenda_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ImpegniAgenda')
BEGIN
  CREATE TABLE dbo.ImpegniAgenda (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ImpegniAgenda PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId     UNIQUEIDENTIFIER NOT NULL,
    UserId       UNIQUEIDENTIFIER NOT NULL,
    Titolo       NVARCHAR(200)    NOT NULL,
    Nota         NVARCHAR(MAX)    NULL,
    MemoAt       DATETIME2(3)     NOT NULL,
    Completato   BIT              NOT NULL CONSTRAINT DF_ImpegniAgenda_Completato DEFAULT 0,
    CompletatoAt DATETIME2(3)     NULL,
    CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_ImpegniAgenda_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ImpegniAgenda_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ImpegniAgenda_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLog')
BEGIN
  CREATE TABLE dbo.AuditLog (
    Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_AuditLog PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId     UNIQUEIDENTIFIER NULL,
    UserId       UNIQUEIDENTIFIER NULL,
    Action       NVARCHAR(100)    NOT NULL,
    Entity       NVARCHAR(100)    NOT NULL,
    EntityId     NVARCHAR(100)    NULL,
    MetadataJson NVARCHAR(MAX)    NULL,
    CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_AuditLog_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_AuditLog_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id),
    CONSTRAINT FK_AuditLog_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ConfigurazioneSistema')
BEGIN
  CREATE TABLE dbo.ConfigurazioneSistema (
    Id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ConfigurazioneSistema PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    TenantId  UNIQUEIDENTIFIER NOT NULL,
    Chiave    NVARCHAR(100)    NOT NULL,
    Valore    NVARCHAR(MAX)    NOT NULL,
    Categoria NVARCHAR(50)     NOT NULL,
    UpdatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_ConfigSistema_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ConfigSistema_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_ConfigSistema_Tenant_Chiave UNIQUE (TenantId, Chiave)
  );
END
GO
