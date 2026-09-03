-- Predictive Dialer — tabelle modulo isolato (013)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DialerCampagne')
BEGIN
  CREATE TABLE dbo.DialerCampagne (
    Id            NVARCHAR(64)   NOT NULL CONSTRAINT PK_DialerCampagne PRIMARY KEY,
    TenantId      NVARCHAR(64)   NOT NULL,
    Nome          NVARCHAR(200)  NOT NULL,
    Descrizione   NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_DialerCampagne_Desc DEFAULT N'',
    CodiciScarico NVARCHAR(MAX)  NOT NULL CONSTRAINT DF_DialerCampagne_Codici DEFAULT N'[]',
    PostCallSec   INT            NOT NULL CONSTRAINT DF_DialerCampagne_PostCall DEFAULT 60,
    Stato         NVARCHAR(30)   NOT NULL CONSTRAINT DF_DialerCampagne_Stato DEFAULT N'BOZZA',
    PacingRatio   FLOAT          NULL,
    ExternalId    NVARCHAR(200)  NULL,
    CreatedById   NVARCHAR(64)   NOT NULL,
    SupervisorId  NVARCHAR(64)   NULL,
    CreatedAt     DATETIME2(3)   NOT NULL CONSTRAINT DF_DialerCampagne_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt     DATETIME2(3)   NOT NULL CONSTRAINT DF_DialerCampagne_Updated DEFAULT SYSUTCDATETIME(),
    ActivatedAt   DATETIME2(3)   NULL
  );
  CREATE INDEX IX_DialerCampagne_Tenant ON dbo.DialerCampagne(TenantId);
  CREATE INDEX IX_DialerCampagne_Stato ON dbo.DialerCampagne(TenantId, Stato);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DialerCampagnaOperatori')
BEGIN
  CREATE TABLE dbo.DialerCampagnaOperatori (
    Id                NVARCHAR(64) NOT NULL CONSTRAINT PK_DialerCampagnaOperatori PRIMARY KEY,
    CampagnaId        NVARCHAR(64) NOT NULL,
    OperatoreId       NVARCHAR(64) NOT NULL,
    InvitatoAt        DATETIME2(3) NOT NULL CONSTRAINT DF_DialerOp_Invitato DEFAULT SYSUTCDATETIME(),
    AccettatoAt       DATETIME2(3) NULL,
    SessioneStato     NVARCHAR(30) NOT NULL CONSTRAINT DF_DialerOp_Stato DEFAULT N'offline',
    PausaInizioAt     DATETIME2(3) NULL,
    UscitaAt          DATETIME2(3) NULL,
    ChiamateCount     INT          NOT NULL CONSTRAINT DF_DialerOp_Chiamate DEFAULT 0,
    DurataTotaleSec   INT          NOT NULL CONSTRAINT DF_DialerOp_Durata DEFAULT 0,
    PraticaCorrenteId NVARCHAR(64) NULL,
    PostCallFineAt    DATETIME2(3) NULL,
    CONSTRAINT UQ_DialerCampagnaOperatore UNIQUE (CampagnaId, OperatoreId)
  );
  CREATE INDEX IX_DialerCampagnaOperatori_Op ON dbo.DialerCampagnaOperatori(OperatoreId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DialerCampagnaPratiche')
BEGIN
  CREATE TABLE dbo.DialerCampagnaPratiche (
    Id                  NVARCHAR(64) NOT NULL CONSTRAINT PK_DialerCampagnaPratiche PRIMARY KEY,
    CampagnaId          NVARCHAR(64) NOT NULL,
    PraticaId           NVARCHAR(64) NOT NULL,
    Stato               NVARCHAR(30) NOT NULL CONSTRAINT DF_DialerPratica_Stato DEFAULT N'disponibile',
    Tentativi           INT          NOT NULL CONSTRAINT DF_DialerPratica_Tentativi DEFAULT 0,
    UltimoEsito         NVARCHAR(100) NULL,
    UltimaChiamataAt    DATETIME2(3) NULL,
    LockedByOperatoreId NVARCHAR(64) NULL,
    CONSTRAINT UQ_DialerCampagnaPratica UNIQUE (CampagnaId, PraticaId)
  );
  CREATE INDEX IX_DialerCampagnaPratiche_Campagna ON dbo.DialerCampagnaPratiche(CampagnaId, Stato);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DialerChiamataEventi')
BEGIN
  CREATE TABLE dbo.DialerChiamataEventi (
    Id             NVARCHAR(64)  NOT NULL CONSTRAINT PK_DialerChiamataEventi PRIMARY KEY,
    CampagnaId     NVARCHAR(64)  NOT NULL,
    OperatoreId    NVARCHAR(64)  NULL,
    PraticaId      NVARCHAR(64)  NULL,
    Numero         NVARCHAR(50)  NOT NULL CONSTRAINT DF_DialerEvento_Numero DEFAULT N'',
    Tipo           NVARCHAR(30)  NOT NULL,
    Esito          NVARCHAR(100) NULL,
    DurataSec      INT           NOT NULL CONSTRAINT DF_DialerEvento_Durata DEFAULT 0,
    ExternalCallId NVARCHAR(200) NULL,
    Metadata       NVARCHAR(MAX) NOT NULL CONSTRAINT DF_DialerEvento_Meta DEFAULT N'{}',
    CreatedAt      DATETIME2(3)  NOT NULL CONSTRAINT DF_DialerEvento_Created DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_DialerChiamataEventi_Campagna ON dbo.DialerChiamataEventi(CampagnaId, CreatedAt);
END
GO
