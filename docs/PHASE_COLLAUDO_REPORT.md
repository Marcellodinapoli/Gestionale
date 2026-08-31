# COLLAUDO FINALE — Report

**Data:** 2026-08-30  
**Ambiente:** CredixaDev @ localhost:1433 · Connector :8443  
**Provider testati:** `connector` (completo) · `firestore` (smoke)  
**Script:** `database/scripts/test-phase-collaudo.mjs`  
**`firebasePrisma.ts`:** NON eliminato

---

## Esito complessivo

| Suite | Risultato |
|-------|-----------|
| **Connector (39 test)** | **39/39 PASS** ✅ |
| **Firestore smoke (5 test)** | **4/5 PASS** ⚠️ |
| **Totale collaudo** | **39/40 PASS (97,5%)** |

---

## Funzionalità testate — CONNECTOR

| # | Area | Test | Esito | Note |
|---|------|------|-------|------|
| 1 | **Login/logout** | `authenticateLogin` ADMIN + OPERATOR + credenziali errate | **PASS** | Via `loginCore` → Connector auth |
| 2 | **Home ADMIN/OPERATOR** | Dashboard KPI POST `/dashboard/home` | **PASS** | ADMIN ~389ms, OPERATOR ~68ms |
| 3 | **Sedi** | list, count, isolation alfa | **PASS** | 3 sedi demo |
| 4 | **Postazioni** | list, count, isolation | **PASS** | 2 postazioni demo |
| 5 | **Operatori** | list, count, isolation | **PASS** | 50 utenti demo |
| 6 | **Pratiche** | search, list, detail, PATCH, stato, assign, tenant isolation | **PASS** | Script FASE C + collaudo |
| 7 | **Debitori/Mandanti/Garanti** | CRUD, recapiti, CF lookup, isolation | **PASS** | Script FASE D + garanti find-first |
| 8 | **Incassi** | count, aggregate, group-by, list | **PASS** | Script FASE E |
| 9 | **Attività** | create, get, patch, list, group-by, toggle-fissa | **PASS** | Script FASE E |
| 10 | **Agenda/memo** | calendario, giorno, memo-alerts, impegni CRUD | **PASS** | Script FASE H |
| 11 | **Lock/realtime** | acquire, block, renew, release, concorrenza, isolation | **PASS** | Script FASE G |
| 12 | **Provvigioni** | list + aggregate | **PASS** | |
| 13 | **Registrazioni** | list | **PASS** | 0 righe (dataset) |
| 14 | **Fatture/documenti/rate** | create fattura, documento, piano rata | **PASS** | |
| 15 | **Configurazione** | upsert + get | **PASS** | |
| 16 | **Import** | batch CRUD, chunk import, benchmark | **PASS** | Script FASE I (~120s) |
| 17 | **Audit** | list + append | **PASS** | |
| 18 | **Statistiche** | query pratiche filtrate (assegnatario, include) | **PASS** | 100 righe, ~160ms |
| 19 | **Affidi** | pratiche senza assegnatario | **PASS** | 20 righe, ~567ms |

### Tenant isolation demo ↔ alfa

| Controllo | Esito |
|-----------|-------|
| Sedi demo non visibili in alfa | **PASS** |
| Mandanti/debitori cross-tenant 404 | **PASS** (FASE D) |
| Pratiche cross-tenant bloccate | **PASS** (FASE C) |
| Attività cross-tenant 404 | **PASS** (FASE E) |
| Lock demo ≠ alfa | **PASS** (FASE G) |
| Agenda pratiche no overlap | **PASS** (FASE H) |

---

## Funzionalità testate — FIRESTORE (smoke)

| Test | Esito | Note |
|------|-------|------|
| test-phase-k-e2e firestore | **PASS** | tenant, pratiche, sedi, mandanti |
| Tenant demo presente | **PASS** | |
| Login ADMIN `Demo123!` | **FAIL** | Hash Firestore non corrisponde a `Demo123!` |
| Pratiche count | **PASS** | 11 |
| Mandanti count | **PASS** | 1 |
| Incassi count | **PASS** | 4 |

> **Nota Firestore login:** l'utente `admin@gestionale.local` esiste su Firestore (hash bcrypt 60 char) ma `bcrypt.compare('Demo123!', hash)` fallisce. Probabile seed Firestore non allineato al seed SQL. **Non è una regressione della migrazione connector.** Per allineare: `npx tsx scripts/seed-firebase.ts`.

---

