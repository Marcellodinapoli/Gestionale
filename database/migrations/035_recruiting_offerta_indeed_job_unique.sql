-- Recruiting — IndeedJobId univoco per tenant (multi-azienda / Indeed)
-- Impedisce collisioni di routing candidature Indeed → offerta sbagliata.

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = N'OfferteLavoro')
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UQ_OfferteLavoro_Tenant_IndeedJobId'
      AND object_id = OBJECT_ID(N'dbo.OfferteLavoro')
  )
  BEGIN
    CREATE UNIQUE INDEX UQ_OfferteLavoro_Tenant_IndeedJobId
      ON dbo.OfferteLavoro (TenantId, IndeedJobId)
      WHERE IndeedJobId IS NOT NULL AND LTRIM(RTRIM(IndeedJobId)) <> N'';
  END
END
GO
