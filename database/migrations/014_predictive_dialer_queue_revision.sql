-- Predictive Dialer — estensione coda pratiche (014)

IF COL_LENGTH('dbo.DialerCampagnaPratiche', 'ProssimoTentativoAt') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagnaPratiche ADD ProssimoTentativoAt DATETIME2(3) NULL;
END
GO

IF COL_LENGTH('dbo.DialerCampagnaPratiche', 'NumeroTelefonicoUtilizzato') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagnaPratiche ADD NumeroTelefonicoUtilizzato NVARCHAR(50) NOT NULL CONSTRAINT DF_DialerPratica_Numero DEFAULT N'';
END
GO
