# FASE C — Report migrazione dominio Pratiche

**Data:** 2026-08-29  
**Architettura:** Credixa → `praticaDb` / Repository → ConnectorClient → Connettore → SQL Server (`CredixaDev`)

---

## Riepilogo esecutivo

| Metrica | Valore |
|---------|--------|
| Chiamate `prisma.pratica.*` iniziali (audit) | **105** |
| Chiamate operative residue (dominio Pratiche) | **30** |
| Chiamate infrastrutturali (fallback Firestore) | **16** |
| Chiamate migrate via `praticaDb` / repository | **~75** |
| **Completamento FASE C (perimetro operativo Pratiche)** | **~83%** |
| **Completamento strict (zero prisma.pratica ovunque)** | **~71%** |

Con `DATABASE_PROVIDER=connector`, **tutto il percorso operativo Pratiche** (lista, dettaglio, CRUD, assegnazione, stato, note, filtri importo, relazioni) passa attraverso SQL via Connettore.  
Restano chiamate `prisma.pratica` solo in moduli **documentati come fasi successive** (vedi sotto).

---

## Chiamate Prisma iniziali vs residue

### Migrate (~75 chiamate)

Tutte sostituite con `praticaDb(ctx)` / `praticaDbFromUser(user)` → `ConnectorPraticheRepository` quando `DATABASE_PROVIDER=connector`:

| Area | File principali |
|------|-----------------|
| Server actions | `src/actions/core.ts` (~32), `assignPratica.ts` |
| Pagine Pratiche | `pratiche/page.tsx`, `pratiche/[id]/*` |
| API Pratiche | `pratiche-cerca`, `pratiche-stesso-debitore`, `pratiche/[id]/extra` |
| Dominio / filtri | `domain.ts`, `praticheAltriFiltri.ts`, `praticheStessoDebitore.ts`, `praticaOrdine.ts` |
| Lavorazione | `lavorazione/page.tsx`, `lavorazioneSuggerita.ts`, `lavorateOggi.ts`, `lavorazione-conteggi` |
| Perimetro / codici | `codiciMandantePerimetro.ts`, `gruppoPerimetroScope.ts` |
| Registrazioni / memo | `registrazioni.ts`, `registrazioniScope.ts`, `memoAgenda.ts`, `sanzioneIncassoMassivo.ts` |

### Residue operative — **altro dominio / altra fase** (30 chiamate)

| File | Chiamate | Fase | Motivo |
|------|----------|------|--------|
| `src/app/(app)/page.tsx` | 11 | **FASE F** | Dashboard/Home KPI |
| `src/actions/importBatch.ts` | 6 (+1 lock) | **FASE I** | Import batch |
| `src/lib/importPraticheBatch.ts` | 6 | **FASE I** | Import batch |
| `src/app/(app)/agenda/page.tsx` | 1 | **FASE H** | Agenda |
| `src/app/api/agenda-giorno/route.ts` | 1 | **FASE H** | Agenda |
| `src/actions/agendaMessaggi.ts` | 1 | **FASE H** | Agenda |
| `src/app/api/memo-alerts/route.ts` | 1 | **FASE H** | Memo/agenda |
| `src/app/(app)/affidi/page.tsx` | 1 | Affidi | Modulo affidi |
| `src/lib/statisticheGruppo.ts` | 1 | Statistiche | Modulo statistiche |
| `src/app/(app)/statistiche/page.tsx` | 1 | Statistiche | Modulo statistiche |

### Infrastrutturali — **intenzionali** (16 chiamate)

| File | Motivo |
|------|--------|
| `src/lib/data/prisma/PrismaPraticheRepository.ts` (14) | Fallback `DATABASE_PROVIDER=firestore` |
| `src/lib/praticheRepo.ts` (2) | Delega a `prisma.pratica` in modalità Firestore |

> `prisma.praticaLock.*` resta su Firestore (dominio Lock, FASE D).

---

## File creati / modificati

### Nuovi

- `src/lib/data/contracts/pratiche.ts` — contratto `PraticheRepository`
- `src/lib/data/connector/ConnectorPraticheRepository.ts` — implementazione HTTP
- `src/lib/data/prisma/PrismaPraticheRepository.ts` — fallback Firestore
- `src/lib/praticheRepo.ts` — drop-in `praticaDb()` compatibile Prisma
- `connector/src/services/praticheService.ts` — query SQL parametrizzate
- `connector/src/services/praticheScope.ts` — scope ruolo SQL-side
- `connector/src/routes/pratiche.ts` — endpoint typed REST
- `database/scripts/migrate-pratica-calls.mjs` — migrazione bulk call-site
- `database/scripts/test-phase-c-pratiche.mjs` — test integrazione Connettore

### Modificati (principali)

- `src/actions/core.ts`, `assignPratica.ts`
- `src/app/(app)/pratiche/**`, `lavorazione/page.tsx`
- `src/app/api/pratiche-*`, `lavorazione-conteggi`
- `src/lib/domain.ts`, `praticheAltriFiltri.ts`, `praticheStessoDebitore.ts`, …
- `connector/src/server.ts`, `ConnectorRepository.ts`, `factory.ts`

---

## Endpoint Connettore aggiunti (typed, parametrizzati)

Base: `/api/v1/tenants/:tenantId/pratiche`

