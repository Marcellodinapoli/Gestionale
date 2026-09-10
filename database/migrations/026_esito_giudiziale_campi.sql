-- Esito giudiziale: data dichiarata + importo recuperato (informativo)
IF COL_LENGTH('dbo.PraticheGiudiziali', 'DataEsito') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD DataEsito DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ImportoRecuperato') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ImportoRecuperato FLOAT NULL;
GO
