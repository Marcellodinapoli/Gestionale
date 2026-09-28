-- Aggiunge tipo evento DWELL (permanenza su route precedente).
-- Idempotente.

ALTER TABLE "PerfEvents" DROP CONSTRAINT IF EXISTS "PerfEvents_Type_check";

ALTER TABLE "PerfEvents" ADD CONSTRAINT "PerfEvents_Type_check"
  CHECK ("Type" IN ('PAGE', 'ACTION', 'API', 'QUERY', 'ERROR', 'SESSION', 'DWELL'));
