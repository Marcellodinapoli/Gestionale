-- Conferimento legale lotto (stragiudiziale / giudiziale / entrambi)
IF COL_LENGTH('dbo.Pratiche', 'ConferimentoTipo') IS NULL
  ALTER TABLE dbo.Pratiche ADD ConferimentoTipo NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.Pratiche', 'DataPassaggioGiudiziale') IS NULL
  ALTER TABLE dbo.Pratiche ADD DataPassaggioGiudiziale DATETIME2(3) NULL;
IF COL_LENGTH('dbo.Pratiche', 'ProssimaAttivitaAlloScadere') IS NULL
  ALTER TABLE dbo.Pratiche ADD ProssimaAttivitaAlloScadere NVARCHAR(200) NULL;

IF COL_LENGTH('dbo.ImportBatch', 'ConferimentoTipo') IS NULL
  ALTER TABLE dbo.ImportBatch ADD ConferimentoTipo NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.ImportBatch', 'DataPassaggioGiudiziale') IS NULL
  ALTER TABLE dbo.ImportBatch ADD DataPassaggioGiudiziale DATETIME2(3) NULL;
IF COL_LENGTH('dbo.ImportBatch', 'ProssimaAttivitaAlloScadere') IS NULL
  ALTER TABLE dbo.ImportBatch ADD ProssimaAttivitaAlloScadere NVARCHAR(200) NULL;
GO
