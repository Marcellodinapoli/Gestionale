-- Fax e WhatsApp su postazioni (Neon / PostgreSQL)
ALTER TABLE "Postazioni" ADD COLUMN IF NOT EXISTS "NumeroFax" VARCHAR(30);
ALTER TABLE "Postazioni" ADD COLUMN IF NOT EXISTS "NumeroWhatsapp" VARCHAR(30);
