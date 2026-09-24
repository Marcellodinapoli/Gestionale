-- Portafogli UTP/NPL (acquisto book) — isolamento per TenantId.
-- File di migration: non applicare al DB cliente se non richiesto.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Portafogli')
BEGIN
  CREATE TABLE dbo.Portafogli (
    Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Portafogli PRIMARY KEY,
    TenantId            UNIQUEIDENTIFIER NOT NULL,
    Nome                NVARCHAR(200)    NOT NULL,
    Codice              NVARCHAR(80)     NULL,
    Venditore           NVARCHAR(200)    NULL,
    Tipo                NVARCHAR(20)     NOT NULL CONSTRAINT DF_Portafogli_Tipo DEFAULT N'NPL',
    Stato               NVARCHAR(30)     NOT NULL CONSTRAINT DF_Portafogli_Stato DEFAULT N'IN_VALUTAZIONE',
    DataCutoff          DATETIME2(3)     NULL,
    DataAcquisto        DATETIME2(3)     NULL,
    NominaleDichiarato  FLOAT            NOT NULL CONSTRAINT DF_Portafogli_Nominale DEFAULT 0,
    PrezzoOfferto       FLOAT            NULL,
    PrezzoPagato        FLOAT            NULL,
    SpeseAcquisto       FLOAT            NOT NULL CONSTRAINT DF_Portafogli_Spese DEFAULT 0,
    RecuperoAtteso      FLOAT            NULL,
    Note                NVARCHAR(MAX)    NULL,
    CreatedById         UNIQUEIDENTIFIER NULL,
    CreatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_Portafogli_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_Portafogli_Updated DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_Portafogli_Tenant ON dbo.Portafogli(TenantId);
  CREATE INDEX IX_Portafogli_TenantStato ON dbo.Portafogli(TenantId, Stato);
END
GO

IF COL_LENGTH('dbo.Pratiche', 'PortafoglioId') IS NULL
  ALTER TABLE dbo.Pratiche ADD PortafoglioId UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes WHERE name = 'IX_Pratiche_TenantPortafoglio' AND object_id = OBJECT_ID('dbo.Pratiche')
)
  CREATE INDEX IX_Pratiche_TenantPortafoglio ON dbo.Pratiche(TenantId, PortafoglioId);
GO
