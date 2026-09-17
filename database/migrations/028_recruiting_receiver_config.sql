-- Recruiting — configurazione tecnica ricevitore aziendale (028)
-- Un record per tenant. Nessun CV, candidato, secret Indeed o credenziale SQL.
-- Non tocca Connector / OfferteLavoro.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'RecruitingReceiverConfig')
BEGIN
  CREATE TABLE dbo.RecruitingReceiverConfig (
    Id         NVARCHAR(64)   NOT NULL CONSTRAINT PK_RecruitingReceiverConfig PRIMARY KEY,
    TenantId   NVARCHAR(64)   NOT NULL,
    BaseUrl    NVARCHAR(500)  NOT NULL,
    Status     NVARCHAR(20)   NOT NULL CONSTRAINT DF_RecruitingReceiverConfig_Status DEFAULT N'DISCONNECTED',
    SourceName NVARCHAR(80)   NULL,
    CreatedAt  DATETIME2(3)   NOT NULL CONSTRAINT DF_RecruitingReceiverConfig_Created DEFAULT SYSUTCDATETIME(),
    UpdatedAt  DATETIME2(3)   NOT NULL CONSTRAINT DF_RecruitingReceiverConfig_Updated DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_RecruitingReceiverConfig_Tenant UNIQUE (TenantId)
  );
END
GO
