-- Portafogli: servicer/gestore opzionale su Neon/Postgres.
-- Non eseguire sul DB cliente se non richiesto.

ALTER TABLE "Portafogli" ADD COLUMN IF NOT EXISTS "Servicer" text;
