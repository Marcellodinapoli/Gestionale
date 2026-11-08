-- Fax e WhatsApp su postazioni (SQL Server)
IF COL_LENGTH('dbo.Postazioni', 'NumeroFax') IS NULL
BEGIN
  ALTER TABLE dbo.Postazioni ADD NumeroFax NVARCHAR(30) NULL;
END
GO

IF COL_LENGTH('dbo.Postazioni', 'NumeroWhatsapp') IS NULL
BEGIN
  ALTER TABLE dbo.Postazioni ADD NumeroWhatsapp NVARCHAR(30) NULL;
END
GO
