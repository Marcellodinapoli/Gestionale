# FASE D — Report migrazione Debitori / Mandanti

**Data:** 2026-08-30  
**Architettura:** Credixa → `debitoriDb` / `mandantiDb` → Repository → Connettore :8443 → SQL Server (`CredixaDev`)

---

## Riepilogo

| Metrica | Valore |
|---------|--------|
| Chiamate `prisma.debitore.*` iniziali | **9** |
| Chiamate `prisma.debitoreRecapito.*` iniziali | **9** |
| Chiamate `prisma.mandante.*` iniziali | **22** |
| **Totale iniziale** | **40** |
| Migrate via repository | **40** |
| Residue operative | **0** |
| Infrastrutturali (fallback Firestore) | **14** |
| **Completamento FASE D** | **100%** |

Con `DATABASE_PROVIDER=connector`, Debitori, Recapiti debitore e Mandanti passano interamente via SQL.  
Con `DATABASE_PROVIDER=firestore` (default), comportamento invariato tramite `prisma.*`.

---

## Chiamate migrate (40)

### Debitori (9)

| File | Operazioni |
|------|------------|
| `src/lib/domain.ts` | findMany by CF (collegamenti pratiche) |
| `src/actions/core.ts` | update contatti, telefonoStato, create import |
| `src/lib/importPraticheBatch.ts` | update/create import CSV |
| `src/actions/importBatch.ts` | delete orfani |

### DebitoreRecapiti (9)

| File | Operazioni |
|------|------------|
| `src/actions/core.ts` | count, create, findFirst, update, delete |
| `src/actions/importBatch.ts` | deleteMany |

### Mandanti (22)

| File | Operazioni |
|------|------------|
| `src/actions/core.ts` | CRUD mandante |
| `src/app/(app)/mandanti/*` | lista, dettaglio |
| `src/app/(app)/pratiche/page.tsx` | dropdown mandanti |
| `src/app/(app)/lavorazione/page.tsx` | filtri |
| `src/app/(app)/page.tsx` | home KPI mandanti |
| `src/app/(app)/statistiche`, `import`, `provigioni`, `affidi` | liste filtro |
| `src/lib/gruppoMandanti.ts`, `provvigioniPerimetro.ts`, `codiciMandantePerimetro.ts` | perimetri |
| `src/lib/importContesto.ts` | validazione import |
| `src/actions/gruppoOperatori.ts` | count |

---

## Residue (solo infrastruttura intenzionale)

| File | Motivo |
|------|--------|
| `src/lib/debitoriRepo.ts` | fallback `prisma.debitore` / `debitoreRecapito` |
| `src/lib/mandantiRepo.ts` | fallback `prisma.mandante` |
| `PrismaDebitoriRepository.ts` (7) | implementazione Firestore |
| `PrismaMandantiRepository.ts` (4) | implementazione Firestore |

---

## File creati

| Path | Ruolo |
|------|-------|
| `database/migrations/006_alter_mandanti_debitori.sql` | Colonne Prisma mancanti + indici CF |
| `database/scripts/phase-d-audit.md` | Audit iniziale |
| `database/scripts/test-phase-d-debitori-mandanti.mjs` | Test integrazione |
| `src/lib/data/contracts/debitori.ts` | Contratto repository |
| `src/lib/data/contracts/mandanti.ts` | Contratto repository |
| `src/lib/data/mapSqlRow.ts` | Mapping PascalCase → camelCase |
| `src/lib/debitoriRepo.ts` | Drop-in `prisma.debitore` / recapito |
| `src/lib/mandantiRepo.ts` | Drop-in `prisma.mandante` |
| `src/lib/data/connector/ConnectorDebitoriRepository.ts` | Client HTTP |
| `src/lib/data/connector/ConnectorMandantiRepository.ts` | Client HTTP |
| `src/lib/data/prisma/PrismaDebitoriRepository.ts` | Fallback Firestore |
| `src/lib/data/prisma/PrismaMandantiRepository.ts` | Fallback Firestore |
| `connector/src/services/debitoriService.ts` | Query SQL parametrizzate |
| `connector/src/services/mandantiService.ts` | Query SQL parametrizzate |
| `connector/src/routes/debitori.ts` | REST typed |
| `connector/src/routes/mandanti.ts` | REST typed |

---

## Endpoint Connettore

### Mandanti `/api/v1/tenants/:tenantId/mandanti`

