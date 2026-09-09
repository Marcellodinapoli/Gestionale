-- Campi valutazione legale su PraticheGiudiziali
IF COL_LENGTH('dbo.PraticheGiudiziali', 'TitoloCreditoEsistenza') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD TitoloCreditoEsistenza NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'TitoloCreditoValidita') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD TitoloCreditoValidita NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'TitoloCreditoEsigibilita') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD TitoloCreditoEsigibilita NVARCHAR(30) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'PrescrizioneTermini') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD PrescrizioneTermini NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'DocumentazioneProve') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD DocumentazioneProve NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ContestazioniDebitore') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ContestazioniDebitore NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'SolvibilitaRecupero') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD SolvibilitaRecupero NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'GiudiceCompetente') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD GiudiceCompetente NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ForoEventuale') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ForoEventuale NVARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'TipoAzioneIpotizzata') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD TipoAzioneIpotizzata NVARCHAR(40) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'TipoAzioneAltroDettaglio') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD TipoAzioneAltroDettaglio NVARCHAR(500) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'CostiBenefici') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD CostiBenefici NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'RischiLegali') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD RischiLegali NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ParereValutazione') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ParereValutazione NVARCHAR(40) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ParereMotivazione') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ParereMotivazione NVARCHAR(MAX) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ValutazioneCompletataAt') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ValutazioneCompletataAt DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.PraticheGiudiziali', 'ValutazioneById') IS NULL
  ALTER TABLE dbo.PraticheGiudiziali ADD ValutazioneById UNIQUEIDENTIFIER NULL;
GO
