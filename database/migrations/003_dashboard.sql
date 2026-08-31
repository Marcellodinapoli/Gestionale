-- CredixaDev — tabella KPI pre-calcolati per dashboard

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'DashboardKpi')
BEGIN
  CREATE TABLE dbo.DashboardKpi (
    TenantId      UNIQUEIDENTIFIER NOT NULL,
    ScopeType     NVARCHAR(30)     NOT NULL,
    ScopeId       NVARCHAR(100)    NOT NULL CONSTRAINT DF_DashboardKpi_ScopeId DEFAULT N'',
    KpiKey        NVARCHAR(100)    NOT NULL,
    ValoreNumeric DECIMAL(18,4)    NULL,
    ValoreJson    NVARCHAR(MAX)    NULL,
    UpdatedAt     DATETIME2(3)     NOT NULL CONSTRAINT DF_DashboardKpi_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_DashboardKpi PRIMARY KEY (TenantId, ScopeType, ScopeId, KpiKey),
    CONSTRAINT FK_DashboardKpi_Tenant FOREIGN KEY (TenantId) REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
  );
END
GO
