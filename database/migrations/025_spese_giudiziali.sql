-- Spese giudiziali: dettaglio JSON in Legal + totale sintetico sulla pratica
IF COL_LENGTH('dbo.PraticheGiudiziali', 'SpeseGiudizialiJson') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD SpeseGiudizialiJson NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.Pratiche', 'SpeseGiudiziali') IS NULL
  ALTER TABLE dbo.Pratiche ADD SpeseGiudiziali FLOAT NOT NULL CONSTRAINT DF_Pratiche_SpeseGiudiziali DEFAULT 0;
GO
