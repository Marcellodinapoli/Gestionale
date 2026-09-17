-- Recruiting — offerte di lavoro (modulo isolato, 027)
-- Nessun CV, nessun candidato, nessuna route Connector.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'OfferteLavoro')
BEGIN
  CREATE TABLE dbo.OfferteLavoro (
    Id          NVARCHAR(64)   NOT NULL CONSTRAINT PK_OfferteLavoro PRIMARY KEY,
    TenantId    NVARCHAR(64)   NOT NULL,
    Titolo      NVARCHAR(200)  NOT NULL,
    Luogo       NVARCHAR(200)  NOT NULL CONSTRAINT DF_OfferteLavoro_Luogo DEFAULT N'',
    Stato       NVARCHAR(20)   NOT NULL CONSTRAINT DF_OfferteLavoro_Stato DEFAULT N'BOZZA',
    IndeedJobId NVARCHAR(200)  NULL,
    CreatedAt   DATETIME2(3)   NOT NULL CONSTRAINT DF_OfferteLavoro_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2(3)   NOT NULL CONSTRAINT DF_OfferteLavoro_Updated DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_OfferteLavoro_Tenant ON dbo.OfferteLavoro(TenantId);
  CREATE INDEX IX_OfferteLavoro_TenantStato ON dbo.OfferteLavoro(TenantId, Stato);
END
GO
