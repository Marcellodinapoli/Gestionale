-- Data/ora ultima modifica codice scarico back office.
IF COL_LENGTH('dbo.Pratiche', 'CodiceScaricoBkAt') IS NULL
BEGIN
  ALTER TABLE dbo.Pratiche ADD CodiceScaricoBkAt DATETIME2(3) NULL;
END
GO