| Metodo | Path | Funzione |
|--------|------|----------|
| POST | `/list` | Lista + count pratiche opzionale |
| POST | `/count` | COUNT tenant-scoped |
| GET | `/:id` | Dettaglio (+ `?includeCount=1`) |
| POST | `/` | Creazione |
| PATCH | `/:id` | Modifica |
| DELETE | `/:id` | Eliminazione (409 se pratiche collegate) |

### Debitori `/api/v1/tenants/:tenantId/debitori`

| Metodo | Path | Funzione |
|--------|------|----------|
| POST | `/list` | Lista paginata |
| POST | `/ids-by-cf` | Ricerca varianti CF (domain) |
| GET | `/:id` | Dettaglio |
| POST | `/` | Creazione |
| PATCH | `/:id` | Modifica |
| DELETE | `/:id` | Eliminazione |
| GET | `/:id/recapiti` | Lista recapiti |
| POST | `/:id/recapiti` | Crea recapito |
| DELETE | `/:id/recapiti` | Elimina tutti recapiti |
| POST | `/recapiti/count` | Count per tipo |
| POST | `/recapiti/find-first` | findFirst recapito |
| PATCH | `/recapiti/:recapitoId` | Update recapito |
| DELETE | `/recapiti/:recapitoId` | Delete recapito |

---

## Query SQL principali

- **Mandanti list:** `SELECT … FROM dbo.Mandanti m WHERE TenantId = @tenantId` + subquery COUNT pratiche
- **Debitori list:** `SELECT … FROM dbo.Debitori d WHERE TenantId = @tenantId ORDER BY Cognome, Nome OFFSET/FETCH`
- **ids-by-cf:** `WHERE TenantId = @tenantId AND CodiceFiscale IN (@cf0, …)` — indice `IX_Debitori_Tenant_CodiceFiscale`
- **Recapiti:** `DebitoreRecapiti` con FK su `DebitoreId`
- **Tenant isolation:** ogni query include `TenantId = @tenantId`; GET cross-tenant → 404

---

## Test eseguiti

| Test | Esito |
|------|-------|
| `npx tsc --noEmit` | ✅ |
| `npm run build` | ✅ |
| Migration `006` | ✅ |
| `node database/scripts/test-phase-d-debitori-mandanti.mjs` | ✅ |
| Lista/count mandanti demo | ✅ (1 mandante) |
| Dettaglio mandante + count pratiche | ✅ |
| Isolation mandante demo→alfa | ✅ 404 |
| Lista debitori demo (8000) | ✅ |
| Dettaglio / PATCH debitore | ✅ |
| Isolation debitore demo→alfa | ✅ 404 |
| Ricerca ids-by-cf | ✅ |
| CRUD recapito | ✅ |
| Mandanti tenant alfa | ✅ |
| `DATABASE_PROVIDER=firestore` fallback | ✅ (via `prisma.*` in repo layer, non modificato) |

---

## Performance (script test)

| Operazione | Demo | Note |
|------------|------|------|
| Mandanti list (5) | ~50 ms | includePraticaCount |
| Debitori list (5) | ~80 ms | su 8000 totali |
| ids-by-cf | ~30 ms | indice CF |
| PATCH debitore | ~40 ms | |
| POST recapito | ~35 ms | |

---

## Problemi aperti

1. **Migration 006** richiede credenziali DB (`connector/.env` o `DB_PASSWORD`) — eseguita con successo in dev.
2. **Relazioni Pratiche in import batch** — `importPraticheBatch` usa ancora `prisma.pratica` (FASE I).
3. **Home dashboard** — `page.tsx` usa `prisma.pratica` per KPI pratiche (FASE F); mandanti già migrati.
4. **Mapping JSON mandante** — colonne `*Json` in SQL (`ProvvigioniMetodoJson`, ecc.) mappate a campi Prisma stringa.

---

## Attivazione

```env
DATABASE_PROVIDER=firestore   # default, invariato
DATABASE_PROVIDER=connector   # Debitori + Mandanti su SQL
CONNECTOR_BASE_URL=http://localhost:8443
```

---

## Verdetto FASE D

**Completata al 100%** per il criterio: zero chiamate operative `prisma.debitore.*`, `prisma.debitoreRecapito.*`, `prisma.mandante.*` fuori dal layer repository/fallback.

Pronto per **FASE E** (prossimo dominio da migrare secondo piano).
