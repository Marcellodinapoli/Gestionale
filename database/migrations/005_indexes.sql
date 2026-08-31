-- CredixaDev — indici per query operative e dashboard

-- Pratiche
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pratiche_Tenant_Stato_UpdatedAt')
  CREATE NONCLUSTERED INDEX IX_Pratiche_Tenant_Stato_UpdatedAt
    ON dbo.Pratiche (TenantId, Stato, UpdatedAt DESC)
    INCLUDE (Numero, MandanteId, AssegnatarioId, MemoAt, Residuo);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pratiche_Tenant_Assegnatario_Stato')
  CREATE NONCLUSTERED INDEX IX_Pratiche_Tenant_Assegnatario_Stato
    ON dbo.Pratiche (TenantId, AssegnatarioId, Stato)
    INCLUDE (Numero, UpdatedAt, MemoAt)
    WHERE AssegnatarioId IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pratiche_Tenant_Mandante_NumeroMandante')
  CREATE NONCLUSTERED INDEX IX_Pratiche_Tenant_Mandante_NumeroMandante
    ON dbo.Pratiche (TenantId, MandanteId, NumeroMandante)
    INCLUDE (Numero, Stato);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pratiche_Tenant_MemoAt')
  CREATE NONCLUSTERED INDEX IX_Pratiche_Tenant_MemoAt
    ON dbo.Pratiche (TenantId, MemoAt)
    INCLUDE (Numero, Stato, AssegnatarioId)
    WHERE MemoAt IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pratiche_Tenant_ImportBatch')
  CREATE NONCLUSTERED INDEX IX_Pratiche_Tenant_ImportBatch
    ON dbo.Pratiche (TenantId, ImportBatchId)
    WHERE ImportBatchId IS NOT NULL;
GO

-- Incassi
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Incassi_Pratica_Data')
  CREATE NONCLUSTERED INDEX IX_Incassi_Pratica_Data
    ON dbo.Incassi (PraticaId, Data DESC)
    INCLUDE (Importo, UserId, Metodo);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Incassi_Tenant_Data')
  CREATE NONCLUSTERED INDEX IX_Incassi_Tenant_Data
    ON dbo.Incassi (TenantId, Data DESC)
    INCLUDE (PraticaId, Importo);
GO

-- Attivita
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Attivita_Pratica_CreatedAt')
  CREATE NONCLUSTERED INDEX IX_Attivita_Pratica_CreatedAt
    ON dbo.Attivita (PraticaId, CreatedAt DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Attivita_User_CreatedAt')
  CREATE NONCLUSTERED INDEX IX_Attivita_User_CreatedAt
    ON dbo.Attivita (UserId, CreatedAt DESC)
    INCLUDE (PraticaId, Tipo, Esito);
GO

-- PianoRate
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PianoRate_Pratica_Scadenza')
  CREATE NONCLUSTERED INDEX IX_PianoRate_Pratica_Scadenza
    ON dbo.PianoRate (PraticaId, Scadenza)
    INCLUDE (Importo, Pagata);
GO

-- Debitori / Users lookup
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Debitori_Tenant')
  CREATE NONCLUSTERED INDEX IX_Debitori_Tenant ON dbo.Debitori (TenantId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Tenant_Role')
  CREATE NONCLUSTERED INDEX IX_Users_Tenant_Role ON dbo.Users (TenantId, Role) INCLUDE (Active, Name);
GO

-- AuditLog
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLog_Tenant_CreatedAt')
  CREATE NONCLUSTERED INDEX IX_AuditLog_Tenant_CreatedAt
    ON dbo.AuditLog (TenantId, CreatedAt DESC);
GO

-- MessaggiAgenda (memo popup)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MessaggiAgenda_Tenant_MemoAt')
  CREATE NONCLUSTERED INDEX IX_MessaggiAgenda_Tenant_MemoAt
    ON dbo.MessaggiAgenda (TenantId, MemoAt)
    INCLUDE (UserId, PraticaId, Letto)
    WHERE Letto = 0;
GO
