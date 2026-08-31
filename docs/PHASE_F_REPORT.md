# FASE F — Report migrazione Dashboard/Home

**Data:** 2026-08-30  
**Stato:** ✅ Completata (~95%)  
**Provider target:** `DATABASE_PROVIDER=connector` → `DashboardRepository` → Connettore `:8443` → SQL Server `CredixaDev`

---

## 1. Audit iniziale

Vedi `database/scripts/phase-f-audit.md`.

### Chiamate `prisma.*` nella Home (prima)

| Area | Chiamate dirette | Note |
|------|------------------|------|
| `page.tsx` shared | 2× `pratica.count` | totali, scadute |
| `page.tsx` ADMIN | ~11 `pratica.*` + N+1 carico gruppi | findMany, groupBy, count×(2N+3) |
| `page.tsx` AMMINISTRAZIONE | count, sede, provvigioni×2 | |
| Helper indiretti | 3× `pratica.findMany` full scan | codici, in-lavorazione, da-affidare |
| Lavorate/audit | attivita + auditLog | via `lavorateOggi` |

**Baseline misurata (Firestore/Prisma):**

| Ruolo | Prisma | Firestore reads | Tempo |
|-------|--------|-----------------|-------|
| ADMIN | ~30 | ~119 | ~2.374 ms |
| OPERATOR | ~24 | ~65 | ~1.198 ms |

---

## 2. Architettura finale

```
page.tsx
  └─ buildHomeKpiContext()
  └─ loadHomeKpiAuto()
       ├─ DATABASE_PROVIDER=connector → ConnectorDashboardRepository.getHomeKpi()
       │     └─ POST /api/v1/tenants/:tenantId/dashboard/home  (1 round-trip)
       │           └─ dashboardHomeService.getHomeKpiBundle()  (~6–18 query SQL interne)
       └─ DATABASE_PROVIDER=firestore → firestoreHomeKpi.ts (Prisma fallback)
```

### File principali

| File | Ruolo |
|------|-------|
| `src/lib/data/contracts/dashboard.ts` | `HomeKpiContext`, `HomeKpiBundle`, `DashboardRepository` |
| `src/lib/homeKpi/buildContext.ts` | Scope serializzabile per ruolo |
| `src/lib/homeKpi/loadHomeKpi.ts` | Routing connector / firestore |
| `src/lib/homeKpi/firestoreHomeKpi.ts` | Fallback Prisma (Firestore provider) |
| `src/lib/data/connector/ConnectorDashboardRepository.ts` | Client HTTP |
| `connector/src/services/dashboardHomeService.ts` | Bundle SQL aggregato |
| `connector/src/services/dashboardScope.ts` | `bindPraticaScope()` tenant-safe |
| `connector/src/routes/dashboard.ts` | `GET/POST /home`, legacy `/home/legacy` |

---

## 3. Endpoint Connector

```
GET  /api/v1/tenants/:tenantId/dashboard/home?ctx=<JSON encoded>
POST /api/v1/tenants/:tenantId/dashboard/home
```

Body: `HomeKpiContext` (role, userId, scope, lavorateDate, filtri incassi, flag admin/amministrazione).

Risposta: `HomeKpiBundle` + `meta { queryMs, sqlQueries, roundTrips: 1 }`.

---

## 4. Query SQL (bundle)

### Shared (~6 query, tutti i ruoli operativi)

1. **Counts** — `COUNT(*)` + scadute con `CASE` (scope indicizzato su `TenantId`)
2. **Incassi oggi** — `SUM(Importo)` su `Incassi` filtrato tenant/user
3. **In lavorazione** — `GROUP BY MandanteId, NumeroMandante` stati AFFIDATA/IN_LAVORAZIONE/PROMESSA
4. **Codici mandante/perimetro** — aggregazione slot codice (`ImportoTotale`/`CodiceScarico`)
5. **Da affidare** — optional, filtro gruppo mandanti
6. **Lavorate giorno** — CTE `ROW_NUMBER` su `Attivita` + join `Pratiche` scope
7. **Audit cambio codice** — optional, top 200 su `AuditLog`

### ADMIN (+~12 query in un handler)

