# FASE J — Report di completamento

**Data:** 2026-08-30  
**Scope:** Sedi, Postazioni, Utenti, Configurazione, Provvigioni (+ Home KPI), Registrazioni, Fatture/Documenti/PianoRate, Garanti  
**Stato:** ✅ Completata (domini J al 100%; FASE K non avviata)

---

## Riepilogo esecutivo

Tutti i domini del perimetro FASE J seguono il pattern Repository Contract:

```text
Next.js → *Repo.ts (facade) → Connector*Repository | Prisma*Repository → Connector :8443 → SQL Server
                                                              ↘ prisma (DATABASE_PROVIDER=firestore)
```

- **`DATABASE_PROVIDER=connector`** → nessuna chiamata operativa diretta `prisma.{sede|postazione|user|configurazione|provvigione|registrazione|fattura|documento|pianoRata|garante*}` nei percorsi app/actions/pages del perimetro J.
- **`DATABASE_PROVIDER=firestore`** → fallback Prisma invariato tramite facade e `Prisma*Repository`.
- **`firebasePrisma.ts`** → non eliminato (come richiesto).
- **FASE K** → non avviata.

---

## Audit chiamate Prisma (perimetro FASE J)

| Dominio | Chiamate iniziali (stima audit) | Migrate | Residue operative | Motivo residue |
|---------|--------------------------------|---------|-------------------|----------------|
| **J1 Sedi** | ~19 | 19 | 0 | — |
| **J2 Postazioni** | ~17 | 17 | 0 | — |
| **J3 Utenti** | ~45 | 45 | 0 | — |
| **J7 Configurazione** | ~7 | 7 | 0 | — |
| **J4 Provvigioni** | ~15 | 15 | 0 | Home KPI connector usa `ConnectorDashboardRepository` (FASE F); firestore usa `provvigioniDb` |
| **J5 Registrazioni** | ~4 | 4 | 0 | — |
| **J6 Fatture/Doc/PianoRate** | ~7 | 7 | 0 | — |
| **Garanti** | ~10 | 10 | 0 | Cascade import-batch migrato a `garantiRepo` |
| **Totale J** | **~124** | **~124** | **0** | |

### Residue attese (non operative / fuori perimetro J)

| File | Modello | Motivo |
|------|---------|--------|
| `*Repo.ts` (sedi, postazioni, users, …) | vari | Passthrough `prisma.*` quando `DATABASE_PROVIDER=firestore` |
| `src/lib/data/prisma/Prisma*Repository.ts` | vari | Implementazione fallback Firestore |
| `operationalAccess.ts` | tenant, user | Branch auth Firestore (branch connector già presente) |
| `passwordPolicy.ts` | user, passwordHistory | `passwordHistory` non in scope J; parziale usersDb |
| `firestoreHomeKpi.ts` | pratica | Solo path Firestore (`loadHomeKpi` → connector dashboard in modalità connector) |
| `statistiche/page.tsx`, `affidi/page.tsx` | pratica | Domini pratiche (FASE C); fuori perimetro J |
| `PrismaAuditRepository.ts` | user, auditLog | Audit già migrato FASE I; lookup nome utente su Firestore |

---

## Endpoint Connector creati (FASE J)

Base: `/api/v1/tenants/:tenantId/…`

| Dominio | Route | Metodi |
|---------|-------|--------|
| **Sedi** | `/sedi` | `POST /list`, `POST /count`, `GET /:id`, `POST /`, `PATCH /:id` |
| **Postazioni** | `/postazioni` | `POST /list`, `POST /count`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| **Utenti (admin)** | `/users` | `POST /list`, `POST /count`, `GET /:id`, `POST /by-email`, `POST /`, `PATCH /:id`, `POST /update-many` |
| **Configurazione** | `/configurazione` | `POST /list`, `GET /:chiave`, `POST /upsert`, `POST /delete-many` |
| **Provvigioni** | `/provvigioni` | `POST /list`, `POST /aggregate`, `POST /group-by`, `PATCH /:id`, `POST /update-many`, `POST /delete-many` |
| **Registrazioni** | `/registrazioni` | `POST /list`, `POST /find-first`, `POST /`, `POST /delete-many` |
| **Fatture** | `/fatture` | `POST /`, `POST /delete-many` |
| **Documenti** | `/documenti` | `POST /`, `POST /delete-many` |
| **Piano rate** | `/piano-rate` | `POST /`, `POST /create-many`, `POST /delete-many` |
| **Garanti** | `/garanti` | `GET /find-first`, `GET /ids-by-cf`, `PATCH /:id`, recapito CRUD, `DELETE /by-pratica/:praticaId` |

Endpoint auth interni preesistenti (`/api/v1/internal/users/*`, `/internal/postazioni/:id`) restano per bootstrap sessione.

---

## Migration SQL

| File | Contenuto |
|------|-----------|
| `database/migrations/010_postazioni_indexes.sql` | Indici su `Postazioni` (TenantId+Active, SedeId, lookup occupante) |

