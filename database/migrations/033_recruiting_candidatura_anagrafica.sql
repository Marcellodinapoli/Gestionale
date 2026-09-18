-- Recruiting — cognome e nome candidato sulla scheda (033)
-- Non tocca Connector / Pratica / Debitore / Mandante.

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingCandidature', 'Cognome') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingCandidature ADD Cognome NVARCHAR(80) NOT NULL CONSTRAINT DF_RecruitingCandidature_Cognome DEFAULT N'';
END
GO

IF OBJECT_ID('dbo.RecruitingCandidature', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingCandidature', 'Nome') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingCandidature ADD Nome NVARCHAR(80) NOT NULL CONSTRAINT DF_RecruitingCandidature_Nome DEFAULT N'';
END
GO
