-- Codice scarico back office (separato dallo scarico operatore).
IF COL_LENGTH('dbo.Pratiche', 'CodiceScaricoBk') IS NULL
BEGIN
  ALTER TABLE dbo.Pratiche ADD CodiceScaricoBk NVARCHAR(20) NULL;
END
GO
