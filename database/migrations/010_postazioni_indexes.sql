-- CredixaDev — indici per query Postazioni (FASE J2)

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Postazioni_Tenant_Active_Nome')
  CREATE NONCLUSTERED INDEX IX_Postazioni_Tenant_Active_Nome
    ON dbo.Postazioni (TenantId, Active, Nome)
    INCLUDE (SedeId, Interno, Email, NumeroFisso);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Postazioni_Tenant_SedeId')
  CREATE NONCLUSTERED INDEX IX_Postazioni_Tenant_SedeId
    ON dbo.Postazioni (TenantId, SedeId)
    INCLUDE (Nome, Active)
    WHERE SedeId IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_Tenant_PostazioneId')
  CREATE NONCLUSTERED INDEX IX_Users_Tenant_PostazioneId
    ON dbo.Users (TenantId, PostazioneId)
    INCLUDE (Name, Active)
    WHERE PostazioneId IS NOT NULL;
GO