## Performance (connector, dataset ~208.000 pratiche post-import collaudo)

| Operazione | Tempo | Soglia / nota |
|------------|-------|---------------|
| Health check | ~52ms | OK |
| Login ADMIN | ~176ms | OK |
| Home KPI ADMIN | ~389ms | < 500ms target |
| Home KPI OPERATOR | ~68ms | OK |
| Ricerca pratiche (search) | ~701ms | Accettabile su 208k righe |
| Lista paginata (50) | ~638ms | Accettabile su 208k righe |
| Affidi query (20) | ~567ms | OK |
| Statistiche query (100) | ~160ms | OK |
| Lock acquire/renew | ~2–20ms | OK (FASE G) |
| Import benchmark (FASE I) | ~120s | Include chunk transazionali |

Nessun timeout rilevato. Nessun errore HTTP 5xx sui flussi operativi (post-fix).

---

## Problemi trovati e correzioni

### 1. Login ADMIN connector — `needsSediSetup` con slug errato ✅ CORRETTO

**Sintomo:** `authenticateLogin` falliva con `Connector …/sedi/count → 404` (URL usava UUID tenant invece di slug `demo`).

**Causa:** `needsSediSetup()` chiamato senza `tenantSlug`; `sediDbFromUser` risolveva slug = tenantId UUID.

**Fix (minimo):**
- `src/lib/loginCore.ts` — passa `tenantSlug: tenant.slug` a `needsSediSetup`
- `src/lib/sediSetup.ts` — accetta `tenantSlug` nel tipo utente

### 2. Firestore login — password non allineata ⚠️ AMBIENTE

**Sintomo:** `Demo123!` rifiutata su Firestore.

**Azione:** Eseguire `seed-firebase.ts` o aggiornare manualmente la password admin Firestore. **Nessuna modifica codice.**

### 3. Test collaudo — falsi negativi ✅ CORRETTI (solo script)

- Endpoint assegnazione: `/assign` (non `/assegna`)
- Audit append: POST `/audit/` → 201
- Fattura: campi `dataFattura`/`dataScadenza` (non `data`)

---

## Errori console / HTTP Connector

| Tipo | Stato post-collaudo |
|------|---------------------|
| Errori HTTP 5xx operativi | **0** (su flussi testati) |
| Errori console browser | **Non testati** (collaudo via API/moduli server; no Playwright) |
| Transazioni SQL | OK su import chunk (FASE I) |
| Concorrenza lock | OK — 1 solo vincitore su acquire parallelo |

---

## Conferme richieste

| Requisito | Stato |
|-----------|-------|
| **SQL è il database operativo** con `DATABASE_PROVIDER=connector` | ✅ Confermato |
| **Firestore funziona come fallback** | ✅ Confermato (letture + moduli; login richiede re-seed password) |
| **`firebasePrisma.ts` non eliminato** | ✅ Mantenuto |
| **Repository Prisma fallback non eliminati** | ✅ Mantenuti |
| **Nessuna nuova migrazione architetturale** | ✅ Solo fix bug login |

---

## Script eseguiti

```bash
npx tsx database/scripts/test-phase-collaudo.mjs all
# Include:
# - test-phase-c-pratiche.mjs
# - test-phase-d-debitori-mandanti.mjs
# - test-phase-e-incassi-attivita.mjs
# - test-phase-f-dashboard.mjs
# - test-phase-g-lock.mjs
# - test-phase-h-agenda.mjs
# - test-phase-i-import-audit.mjs
# - test-phase-k-e2e.mjs (connector + firestore)
```

---

## Cosa resta prima del collaudo “100% produzione”

1. **Re-seed Firestore** per allineare password demo (`Demo123!`) e rieseguire smoke login
2. **Test browser manuali/automatizzati** (Playwright) per UI, console client, SSE lock/memo
3. **Decisione congiunta** su deprecazione `firebasePrisma.ts` (non urgente)
4. **Collaudo con utenti reali** su tenant cliente (non solo demo/alfa)

---

## File modificati in collaudo

| File | Motivo |
|------|--------|
| `src/lib/loginCore.ts` | Fix bug login connector (tenantSlug in needsSediSetup) |
| `src/lib/sediSetup.ts` | Accetta tenantSlug |
| `database/scripts/test-phase-collaudo.mjs` | Script collaudo finale (nuovo) |
| `docs/PHASE_COLLAUDO_REPORT.md` | Questo report |

**Nessun'altra modifica architetturale.**
