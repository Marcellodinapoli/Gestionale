-- FASE I — indici ImportBatch (lookup lotto/perimetro)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImportBatch_Tenant_LotKey')
  CREATE NONCLUSTERED INDEX IX_ImportBatch_Tenant_LotKey
    ON dbo.ImportBatch (TenantId, Tipo, MandanteId, Perimetro, Lotto, CreatedAt DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLog_Tenant_Entity')
  CREATE NONCLUSTERED INDEX IX_AuditLog_Tenant_Entity
    ON dbo.AuditLog (TenantId, Entity, CreatedAt DESC);