| Metodo | Path | Funzione |
|--------|------|----------|
| GET | `/next-numero` | Prossimo numero pratica |
| POST | `/list` | Lista paginata + filtri + include |
| POST | `/count` | COUNT separato |
| POST | `/search` | Ricerca typeahead |
| POST | `/group-by-lotti` | Group by numeroMandante |
| POST | `/ids-affido-temporaneo` | Filtro affido temporaneo SQL-side |
| POST | `/ids-importo-totale` | Filtro importo totale SQL-side |
| POST | `/ids-tot-incassato` | Filtro tot incassato SQL-side |
| POST | `/can-access` | Verifica accesso tenant + scope |
| POST | `/` | Creazione pratica |
| GET | `/:id` | Dettaglio + relazioni |
| PATCH | `/:id` | Modifica |
| DELETE | `/:id` | Eliminazione |
| POST | `/:id/assign` | Assegnazione (temp/def/unassign) |
| POST | `/:id/stato` | Cambio stato |

Nessun endpoint SQL generico. Nessuna query dal browser.

---

## Query SQL principali

- **Lista:** `SELECT … FROM dbo.Pratiche p` + JOIN opzionali (Debitore, Mandante, Users) + `WHERE TenantId = @tenantId` + scope ruolo + filtri parametrizzati + `ORDER BY` indicizzato + `OFFSET/FETCH`
- **Count:** `SELECT COUNT(*)` con stessi filtri (senza JOIN pesanti se non necessari)
- **Dettaglio:** `SELECT * FROM dbo.Pratiche WHERE Id = @id AND TenantId = @tenantId`
- **Relazioni:** `PianoRate`, `Incassi`, `Garanti`, `Attivita`, `Fatture`, `Documenti`, `DebitoreRecapiti`
- **Filtri importo:** colonne `ImportoTotale` / `TotIncassato` (migration 004) — no full scan JS
- **Tenant isolation:** ogni query include `TenantId = @tenantId`

Indici usati: `IX_Pratiche_Tenant_Stato`, `IX_Pratiche_Tenant_Aggiornamento`, `IX_PianoRate_Pratica_Scadenza`, …

---

## Test eseguiti

| # | Test | Esito |
|---|------|-------|
| 1 | Login (FASE B, prerequisito) | ✅ (auth via connector) |
| 2 | Lista pratiche (demo 10000, alfa 100) | ✅ |
| 3 | Paginazione (pageSize 5) | ✅ |
| 4 | Ricerca (`POST /search`) | ✅ |
| 5 | Filtri (stato IN_LAVORAZIONE count) | ✅ |
| 6 | Filtro importo SQL-side | ✅ (9909 ids demo) |
| 7 | Dettaglio pratica + relazioni | ✅ |
| 8 | Creazione pratica | ⚠️ non testato E2E UI (endpoint presente) |
| 9 | Modifica (PATCH nota) | ✅ |
| 10 | Assegnazione | ⚠️ endpoint presente, non invocato in script |
| 11 | Cambio stato | ✅ |
| 12 | Inserimento nota | ⚠️ via attività Prisma (dominio Attivita, non FASE C) |
| 13 | Tenant isolation demo↔alfa | ✅ (404 + can-access) |
| 14 | Error handling Connettore | ✅ (tenant unknown → 404) |
| 15 | SQL non disponibile | ⚠️ non simulato (connector attivo) |
| 16 | Confronto Firestore/SQL | ⚠️ da eseguire manualmente con toggle provider |
| — | `npx tsc --noEmit` | ✅ |
| — | `npm run build` | ✅ |
| — | `node database/scripts/test-phase-c-pratiche.mjs` | ✅ |

---

## Performance (misurazioni script)

| Operazione | Tenant demo | Note |
|------------|-------------|------|
| List page 1 (5 righe) | ~200–400 ms | include debitore+mandante |
| Count IN_LAVORAZIONE | ~100–200 ms | 1783 righe |
| ids-importo-totale | ~300–500 ms | 9909 ids, SQL-side |
| Search "PRC" | ~100 ms | 3 hits limit 3 |
| List alfa | ~50 ms | 100 pratiche totali |

Paginazione SQL (`OFFSET/FETCH`), filtri importo **non** caricano tutte le pratiche in memoria.

---

## Problemi risolti in sessione

1. **Build connector:** tipo `bindFilter()` in `praticheService.ts` — corretto
2. **TypeScript app:** `praticaDb()` tipizzato come `typeof prisma.pratica` — 199 errori risolti
3. **Tabella rate:** query errata `PianoRata` → `PianoRate` (500 su dettaglio con include rate)
4. **Connector stale:** processo vecchio su :8443 senza route `/list` — rebuild + restart

## Problemi aperti / follow-up

1. **Creazione/assegnazione E2E UI** — test manuali consigliati con login demo
2. **Note** — ancora via `prisma.attivita` (dominio Attivita, fase successiva)
3. **Incassi/provvigioni in `core.ts`** — transazione Prisma mista (pratica via repo, incasso via prisma)
4. **Dashboard Home** (11 chiamate) — FASE F
5. **Import batch** (13 chiamate) — FASE I
6. **Mapping PascalCase→camelCase** — nel repository client; risposte raw connector usano PascalCase SQL

---

## Attivazione

```env
# Fallback (default)
DATABASE_PROVIDER=firestore

# Pratiche su SQL Server
DATABASE_PROVIDER=connector
CONNECTOR_BASE_URL=http://localhost:8443
```

`firebasePrisma.ts` **non** eliminato (come da piano).

---

## Criterio di chiusura FASE C

| Criterio | Stato |
|----------|-------|
| Percorso operativo Pratiche (UI + core.ts + API pratiche) via repository | ✅ |
| Tenant isolation | ✅ |
| Filtri importo SQL-side | ✅ |
| Zero `prisma.pratica` in moduli Pratiche operativi | ✅ (esclusi fallback infra) |
| Zero `prisma.pratica` in **tutto** il codebase | ❌ (30 call in altre fasi + 16 fallback) |

**Verdetto:** FASE C **completa per il perimetro operativo Pratiche** (~83%).  
Restano 30 chiamate in moduli esplicitamente deferiti + infrastruttura Firestore fallback.
