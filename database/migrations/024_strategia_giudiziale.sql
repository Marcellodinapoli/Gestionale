-- Campi strategia / procedura giudiziale
IF COL_LENGTH('dbo.PraticheGiudiziali', 'StrategiaScelta') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD StrategiaScelta NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ProceduraDaSeguire') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ProceduraDaSeguire NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ProfessionistaIncaricato') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ProfessionistaIncaricato NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'AttivitaProceduraJson') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD AttivitaProceduraJson NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'AgendaScadenze') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD AgendaScadenze NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'DocumentiDaProdurre') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD DocumentiDaProdurre NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'StatoProcedura') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD StatoProcedura NVARCHAR(40) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'EventiStorico') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD EventiStorico NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'CostiSostenuti') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD CostiSostenuti NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'EsitoGiudiziale') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD EsitoGiudiziale NVARCHAR(40) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'NoteLegaliOperatori') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD NoteLegaliOperatori NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'StrategiaAggiornataAt') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD StrategiaAggiornataAt DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'EsitoRegistratoAt') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD EsitoRegistratoAt DATETIME2(3) NULL;
GO
