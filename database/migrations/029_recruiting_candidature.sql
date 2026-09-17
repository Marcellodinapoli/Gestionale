-- Recruiting — metadati tecnici candidature (029)
-- Nessun PII, CV, payload Indeed, secret o credenziale.
-- Non tocca Connector / Pratica / Debitore / Mandante.
-- FK composita (OffertaId, TenantId): la candidatura può riferirsi solo a un'offerta dello stesso tenant.

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'UQ_OfferteLavoro_IdTenant' AND object_id = OBJECT_ID('dbo.OfferteLavoro')
)
BEGIN
  CREATE UNIQUE INDEX UQ_OfferteLavoro_IdTenant ON dbo.OfferteLavoro(Id, TenantId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecruitingCandidature')
BEGIN
  CREATE TABLE dbo.RecruitingCandidature (
    Id                    NVARCHAR(64)  NOT NULL CONSTRAINT PK_RecruitingCandidature PRIMARY KEY,
    TenantId              NVARCHAR(64)  NOT NULL,
    OffertaId             NVARCHAR(64)  NOT NULL,
    ExternalApplicationId NVARCHAR(80)  NULL,
    ReceiverCandidateId   NVARCHAR(80)  NULL,
    Stato                 NVARCHAR(30)  NOT NULL CONSTRAINT DF_RecruitingCandidature_Stato DEFAULT N'RICEVUTA',
    Source                NVARCHAR(80)  NULL,
    ReceivedAt            DATETIME2(3)  NOT NULL CONSTRAINT DF_RecruitingCandidature_Received DEFAULT SYSUTCDATETIME(),
    UpdatedAt             DATETIME2(3)  NOT NULL CONSTRAINT DF_RecruitingCandidature_Updated DEFAULT SYSUTCDATETIME(),
    LastSyncAt            DATETIME2(3)  NULL,
    CONSTRAINT FK_RecruitingCandidature_OffertaTenant
      FOREIGN KEY (OffertaId, TenantId) REFERENCES dbo.OfferteLavoro(Id, TenantId) ON DELETE CASCADE
  );
  CREATE INDEX IX_RecruitingCandidature_Tenant ON dbo.RecruitingCandidature(TenantId);
  CREATE INDEX IX_RecruitingCandidature_TenantOfferta ON dbo.RecruitingCandidature(TenantId, OffertaId);
  CREATE INDEX IX_RecruitingCandidature_TenantStato ON dbo.RecruitingCandidature(TenantId, Stato);
END
GO
