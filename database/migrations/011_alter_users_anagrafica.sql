-- Anagrafica operatore: cognome, codice fiscale, anno nascita, residenza
IF COL_LENGTH('dbo.Users', 'Cognome') IS NULL
  ALTER TABLE dbo.Users ADD Cognome NVARCHAR(120) NULL;

IF COL_LENGTH('dbo.Users', 'CodiceFiscale') IS NULL
  ALTER TABLE dbo.Users ADD CodiceFiscale NVARCHAR(16) NULL;

IF COL_LENGTH('dbo.Users', 'AnnoNascita') IS NULL
  ALTER TABLE dbo.Users ADD AnnoNascita SMALLINT NULL;

IF COL_LENGTH('dbo.Users', 'Residenza') IS NULL
  ALTER TABLE dbo.Users ADD Residenza NVARCHAR(300) NULL;

GO
