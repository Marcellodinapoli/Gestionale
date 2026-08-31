# FASE I — Report finale (chiusura)

**Data:** 2026-08-30  
**Stato:** ✅ Completata (**~98%**)  
**Prossima fase:** **FASE J** (domini residui fuori Import/Audit — es. configurazione amministrativa, entità satellite delete import, altri moduli ancora su Prisma diretto)

---

## Correzioni applicate in chiusura

| # | Intervento | Esito |
|---|-----------|-------|
| 1 | Migration `009_import_batch_indexes.sql` | ✅ Applicata (`npm run db:migrate:sql`) |
| 2 | Delete cascade import in modalità connector | ✅ `deletePraticaForImport` → Connector SQL transazionale; `importBatch.ts` senza Prisma |
| 3 | `appendAudit` senza lookup Prisma diretto | ✅ `findTenantById` / `findUserAuditContext` via Database Contract (`operationalAccess` + endpoint internal Connector) |
| 4 | Benchmark 50.000 pratiche | ✅ 50.489 ms · **990 rec/s** (chunk 500) |
| 5 | E2E `DATABASE_PROVIDER=firestore` | ✅ `test-phase-i-e2e.mjs firestore` |
| 6 | E2E `DATABASE_PROVIDER=connector` | ✅ `test-phase-i-e2e.mjs connector` |
| 7 | Verifica Prisma residue path FASE I | ✅ Nessuna chiamata operativa diretta fuori repository/fallback |
| 9 | Connector riavviato | ✅ `/health` → 200 |

---

## Test eseguiti e risultati

| Test | Risultato |
|------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run build` | ✅ |
| `test-phase-i-import-audit.mjs` | ✅ (CRUD, chunk, audit, isolation, rollback) |
| Benchmark 1k / 10k / **50k** | ✅ 871 / 1203 / **990 rec/s** |
| `test-phase-i-e2e.mjs firestore` | ✅ import 2 pratiche + audit userId-only |
| `test-phase-i-e2e.mjs connector` | ✅ import 2 pratiche + audit userId-only |

---

## Endpoint Connector aggiunti in chiusura

| Metodo | Path | Funzione |
|--------|------|----------|
| DELETE | `/import-batch/pratica/:praticaId` | Delete cascade import (Provvigioni + Pratica, FK CASCADE resto) |
| GET | `/internal/tenants/:tenantId` | Lookup tenant per audit context |
| GET | `/internal/users/:userId/audit-context` | Risolve tenantId + slug da userId |

---

## Chiamate Prisma residue (attese)

| Ubicazione | Perché restano |
|------------|----------------|
| `PrismaImportBatchRepository.ts` | Fallback `DATABASE_PROVIDER=firestore` |
| `PrismaAuditRepository.ts` | Fallback firestore |
| `PrismaImportBatchRepository.deletePraticaForImport` | Cascade delete solo in modalità firestore |
| `operationalAccess.findTenantById` / `findUserAuditContext` | Fallback firestore (connector usa repo HTTP) |
| `statisticheGruppo.ts` → `prisma.pratica` | Dominio Pratiche/statistiche, fuori scope FASE I |
| Script dev (`seed`, `wipe`) | Manutenzione dati test |

**Path FASE I operativi (`importBatch.ts`, `auditRepo.ts`, `domain.writeAudit`, pagine log/import/statistiche/lavorazione):** nessun `prisma.importBatch` / `prisma.auditLog` diretto.

---

## Architettura finale FASE I

```
DATABASE_PROVIDER=connector
  Import/Audit/Delete-import → *Repo → Connector :8443 → SQL CredixaDev

DATABASE_PROVIDER=firestore
  Import/Audit/Delete-import → Prisma*Repository → Firestore/Prisma shim
```

Chunk import connector: **500 righe/chunk**, 1 transazione SQL/chunk, allocazione numeri pratica in tx (`UPDLOCK`).

---

## Completamento: **~98%**

Residuo minore: delete cascade firestore resta in `PrismaImportBatchRepository` (by design); nessun blocco per avvio FASE J.
