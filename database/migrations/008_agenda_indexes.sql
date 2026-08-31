-- FASE H — indici Agenda/Memo
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImpegniAgenda_User_Completato_MemoAt')
  CREATE NONCLUSTERED INDEX IX_ImpegniAgenda_User_Completato_MemoAt
    ON dbo.ImpegniAgenda (TenantId, UserId, Completato, MemoAt)
    INCLUDE (Titolo, Nota);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MessaggiAgenda_Pratica_Letto')
  CREATE NONCLUSTERED INDEX IX_MessaggiAgenda_Pratica_Letto
    ON dbo.MessaggiAgenda (TenantId, PraticaId, Letto)
    INCLUDE (MemoAt, Line, UserId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MessaggiInterni_ToUser_Letto')
  CREATE NONCLUSTERED INDEX IX_MessaggiInterni_ToUser_Letto
    ON dbo.MessaggiInterni (TenantId, ToUserId, Letto)
    INCLUDE (FromUserId, PraticaId, CreatedAt);
GO
