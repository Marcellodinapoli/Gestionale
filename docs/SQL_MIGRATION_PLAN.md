# Piano migrazione Credixa — Firestore → SQL Server via Connettore

**Stato:** FASE A completata · FASE B in corso · FASE C–K da eseguire  
**Audit:** [`database/scripts/migration-audit.md`](../database/scripts/migration-audit.md)  
**Generato:** 2026-08-29

---

## Obiettivo

Portare il gestionale operativo da `prisma → firebasePrisma → Firestore` a:

```text
Next.js (Credixa) → Repository → ConnectorClient → Connettore → SQL Server (CredixaDev)
```

Firestore resta solo per **Formazione** e moduli Firebase espliciti.

---

## Metriche audit (baseline)

| Metrica | Valore |
|---------|--------|
| File con `prisma.*` | 75 |
| Chiamate `prisma.*` | ~392 |
| Tabelle SQL CredixaDev | 26 |
| Endpoint Connettore (iniziali) | 6 |
| Endpoint Connettore (post FASE B auth) | 12 |

---

## Fasi di migrazione

### FASE A — Audit ✅

- [x] Scansione `prisma.*` / Firestore diretto
- [x] Inventario tabelle SQL vs utilizzo app
- [x] Inventario endpoint Connettore
- [x] `database/scripts/migration-audit.md`
- [x] `docs/SQL_MIGRATION_PLAN.md` (questo documento)

### FASE B — Repository + Connettore (in corso)

- [x] `ConnectorClient.ts` — client HTTP server-side
- [x] `factory.ts` — `getPraticheRepository()`, `getUsersRepository()`, …
- [x] Endpoint auth interni Connettore (tenant, user, session, login, postazione)
- [x] `operationalAccess.ts` — bridge auth/login Firestore ↔ Connector
- [x] Migrazione `loginCore.ts` + `auth.ts` (sessione)
- [ ] Endpoint Connettore per tutti i domini (vedi tabella sotto)
- [ ] Test automatici repository + tenant isolation
- [ ] `DATABASE_PROVIDER=connector` in `.env` locale (opt-in fino a FASE C)

### FASE C — Pratiche (~105 chiamate)

**File principali:** `src/actions/core.ts`, `src/app/(app)/pratiche/**`, `src/lib/domain.ts`

| Endpoint | Metodo | Stato |
|----------|--------|-------|
| `/api/v1/tenants/:tenantId/pratiche/:id` | GET | ✅ |
| `/api/v1/tenants/:tenantId/pratiche/search` | POST | ✅ |
| `/api/v1/tenants/:tenantId/pratiche` | POST | ⬜ |
| `/api/v1/tenants/:tenantId/pratiche/:id` | PATCH | ⬜ |
| `/api/v1/tenants/:tenantId/pratiche/:id/stato` | PATCH | ⬜ |
| `/api/v1/tenants/:tenantId/pratiche/:id/assegna` | POST | ⬜ |

### FASE D — Debitori / Mandanti / Garanti / Recapiti

| Dominio | Chiamate prisma | Repository |
|---------|-----------------|------------|
| Debitori | ~9 | `ConnectorDebitoriRepository` |
| Mandanti | ~23 | `ConnectorMandantiRepository` |
| Garanti | ~6 | `ConnectorGarantiRepository` |
| Recapiti | ~18 | `ConnectorRecapitiRepository` |

### FASE E — Incassi / Attività / Rate (~26 chiamate)

- Incassi: create, list by pratica, aggregate
- Attività: CRUD + groupBy → SQL GROUP BY
- Piano rate: list by pratica

### FASE F — Dashboard (~30 chiamate su Home)

- Sostituire aggregate/groupBy Firestore con `DashboardRepository.getHome()`
- Endpoint: `GET /api/v1/tenants/:tenantId/dashboard/home` ✅ (base)
- Popolare/aggiornare `DashboardKpi` o query aggregate indicizzate
- Target: Home TTFB < 500 ms

### FASE G — Lock + Realtime

- Lock SQL transazionale (`PraticheLock`, TTL 45s, heartbeat 30s) ✅ (base)
- Rimuovere polling browser 15s → `RealtimeService` (SSE + fallback)
- Lazy cleanup lock (no purge globale su ogni GET)

### FASE H — Agenda / Memo / Messaggi

- `memoAgenda.ts`, `messaggioInterno`, polling 20s → SSE/polling fallback

### FASE I — Import / Audit / Configurazione

- `importBatch.ts` (27 chiamate), audit, config sistema

### FASE J — Resto

- Sedi, postazioni, utenti admin, provvigioni, registrazioni, documenti, fatture

### FASE K — Cleanup

- Zero `prisma.*` operativo con `DATABASE_PROVIDER=connector`
- Deprecare `firebasePrisma.ts` (non eliminare finché test PASS)
- Benchmark comparativo Firestore vs SQL

---

## Ordine priorità file (per impatto)

1. `src/actions/core.ts` — 91 chiamate
2. `src/app/(app)/page.tsx` — 30 (dashboard)
3. `src/actions/importBatch.ts` — 27
4. `src/actions/operatoriAdmin.ts` — 16
5. `src/lib/praticaLock.ts` — 9
6. … (vedi audit completo)

---

## Regole non negoziabili

1. **Nessun SQL dal browser** — vietato `POST /query`
2. **TenantId dalla sessione** — mai fidarsi del client
3. **Query parametrizzate** — sempre `@tenantId`, `@id`, …
4. **Comportamento equivalente** — stesso input → stesso output UI
5. **No big-bang** — dominio per dominio con test
6. **No cancellazioni** — Firestore e `firebasePrisma.ts` restano fino a verifica

---

## Variabili ambiente

```env
DATABASE_PROVIDER=connector          # firestore | connector
CONNECTOR_BASE_URL=http://localhost:8443
CONNECTOR_API_KEY=                 # opzionale in dev
```

Produzione futura: `CONNECTOR_BASE_URL=https://connettore-cliente.azienda.it`

---

## Test obbligatori (per completamento)

- [ ] CRUD pratiche, incassi, attività
- [ ] Tenant isolation: `demo` ≠ `alfa` (pratiche, incassi, dashboard, utenti, lock, ricerca)
- [ ] Lock concorrente (due operatori, stessa pratica)
- [ ] Auth/login con SQL
- [ ] Connettore down / SQL down → error handling
- [ ] Formazione ancora su Firestore
- [ ] Benchmark scenari (Home, lista, ricerca, lock)

---

## Criterio completamento (checklist §25)

Vedi requisiti utente — tutti ⬜ fino a FASE K.

---

## Prossimo dominio

**FASE C — Pratiche:** espandere endpoint Connettore + sostituire `core.ts` e pagine pratiche.
