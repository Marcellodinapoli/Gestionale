-- CredixaDev — colonne Pratiche allineate al modello applicativo

IF COL_LENGTH('dbo.Pratiche', 'SpeseRecupero') IS NULL
  ALTER TABLE dbo.Pratiche ADD SpeseRecupero DECIMAL(18,2) NOT NULL CONSTRAINT DF_Pratiche_SpeseRecupero DEFAULT 0;
GO

IF COL_LENGTH('dbo.Pratiche', 'ImportoRata') IS NULL
  ALTER TABLE dbo.Pratiche ADD ImportoRata DECIMAL(18,2) NULL;
GO

IF COL_LENGTH('dbo.Pratiche', 'RateArretrate') IS NULL
  ALTER TABLE dbo.Pratiche ADD RateArretrate INT NULL;
GO

IF COL_LENGTH('dbo.Pratiche', 'NettoDaPagare') IS NULL
  ALTER TABLE dbo.Pratiche ADD NettoDaPagare DECIMAL(18,2) NULL;
GO

IF COL_LENGTH('dbo.Pratiche', 'TipoContatto') IS NULL
  ALTER TABLE dbo.Pratiche ADD TipoContatto NVARCHAR(50) NULL;
GO
