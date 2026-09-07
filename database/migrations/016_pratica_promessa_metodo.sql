-- Modalità di pagamento promessa (es. CONTANTI, BONIFICO) — usata da scarico LPP/PPC.
IF COL_LENGTH('dbo.Pratiche', 'PromessaMetodo') IS NULL
BEGIN
  ALTER TABLE dbo.Pratiche ADD PromessaMetodo NVARCHAR(50) NULL;
END
GO