- Sedi, riepilogo mandanti (`ImportoTotale`, `TotIncassato` denormalizzati)
- Mandanti + lotti perimetri UI
- Incassi per metodo (totale + mese corrente in un'unica query)
- Produttività operatori (LEFT JOIN Attivita oggi)
- Allerte scadenze (3 metriche in 1 query)
- Carico gruppi (CTE team supervisor+membri, no N+1)
- Esiti contatto GROUP BY
- Incassi per mandante × 6 mesi (aggregazione SQL)

### AMMINISTRAZIONE (+~6 query)

- Sedi, pratiche count, mandanti count, operatori count
- Provvigioni mese / da liquidare (join `Provvigioni` + `Users.SedeId`)

Tutte le query sono **parametrizzate**, **tenant-safe** (`TenantId = @tenantId`), senza SQL dal client.

---

## 5. Indici utilizzati

Esistenti da `005_indexes.sql`:

- `Pratiche(TenantId, Stato, AssegnatarioId)`
- `Pratiche(TenantId, MandanteId, NumeroMandante)`
- `Incassi(TenantId, Data)`
- `Attivita(TenantId, CreatedAt)`
- Colonne denormalizzate `ImportoTotale`, `TotIncassato` su `Pratiche`

**Nessuna nuova migration 007** aggiunta in FASE F — performance accettabile fino a 10k pratiche demo.

---

## 6. Chiamate eliminate / migrate

| Prima | Dopo (connector) |
|-------|------------------|
| ~30 Prisma ADMIN | 0 Prisma in `page.tsx` (ADMIN) |
| ~24 Prisma OPERATOR | 0 Prisma KPI in `page.tsx` |
| 3 full scan findMany helper | 2 query GROUP BY aggregate |
| N+1 carico gruppi | 1 CTE query |
| ~119 Firestore reads ADMIN | 0 (SQL diretto) |

**Residuo accettato in `page.tsx`:**

- `prisma.user.findMany` — solo picker BACK_OFFICE supervisori (UI, non KPI)

**Residuo Firestore fallback (`firestoreHomeKpi.ts`):**

- Path completo Prisma quando `DATABASE_PROVIDER=firestore`
- Admin: `caricoGruppi`, `esitiContatto`, `incassiPerMandanteMese` ancora vuoti nel fallback (connector path completo)

---

## 7. Benchmark dopo migrazione

Misurato con `database/scripts/test-phase-f-dashboard.mjs` su tenant **demo** (~10.000 pratiche), Connettore locale.

| Ruolo | Round-trip Connector | Query SQL | Tempo HTTP | Tempo SQL interno |
|-------|---------------------|-----------|------------|-------------------|
| **ADMIN** | **1** | 18 | **241 ms** | 237 ms |
| **SUPERVISOR** | **1** | 6 | **38 ms** | — |
| **OPERATOR** | **1** | 6 | **78 ms** | — |

### Confronto baseline

| Metrica | ADMIN prima | ADMIN dopo | Δ |
|---------|-------------|------------|---|
| Round-trip dati | ~30+ Prisma | 1 HTTP | **−97%** |
| Tempo totale | ~2.374 ms | ~241 ms | **−90%** |
| Firestore reads | ~119 | 0 | **−100%** |

| Metrica | OPERATOR prima | OPERATOR dopo | Δ |
|---------|----------------|---------------|---|
| Prisma/reads | ~24 / ~65 | 1 HTTP / 6 SQL | **−96%** |
| Tempo | ~1.198 ms | ~78 ms | **−93%** |

> Scalabilità 50k–500k: architettura pronta (aggregazioni SQL, no full scan per KPI codici); profiling aggiuntivo consigliato oltre 100k con indice `(TenantId, Scadenza, Stato)` se necessario.

---

## 8. Confronto Firestore vs SQL

| KPI | Equivalenza | Note |
|-----|-------------|------|
| Totale pratiche | ✅ | Scope-bound via `bindPraticaScope` |
| Scadute | ✅ | Stessi stati chiusi |
| Incassi oggi | ✅ | tenant vs user scope |
| In lavorazione per perimetro | ✅ | GROUP BY vs findMany+reduce |
| Codici mandante/perimetro | ✅ | Slot codice allineato a `CODICE_SLOT_SQL` |
| Da affidare gruppo | ✅ | |
| Lavorate giorno | ⚠️ | SQL usa ultima attività/giorno; audit cambio codice semplificato vs logica Firestore completa |
| ADMIN riepilogo mandanti | ✅ | Usa `ImportoTotale`/`TotIncassato` vs somma incassi Prisma — allineato se colonne aggiornate sul write path |
| ADMIN incassi tipologia | ✅ | |
| ADMIN carico gruppi | ✅ | Connector completo; Firestore fallback parziale |
| Tenant isolation demo↔alfa | ✅ | demo=10000, alfa=100 |

---

## 9. Test eseguiti

| # | Test | Esito |
|---|------|-------|
| 1 | `npx tsc --noEmit` | ✅ |
| 2 | `npm run build` | ✅ |
| 3 | `connector npm run build` | ✅ |
| 4 | `node database/scripts/test-phase-f-dashboard.mjs` | ✅ |
| 5 | Home ADMIN (connector) | ✅ |
| 6 | Home SUPERVISOR (connector) | ⚠️ strutturale (no SUPERVISOR in seed SQL) |
| 7 | Home OPERATOR (connector) | ✅ totali=204 |
| 8 | Tenant isolation demo↔alfa | ✅ |
| 9 | 10.000 pratiche (demo) | ✅ |
| 10 | Benchmark round-trip | ✅ vedi §7 |
| 11 | Nessun `prisma.pratica` in Home KPI path | ✅ |

---

## 10. Problemi residui

1. **Seed SQL** usa role `OPERATORE` — query SQL accettano anche `OPERATORE` oltre a `OPERATOR`.
2. **Firestore fallback admin** — widget carico/esiti/grafico 6 mesi non replicati in `firestoreHomeKpi.ts` (solo path connector completo).
3. **Cambio codice giorno** — logica audit semplificata in SQL vs `applicaCambiCodicePerOperatore` Firestore.
4. **SUPERVISOR in seed** — assente; test supervisor strutturale only.
5. **Connettore** — va riavviato dopo deploy (`npm run start` in `connector/`).

---

## 11. Completamento

| Area | % |
|------|---|
| Contratto + repository | 100% |
| Endpoint + SQL bundle | 100% |
| Refactor `page.tsx` data layer | 100% |
| Performance (1 round-trip, aggregazioni) | 100% |
| Test + benchmark | 95% |
| Parità Firestore fallback admin | 70% |

**Completamento effettivo FASE F: ~95%**

Miglioramento architetturale e prestazionale **verificato** — non semplice swap Prisma→SQL equivalente, ma bundle aggregato con riduzione drastica di round-trip e full scan.

---

## 12. Prossimi passi (non avviati — FASE G)

- Completare parità Firestore fallback admin widgets
- Migration indici dashboard se profiling >100k pratiche
- Write-path sync `ImportoTotale`/`TotIncassato` audit
- DashboardKpi materialized aggregates (optional, se necessario sotto 500k)
