-- Recruiting — backfill attività RICEZIONE (031)
-- Idempotente: inserisce una sola RICEZIONE per candidatura che non ce l'ha.
-- Non modifica stato né ReceivedAt. Nessun PII.
-- Non tocca Connector / Pratica / Debitore / Mandante.

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.RecruitingAttivita', 'U') IS NOT NULL
   AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.RecruitingAttivita (
    Id,
    TenantId,
    CandidaturaId,
    Tipo,
    OccurredAt,
    Note,
    Esito,
    StatoDa,
    StatoA,
    ColloquioId,
    Canale,
    CreatedAt,
    CreatedById
  )
  SELECT
    N'ricezione-' + c.Id,
    c.TenantId,
    c.Id,
    N'RICEZIONE',
    c.ReceivedAt,
    N'',
    NULL,
    NULL,
    N'RICEVUTA',
    NULL,
    NULL,
    SYSUTCDATETIME(),
    u.CreatedById
  FROM dbo.RecruitingCandidature c
  CROSS APPLY (
    SELECT TOP 1 x.CreatedById
    FROM (
      SELECT a.CreatedById, 0 AS Ordine, a.CreatedAt
      FROM dbo.RecruitingAttivita a
      WHERE a.TenantId = c.TenantId
        AND a.CandidaturaId = c.Id
      UNION ALL
      SELECT CONVERT(NVARCHAR(64), usr.Id), 1, usr.CreatedAt
      FROM dbo.Users usr
      WHERE CONVERT(NVARCHAR(64), usr.TenantId) = c.TenantId
    ) x
    ORDER BY x.Ordine, x.CreatedAt
  ) u
  WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.RecruitingAttivita a
    WHERE a.TenantId = c.TenantId
      AND a.CandidaturaId = c.Id
      AND a.Tipo = N'RICEZIONE'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.RecruitingAttivita a
    WHERE a.Id = N'ricezione-' + c.Id
  );
END
GO
