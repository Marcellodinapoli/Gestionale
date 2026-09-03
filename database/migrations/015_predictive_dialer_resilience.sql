-- Predictive Dialer — resilienza webhook/lock/session (015)

IF COL_LENGTH('dbo.DialerCampagne', 'LockTimeoutSec') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagne ADD LockTimeoutSec INT NOT NULL CONSTRAINT DF_DialerCampagna_LockTimeout DEFAULT 120;
END
GO

IF COL_LENGTH('dbo.DialerCampagnaOperatori', 'CallIdCorrente') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagnaOperatori ADD CallIdCorrente NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.DialerCampagnaOperatori', 'LastHeartbeatAt') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagnaOperatori ADD LastHeartbeatAt DATETIME2(3) NULL;
END
GO

IF COL_LENGTH('dbo.DialerCampagnaPratiche', 'LockedByCallId') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagnaPratiche ADD LockedByCallId NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.DialerCampagnaPratiche', 'LockedAt') IS NULL
BEGIN
  ALTER TABLE dbo.DialerCampagnaPratiche ADD LockedAt DATETIME2(3) NULL;
END
GO

IF COL_LENGTH('dbo.DialerChiamataEventi', 'CallId') IS NULL
BEGIN
  ALTER TABLE dbo.DialerChiamataEventi ADD CallId NVARCHAR(100) NOT NULL CONSTRAINT DF_DialerEvento_CallId DEFAULT N'';
END
GO

IF COL_LENGTH('dbo.DialerChiamataEventi', 'ProviderEventId') IS NULL
BEGIN
  ALTER TABLE dbo.DialerChiamataEventi ADD ProviderEventId NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.DialerChiamataEventi', 'DedupKey') IS NULL
BEGIN
  ALTER TABLE dbo.DialerChiamataEventi ADD DedupKey NVARCHAR(250) NOT NULL CONSTRAINT DF_DialerEvento_DedupKey DEFAULT N'';
END
GO

IF COL_LENGTH('dbo.DialerChiamataEventi', 'Applied') IS NULL
BEGIN
  ALTER TABLE dbo.DialerChiamataEventi ADD Applied BIT NOT NULL CONSTRAINT DF_DialerEvento_Applied DEFAULT 1;
END
GO

IF COL_LENGTH('dbo.DialerChiamataEventi', 'SkipReason') IS NULL
BEGIN
  ALTER TABLE dbo.DialerChiamataEventi ADD SkipReason NVARCHAR(500) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'UX_DialerChiamataEventi_Campagna_DedupKey'
    AND object_id = OBJECT_ID('dbo.DialerChiamataEventi')
)
BEGIN
  CREATE UNIQUE INDEX UX_DialerChiamataEventi_Campagna_DedupKey
    ON dbo.DialerChiamataEventi (CampagnaId, DedupKey)
    WHERE DedupKey <> N'';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_DialerChiamataEventi_Campagna_CallId'
    AND object_id = OBJECT_ID('dbo.DialerChiamataEventi')
)
BEGIN
  CREATE INDEX IX_DialerChiamataEventi_Campagna_CallId
    ON dbo.DialerChiamataEventi (CampagnaId, CallId);
END
GO
