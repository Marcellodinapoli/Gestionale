# FASE D — Audit Debitori / Mandanti

## Chiamate `prisma.debitore.*` (4 file operativi + 2 import)

| File | Chiamate | Operazioni |
|------|----------|------------|
| `src/lib/domain.ts` | 2 | findMany by CF |
| `src/actions/core.ts` | 4 | update (contatti, telefonoStato), create (import) |
| `src/lib/importPraticheBatch.ts` | 2 | update, create |
| `src/actions/importBatch.ts` | 1 | delete |

**Totale debitore:** 9

## Chiamate `prisma.debitoreRecapito.*` (2 file)

| File | Chiamate | Operazioni |
|------|----------|------------|
| `src/actions/core.ts` | 8 | count, create, findFirst, update, delete |
| `src/actions/importBatch.ts` | 1 | deleteMany |

**Totale recapito:** 9

## Chiamate `prisma.mandante.*` (15 file)

| File | Chiamate | Operazioni |
|------|----------|------------|
| `src/actions/core.ts` | 4 | create, findFirst×2, update, delete |
| `src/app/(app)/mandanti/page.tsx` | 1 | findMany + _count |
| `src/app/(app)/mandanti/[id]/page.tsx` | 1 | findFirst + _count |
| `src/app/(app)/pratiche/page.tsx` | 1 | findMany select |
| `src/app/(app)/lavorazione/page.tsx` | 1 | findMany |
| `src/lib/codiciMandantePerimetro.ts` | 1 | findMany |
| `src/lib/importContesto.ts` | 1 | findFirst |
| `src/app/(app)/page.tsx` | 4 | findMany, count×3, groupBy context |
| `src/app/(app)/statistiche/page.tsx` | 1 | findMany |
| `src/app/(app)/import/page.tsx` | 1 | findMany |
| `src/lib/provvigioniPerimetro.ts` | 2 | findMany |
| `src/lib/gruppoMandanti.ts` | 1 | findMany select |
| `src/app/(app)/provigioni/page.tsx` | 1 | findMany |
| `src/app/(app)/affidi/page.tsx` | 1 | findMany |
| `src/actions/gruppoOperatori.ts` | 1 | count |

**Totale mandante:** 22

## Endpoint Connettore necessari

### Mandanti `/api/v1/tenants/:tenantId/mandanti`

- `POST /list` — findMany (filtri tenant, idsIn, include pratica count)
- `POST /count`
- `GET /:id` — findFirst + optional count
- `POST /` — create
- `PATCH /:id` — update
- `DELETE /:id` — delete (blocco se pratiche collegate)

### Debitori `/api/v1/tenants/:tenantId/debitori`

- `POST /list` — findMany
- `POST /ids-by-cf` — ricerca per varianti CF (domain)
- `GET /:id`
- `POST /` — create
- `PATCH /:id` — update
- `DELETE /:id`
- `GET /:id/recapiti`
- `POST /:id/recapiti` — create recapito
- `PATCH /recapiti/:recapitoId`
- `DELETE /recapiti/:recapitoId`
- `POST /recapiti/count`
- `POST /recapiti/find-first`

## Migration SQL

`006_alter_mandanti_debitori.sql` — colonne mancanti + indici CF/codice.
