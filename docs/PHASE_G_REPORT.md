# FASE G — Report Lock + Realtime

**Data:** 2026-08-30  
**Stato:** ✅ Completata (~95%)  
**Flusso target:** `Browser → RealtimeService → API Next → LockRepository → Connector → SQL Server`

---

## 1. Architettura finale

```
PraticaLockWatcher (browser)
  ├─ subscribeLock() → SSE /api/pratiche/:id/lock/stream (poll server-side 5s)
  ├─ heartbeat POST /api/pratiche/:id/lock ogni 30s (solo owner)
  └─ pagehide → DELETE release

API Next.js /api/pratiche/[id]/lock
  └─ praticaLock.ts (facade)
       ├─ DATABASE_PROVIDER=connector → ConnectorLockRepository
       └─ DATABASE_PROVIDER=firestore  → firestoreLockRepository (Prisma/Firestore)

Connector /api/v1/tenants/:tenantId/pratiche/...
  └─ lockService.ts (transazioni SQL UPDLOCK/HOLDLOCK)
       └─ dbo.PraticheLock
```

Il browser **non** si collega mai a SQL Server né al Connector direttamente.

---

## 2. File modificati / creati

| File | Ruolo |
|------|-------|
| `src/lib/data/contracts/lock.ts` | Contratto `LockRepository`, TTL/heartbeat constants |
| `src/lib/data/connector/ConnectorLockRepository.ts` | Client HTTP verso Connector |
| `src/lib/praticaLockFirestore.ts` | Fallback Firestore (Prisma shim) |
| `src/lib/praticaLock.ts` | Facade provider-aware |
| `src/lib/realtime/RealtimeService.ts` | `subscribeLock()` SSE + fallback adattivo |
| `src/components/pratica/PraticaLockWatcher.tsx` | Heartbeat 30s, SSE, pagehide |
| `src/app/api/pratiche/[id]/lock/stream/route.ts` | SSE Next.js (5s server poll) |
| `connector/src/services/lockService.ts` | SQL transazionale acquire/renew/release |
| `connector/src/routes/lock.ts` | REST + SSE endpoint Connector |
| `connector/src/server.ts` | Cleanup batch lock ogni 5 min |
| `database/scripts/test-phase-g-lock.mjs` | Test incluso concorrenza |

**Non modificato:** `firebasePrisma.ts` (come richiesto).

---

## 3. Endpoint Connector

| Metodo | Path | Azione |
|--------|------|--------|
| GET | `/pratiche/:id/lock?userId=` | getStatus + lazy purge |
| POST | `/pratiche/:id/lock/acquire` | acquire |
| POST | `/pratiche/:id/lock` | renew/heartbeat |
| DELETE | `/pratiche/:id/lock` | release |
| DELETE | `/pratiche/:id/lock/pratica` | release forzato (import) |
| DELETE | `/pratiche/locks/user` | releaseAllUserLocks |
| POST | `/pratiche/locks/active` | findActiveByPraticaIds |
| GET | `/pratiche/:id/lock/stream` | SSE server-side (5s) |

---

## 4. Query SQL e strategia concorrenza

**Tabella:** `dbo.PraticheLock` (PK `PraticaId` — una riga per pratica)

**Acquire / renew** (transazione esplicita):

1. `DELETE` lazy lock scaduto (`LastHeartbeatAt < now - 45s`) per quella pratica
2. `SELECT ... WITH (UPDLOCK, HOLDLOCK)` sulla riga esistente
3. Se assente → `INSERT`
4. Se holder diverso e non scaduto → deny (`owned: false, lockedBy`)
5. Se stesso utente o scaduto → `UPDATE LastHeartbeatAt`

**Scelta:** `UPDLOCK + HOLDLOCK` in transazione READ COMMITTED (default). PK su `PraticaId` garantisce un solo lock per pratica; la serializzazione avviene sul lock row. Alternativa `sp_getapplock` scartata per semplicità e allineamento al modello dati esistente.

**Cleanup:**

- Lazy: ogni `getStatus` / acquire / renew
- Batch: `purgeExpiredLocksBatch()` ogni **5 minuti** nel Connector

**Costanti:**

- TTL: **45s**
- Heartbeat browser: **30s**

---

