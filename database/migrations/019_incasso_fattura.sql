-- Codice fattura su incasso (es. numero documento oppure "np" = non provvigioneabile).
IF COL_LENGTH('dbo.Incassi', 'Fattura') IS NULL
BEGIN
  ALTER TABLE dbo.Incassi ADD Fattura NVARCHAR(80) NULL;
END
GO
