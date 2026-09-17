-- Recruiting — attività append-only + colloqui (030)
-- Nessun PII, CV, payload Indeed, secret o credenziale.
-- Non tocca Connector / Pratica / Debitore / Mandante.
-- Non applicare al SQL cliente se non richiesto esplicitamente.

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UQ_RecruitingCandidature_IdTenant' AND object_id = OBJECT_ID('dbo.RecruitingCandidature')
)
BEGIN
  CREATE UNIQUE INDEX UQ_RecruitingCandidature_IdTenant ON dbo.RecruitingCandidature(Id, TenantId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecruitingColloqui')
BEGIN
  CREATE TABLE dbo.RecruitingColloqui (
    Id                   NVARCHAR(64)   NOT NULL CONSTRAINT PK_RecruitingColloqui PRIMARY KEY,
    TenantId             NVARCHAR(64)   NOT NULL,
    CandidaturaId        NVARCHAR(64)   NOT NULL,
    Round                INT            NOT NULL,
    Stato                NVARCHAR(30)   NOT NULL CONSTRAINT DF_RecruitingColloqui_Stato DEFAULT N'PROGRAMMATO',
    ScheduledAt          DATETIME2(3)   NOT NULL,
    Modalita             NVARCHAR(20)   NOT NULL,
    IntervistatoreUserId NVARCHAR(64)   NULL,
    IntervistatoreLabel  NVARCHAR(120)  NOT NULL CONSTRAINT DF_RecruitingColloqui_Ref DEFAULT N'',
    NotePreliminari      NVARCHAR(2000) NOT NULL CONSTRAINT DF_RecruitingColloqui_NotePre DEFAULT N'',
    NoteSvolgimento      NVARCHAR(2000) NOT NULL CONSTRAINT DF_RecruitingColloqui_NoteSvo DEFAULT N'',
    Esito                NVARCHAR(30)   NULL,
    Valutazione          NVARCHAR(2000) NOT NULL CONSTRAINT DF_RecruitingColloqui_Val DEFAULT N'',
    CreatedAt            DATETIME2(3)   NOT NULL CONSTRAINT DF_RecruitingColloqui_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt            DATETIME2(3)   NOT NULL CONSTRAINT DF_RecruitingColloqui_Updated DEFAULT SYSUTCDATETIME(),
    CreatedById          NVARCHAR(64)   NOT NULL,
    CONSTRAINT FK_RecruitingColloqui_CandidaturaTenant
      FOREIGN KEY (CandidaturaId, TenantId) REFERENCES dbo.RecruitingCandidature(Id, TenantId) ON DELETE CASCADE,
    CONSTRAINT UQ_RecruitingColloqui_Round UNIQUE (TenantId, CandidaturaId, Round)
  );
  CREATE UNIQUE INDEX UQ_RecruitingColloqui_IdTenant ON dbo.RecruitingColloqui(Id, TenantId);
  CREATE INDEX IX_RecruitingColloqui_Tenant ON dbo.RecruitingColloqui(TenantId);
  CREATE INDEX IX_RecruitingColloqui_TenantCandidatura ON dbo.RecruitingColloqui(TenantId, CandidaturaId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecruitingAttivita')
BEGIN
  CREATE TABLE dbo.RecruitingAttivita (
    Id            NVARCHAR(64)   NOT NULL CONSTRAINT PK_RecruitingAttivita PRIMARY KEY,
    TenantId      NVARCHAR(64)   NOT NULL,
    CandidaturaId NVARCHAR(64)   NOT NULL,
    Tipo          NVARCHAR(40)   NOT NULL,
    OccurredAt    DATETIME2(3)   NOT NULL,
    Note          NVARCHAR(2000) NOT NULL CONSTRAINT DF_RecruitingAttivita_Note DEFAULT N'',
    Esito         NVARCHAR(30)   NULL,
    StatoDa       NVARCHAR(30)   NULL,
    StatoA        NVARCHAR(30)   NULL,
    ColloquioId   NVARCHAR(64)   NULL,
    Canale        NVARCHAR(20)   NULL,
    CreatedAt     DATETIME2(3)   NOT NULL CONSTRAINT DF_RecruitingAttivita_Created DEFAULT SYSUTCDATETIME(),
    CreatedById   NVARCHAR(64)   NOT NULL,
    CONSTRAINT FK_RecruitingAttivita_CandidaturaTenant
      FOREIGN KEY (CandidaturaId, TenantId) REFERENCES dbo.RecruitingCandidature(Id, TenantId) ON DELETE CASCADE
  );
  CREATE INDEX IX_RecruitingAttivita_Tenant ON dbo.RecruitingAttivita(TenantId);
  CREATE INDEX IX_RecruitingAttivita_TenantCandidaturaData ON dbo.RecruitingAttivita(TenantId, CandidaturaId, OccurredAt);
END
GO
