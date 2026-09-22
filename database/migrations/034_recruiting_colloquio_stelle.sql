-- Recruiting — valutazione a stelle sul colloquio (034)
-- 1–5, opzionale. Nessun PII.

IF OBJECT_ID('dbo.RecruitingColloqui', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.RecruitingColloqui', 'ValutazioneStelle') IS NULL
BEGIN
  ALTER TABLE dbo.RecruitingColloqui ADD ValutazioneStelle INT NULL;
END
GO
