-- Recruiting — campi Indeed Apply su candidatura (034)
-- Email, EmailVerified, Phone, CoverLetter. Nessun CV / resume / documento.
-- Unique filtrato (TenantId, ExternalApplicationId) solo se ExternalApplicationId IS NOT NULL.
-- Non tocca Connector / Pratica / Debitore / Mandante.

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingCandidature', 'Email') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingCandidature ADD Email NVARCHAR(200) NULL;
END
GO

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingCandidature', 'EmailVerified') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingCandidature ADD EmailVerified BIT NULL;
END
GO

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingCandidature', 'Phone') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingCandidature ADD Phone NVARCHAR(40) NULL;
END
GO

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingCandidature', 'CoverLetter') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingCandidature ADD CoverLetter NVARCHAR(MAX) NULL;
END
GO

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM sys.indexes
     WHERE name = 'UQ_RecruitingCandidature_Tenant_ExternalApplicationId'
       AND object_id = OBJECT_ID('dbo.RecruitingCandidature')
   )
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UQ_RecruitingCandidature_Tenant_ExternalApplicationId
    ON dbo.RecruitingCandidature (TenantId, ExternalApplicationId)
    WHERE ExternalApplicationId IS NOT NULL;
END
GO
