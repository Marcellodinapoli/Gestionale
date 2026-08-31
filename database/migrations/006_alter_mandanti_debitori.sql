-- CredixaDev — colonne Mandanti/Debitori allineate al modello Prisma

IF COL_LENGTH('dbo.Mandanti', 'Referente') IS NULL
  ALTER TABLE dbo.Mandanti ADD Referente NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Mandanti', 'ReferenteTelefono') IS NULL
  ALTER TABLE dbo.Mandanti ADD ReferenteTelefono NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.Mandanti', 'ReferenteEmail') IS NULL
  ALTER TABLE dbo.Mandanti ADD ReferenteEmail NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Mandanti', 'Pec') IS NULL
  ALTER TABLE dbo.Mandanti ADD Pec NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Mandanti', 'Indirizzo') IS NULL
  ALTER TABLE dbo.Mandanti ADD Indirizzo NVARCHAR(300) NULL;
IF COL_LENGTH('dbo.Mandanti', 'Citta') IS NULL
  ALTER TABLE dbo.Mandanti ADD Citta NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.Mandanti', 'Cap') IS NULL
  ALTER TABLE dbo.Mandanti ADD Cap NVARCHAR(10) NULL;
IF COL_LENGTH('dbo.Mandanti', 'Provincia') IS NULL
  ALTER TABLE dbo.Mandanti ADD Provincia NVARCHAR(5) NULL;
IF COL_LENGTH('dbo.Mandanti', 'ProvvigionePerc') IS NULL
  ALTER TABLE dbo.Mandanti ADD ProvvigionePerc FLOAT NULL;
IF COL_LENGTH('dbo.Mandanti', 'ProvvigioniMetodoJson') IS NULL
  ALTER TABLE dbo.Mandanti ADD ProvvigioniMetodoJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Mandanti', 'IncentivoTipo') IS NULL
  ALTER TABLE dbo.Mandanti ADD IncentivoTipo NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.Mandanti', 'IncentivoValore') IS NULL
  ALTER TABLE dbo.Mandanti ADD IncentivoValore FLOAT NULL;
IF COL_LENGTH('dbo.Mandanti', 'IncentivoSoglia') IS NULL
  ALTER TABLE dbo.Mandanti ADD IncentivoSoglia FLOAT NULL;
IF COL_LENGTH('dbo.Mandanti', 'IncentivoNote') IS NULL
  ALTER TABLE dbo.Mandanti ADD IncentivoNote NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Mandanti', 'CodiciScaricoJson') IS NULL
  ALTER TABLE dbo.Mandanti ADD CodiciScaricoJson NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.Mandanti', 'SmsPreimpostatiJson') IS NULL
  ALTER TABLE dbo.Mandanti ADD SmsPreimpostatiJson NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.Debitori', 'TelefonoStato') IS NULL
  ALTER TABLE dbo.Debitori ADD TelefonoStato NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.Debitori', 'Ndg') IS NULL
  ALTER TABLE dbo.Debitori ADD Ndg NVARCHAR(50) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Debitori_Tenant_CodiceFiscale')
  CREATE NONCLUSTERED INDEX IX_Debitori_Tenant_CodiceFiscale
    ON dbo.Debitori (TenantId, CodiceFiscale)
    WHERE CodiceFiscale IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Mandanti_Tenant_Codice')
  CREATE NONCLUSTERED INDEX IX_Mandanti_Tenant_Codice
    ON dbo.Mandanti (TenantId, Codice);
GO
