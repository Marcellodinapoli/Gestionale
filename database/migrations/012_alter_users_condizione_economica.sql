IF COL_LENGTH('dbo.Users', 'CondizioneEconomica') IS NULL
  ALTER TABLE dbo.Users ADD CondizioneEconomica NVARCHAR(20) NOT NULL
    CONSTRAINT DF_Users_CondizioneEconomica DEFAULT N'SOLO_PROVV';
GO

IF COL_LENGTH('dbo.Users', 'ImportoFisso') IS NULL
  ALTER TABLE dbo.Users ADD ImportoFisso DECIMAL(18,2) NULL;
GO
