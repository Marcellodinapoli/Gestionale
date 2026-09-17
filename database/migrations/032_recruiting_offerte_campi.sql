-- Recruiting — contenuti offerta allineati a Indeed Job Sync body (032)
-- Campi: title, location, remoteType, jobTypes, seats, description, salary, benefits.
-- Nessuna chiamata Indeed. Nessun PII candidato. Non tocca Connector / CRM.

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'ModalitaLavoro') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD ModalitaLavoro NVARCHAR(20) NOT NULL CONSTRAINT DF_OfferteLavoro_Modalita DEFAULT N'PRESENZA';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'TipoContratto') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD TipoContratto NVARCHAR(40) NOT NULL CONSTRAINT DF_OfferteLavoro_Contratto DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Orario') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Orario NVARCHAR(20) NOT NULL CONSTRAINT DF_OfferteLavoro_Orario DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'NumeroPosizioni') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD NumeroPosizioni INT NOT NULL CONSTRAINT DF_OfferteLavoro_Posizioni DEFAULT 1;
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Descrizione') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Descrizione NVARCHAR(MAX) NOT NULL CONSTRAINT DF_OfferteLavoro_Desc DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'AttivitaPrincipali') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD AttivitaPrincipali NVARCHAR(MAX) NOT NULL CONSTRAINT DF_OfferteLavoro_Att DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Requisiti') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Requisiti NVARCHAR(MAX) NOT NULL CONSTRAINT DF_OfferteLavoro_Req DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Competenze') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Competenze NVARCHAR(MAX) NOT NULL CONSTRAINT DF_OfferteLavoro_Comp DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Retribuzione') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Retribuzione NVARCHAR(500) NOT NULL CONSTRAINT DF_OfferteLavoro_Ret DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Benefit') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Benefit NVARCHAR(MAX) NOT NULL CONSTRAINT DF_OfferteLavoro_Ben DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.OfferteLavoro', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.OfferteLavoro', 'Paese') IS NULL
BEGIN
  ALTER TABLE dbo.OfferteLavoro ADD Paese NVARCHAR(8) NOT NULL CONSTRAINT DF_OfferteLavoro_Paese DEFAULT N'IT';
END
GO
