-- Portafogli: servicer/gestore opzionale.
-- File di migration: non applicare al DB cliente se non richiesto.

IF COL_LENGTH('dbo.Portafogli', 'Servicer') IS NULL
  ALTER TABLE dbo.Portafogli ADD Servicer NVARCHAR(200) NULL;
GO