Le tabelle `Sedi`, `Users`, `ConfigurazioneSistema`, `Provvigioni`, `RegistrazioniChiamata`, `Fatture`, `Documenti`, `PianoRate`, `Garanti`, `GaranteRecapiti` erano già presenti in `001_initial_schema.sql`.

---

## File principali creati

### Contracts
- `src/lib/data/contracts/sedi.ts`
- `src/lib/data/contracts/postazioni.ts`
- `src/lib/data/contracts/users.ts`
- `src/lib/data/contracts/configurazione.ts`
- `src/lib/data/contracts/provvigioni.ts`
- `src/lib/data/contracts/registrazioni.ts`
- `src/lib/data/contracts/fatture.ts`, `documenti.ts`, `pianoRate.ts`, `garanti.ts`

### App facades
- `src/lib/sediRepo.ts`
- `src/lib/postazioniRepo.ts`
- `src/lib/usersRepo.ts`
- `src/lib/configurazioneRepo.ts`
- `src/lib/provvigioniRepo.ts`
- `src/lib/registrazioniRepo.ts`
- `src/lib/fattureRepo.ts`, `documentiRepo.ts`, `pianoRateRepo.ts`, `garantiRepo.ts`

### Connector
- `connector/src/services/sediService.ts`, `postazioniService.ts`, `usersAdminService.ts`, `configurazioneService.ts`, `provvigioniService.ts`, `registrazioniService.ts`, `praticaContabileService.ts`, `garantiService.ts`
- `connector/src/routes/sedi.ts`, `postazioni.ts`, `users.ts`, `configurazione.ts`, `provvigioni.ts`, `registrazioni.ts`, `praticaContabile.ts`, `garanti.ts`

---

## Test effettuati

| Test | Risultato |
|------|-----------|
| `npx tsc --noEmit` (app) | ✅ PASS |
| `npx tsc --noEmit` (connector) | ✅ PASS |
| `npm run build` | ✅ PASS |
| `node database/scripts/test-phase-j-crud.mjs` | ✅ PASS (sedi, postazioni, configurazione CRUD + tenant isolation demo↔alfa) |
| Connector riavviato su `:8443` | ✅ (necessario dopo deploy route) |

### Test CRUD eseguiti (connector)
1. Creazione sede demo → PATCH → list con filtro id
2. Creazione postazione collegata alla sede
3. Upsert configurazione tenant
4. Verifica che sede demo **non** compaia nel tenant `alfa`

---

## Home KPI e Provvigioni (J4)

- **`DATABASE_PROVIDER=connector`:** `loadHomeKpi` → `ConnectorDashboardRepository.getHomeKpi()` (SQL aggregate, nessun Prisma aggiuntivo in Home).
- **`DATABASE_PROVIDER=firestore`:** `firestoreHomeKpi.ts` usa `provvigioniDbFromUser`, `sediDbFromUser`, `usersDbFromUser`, `mandantiDbFromUser` per aggregati provvigioni; restano chiamate `prisma.pratica.*` solo nel path Firestore (pratiche = FASE C).

---

## Garanti

- CRUD garante + recapiti via `garantiRepo` / `garanteRecapitoDb`
- Lookup CF via connector SQL
- Cascade delete import-batch: `PrismaImportBatchRepository` usa `deleteGarantiByPratica()` dal repo (no `prisma.garante*` in connector mode)
- Zero chiamate operative `prisma.garante*` nel percorso connector

---

## Risultati build

```
tsc (app):      exit 0
tsc (connector): exit 0
npm run build:  exit 0 — Next.js 16.3.1, 51 route generate
```

---

## Percentuale completamento

| Metrica | Valore |
|---------|--------|
| **Domini FASE J migrati** | 8 / 8 = **100%** |
| **Chiamate Prisma perimetro J migrate** | ~124 / ~124 = **100%** |
| **Chiamate operative residue perimetro J (connector mode)** | **0** |
| **FASE K (cleanup globale prisma)** | **0%** — non avviata (voluto) |
| **Completamento globale migrazione SQL (tutte le fasi A–J)** | ~**92%** (stimato: restano pratiche cross-page, agenda, lock firestore, passwordHistory, formazione, script seed) |

---

## Operazioni post-deploy

1. **Riavviare il Connector** dopo ogni aggiornamento route (`npm run dev` in `connector/`)
2. Applicare migration `010_postazioni_indexes.sql` su CredixaDev se non già applicata
3. Verificare `.env`: `DATABASE_PROVIDER=connector`, `CONNECTOR_BASE_URL=http://localhost:8443`

---

## Prossimi passi (FASE K — non avviata)

- Eliminare chiamate `prisma.*` residue fuori fallback (statistiche/affidi pratica, passwordHistory, agenda firestore-only paths)
- Benchmark comparativo Firestore vs SQL
- Deprecare `firebasePrisma.ts` dopo test E2E completi
