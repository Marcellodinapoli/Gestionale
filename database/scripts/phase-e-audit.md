# FASE E — Audit Incassi + Attività

## Chiamate iniziali (src/ operativi)

### prisma.incasso.* — 9

| File | Metodo | N |
|------|--------|---|
| `src/app/(app)/page.tsx` | aggregate, groupBy×2, findMany | 4 |
| `src/actions/importBatch.ts` | count×2 | 2 |
| `src/app/(app)/pratiche/[id]/page.tsx` | aggregate | 1 |
| `src/actions/core.ts` | tx.incasso.create (in transaction) | 1 |
| `src/lib/data/prisma/PrismaPraticheRepository.ts` | findMany (fallback) | 1 |

### prisma.attivita.* — 16

| File | Metodo | N |
|------|--------|---|
| `src/actions/core.ts` | create×6, findUnique×2, update, updateMany×2 | 11 |
| `src/app/(app)/page.tsx` | groupBy | 1 |
| `src/actions/importBatch.ts` | deleteMany | 1 |
| `src/lib/lavorateOggi.ts` | findMany | 1 |
| `src/lib/data/prisma/*` | — | 0 |

**Totale operativo src/: 25** (+ script seed/baseline esclusi)

## Relazioni

- **Incassi → Pratica** (PraticaId, cascade delete)
- **Incassi → User** (UserId operatore)
- **Incassi → Provvigione** (1:1, creata in transaction con incasso)
- **Attività → Pratica** (PraticaId, cascade delete)
- **Attività → User** (UserId, filtro ruolo OPERATOR/SUPERVISOR per KPI lavorate)

## Schema SQL (002 + 005)

Tabelle `Incassi` e `Attivita` già presenti con FK e indici. Nessuna migration distruttiva richiesta.

## Endpoint Connettore da creare

### Incassi
- POST `/list`, `/count`, `/aggregate`, `/group-by-metodo`
- POST `/registra` (transaction: incasso + provvigione + update pratica)
- GET `/:id`

### Attività
- POST `/list`, `/count`, `/group-by-user`
- POST `/`, PATCH `/:id`, POST `/update-many`, POST `/delete-many`, POST `/toggle-fissa`
- GET `/:id`