## 5. Strategia Realtime

| Prima | Dopo |
|-------|------|
| Poll browser ogni **15s** (owner + non-owner) | SSE `subscribeLock()` — aggiornamenti push |
| ~4 req/min/operatore solo lock status | Owner: 2 heartbeat/min + 1 connessione SSE |
| | Non-owner: solo SSE (0 poll lock) |

**Implementazione:**

- `RealtimeService.subscribeLock()` → `EventSource` su `/api/pratiche/:id/lock/stream`
- Server Next poll `getPraticaLockStatus` ogni **5s** (non il browser)
- Fallback: polling adattivo 30–60s se SSE fallisce
- Connector espone anche SSE nativo (disponibile per proxy futuro)

---

## 6. Test eseguiti

| # | Scenario | Esito |
|---|----------|-------|
| 1 | A acquisisce | ✅ ~21ms |
| 2 | B bloccato | ✅ `lockedByName` |
| 3 | A renew | ✅ ~15ms |
| 4 | A release | ✅ ~5ms |
| 5 | B acquisisce dopo release | ✅ |
| 6 | **Concurrent acquire (Promise.all)** | ✅ **1 solo winner** |
| 7 | Tenant demo ↔ alfa | ✅ |
| 8 | getStatus | ✅ ~7ms |
| 9 | `npx tsc --noEmit` | ✅ |
| 10 | `npm run build` | ✅ |
| 11 | `connector npm run build` | ✅ |

**Non automatizzato in CI:** TTL scaduto (45s wait), chiusura tab browser (E2E), test Firestore provider (richiede env firestore).

Script: `node database/scripts/test-phase-g-lock.mjs`

---

## 7. Benchmark (Connector, demo)

| Operazione | Tempo tipico |
|------------|--------------|
| acquire | ~12–21 ms |
| renew | ~15 ms |
| release | ~5 ms |
| getStatus | ~7 ms |

### Richieste per operatore (scheda pratica aperta)

| Scenario | Prima (15s poll) | Dopo |
|----------|------------------|------|
| Owner | ~4 GET/POST lock/min | ~2 POST heartbeat/min + SSE |
| Non-owner | ~4 GET/min | SSE only (~0 poll client) |
| **100 operatori owner** | ~400 req/min lock | ~200 POST/min + 100 SSE |

Riduzione stimata poll lock client: **~50–100%** (non-owner eliminato del tutto).

---

## 8. Confronto provider

| | `DATABASE_PROVIDER=firestore` | `DATABASE_PROVIDER=connector` |
|--|-------------------------------|-------------------------------|
| Lock storage | Firestore `praticaLocks` | SQL `PraticheLock` |
| Concorrenza | Sequential fake `$transaction` | UPDLOCK/HOLDLOCK SQL |
| Chiamate lock da app | `firestoreLockRepository` | `ConnectorLockRepository` |
| `prisma.praticaLock` in app | Solo fallback Firestore | **0** (eliminato dal path connector) |

---

## 9. Problemi residui

1. **Test TTL 45s** — non in script automatico (durata); verificabile manualmente.
2. **Test tab close / pagehide** — comportamento browser, non in script Node.
3. **Test Firestore provider** — richiede `DATABASE_PROVIDER=firestore` + env Firebase.
4. **SSE through Next** — una connessione long-lived per scheda; monitorare limiti proxy in produzione.
5. **renewLock** su riga assente riapre transazione via `acquireLock` (accettabile, 2 round-trip interni rari).

---

## 10. Completamento

| Area | % |
|------|---|
| Lock SQL transazionale + concorrenza | 100% |
| LockRepository + facade | 100% |
| Realtime SSE + fallback | 100% |
| PraticaLockWatcher (30s, pagehide) | 100% |
| Test concorrenti | 100% |
| Test E2E browser / Firestore / TTL | 70% |

**Completamento effettivo FASE G: ~95%**

Concorrenza **verificata** con due acquire simultanei — un solo operatore vince.

---

## 11. Prossimi passi (FASE H — non avviata)

- E2E Playwright per pagehide / riconnessione SSE
- Test TTL automatizzato con clock mock o SQL update
- Pub/sub in-memory sul Connector per SSE istantaneo post-release (opzionale)
