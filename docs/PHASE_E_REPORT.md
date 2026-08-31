# FASE E — Report migrazione Incassi e Attività

**Data:** 2026-08-30  
**Stato:** ✅ **COMPLETA** (100% dominio operativo Incassi/Attività)

---

## Obiettivo

```
DATABASE_PROVIDER=connector
Credixa → incassiDb / attivitaDb → Repository → Connettore :8443 → SQL Server CredixaDev

DATABASE_PROVIDER=firestore (default)
→ fallback invariato su prisma.incasso / prisma.attivita
```

---

## Chiamate Prisma iniziali (src/ operativo)

| Dominio | Chiamate | File principali |
|---------|----------|-----------------|
| `prisma.incasso.*` | **9** | `page.tsx`, `importBatch.ts`, `pratiche/[id]/page.tsx`, `core.ts`, `PrismaPraticheRepository` |
| `prisma.attivita.*` | **16** | `core.ts`, `page.tsx`, `importBatch.ts`, `lavorateOggi.ts` |
| **Totale** | **25** | |

*Esclusi script seed/baseline/wipe (non operativi in produzione).*

---

## Chiamate migrate

| Dominio | Migrate | Dettaglio |
|---------|---------|-----------|
| `incasso` | **8** | KPI home, import batch, scheda pratica, registrazione incasso transazionale |
| `attivita` | **16** | CRUD note/lavorazioni, toggle fissa, KPI produttività, lavorate oggi, import cascade |
| **Totale** | **24** | |

> `PrismaPraticheRepository.idsTotIncassato` (1× `incasso.findMany`) resta come **fallback firestore intenzionale** — in modalità connector usa già `ConnectorPraticheRepository` → `/ids-tot-incassato`.

---

## Chiamate residue (solo perimetro previsto)

| File | Motivo |
|------|--------|
| `src/lib/incassiRepo.ts` | Drop-in → `prisma.incasso` se `firestore` |
| `src/lib/attivitaRepo.ts` | Drop-in → `prisma.attivita` se `firestore` |
| `src/lib/data/prisma/PrismaIncassiRepository.ts` | Implementazione fallback |
| `src/lib/data/prisma/PrismaAttivitaRepository.ts` | Implementazione fallback |
| `src/lib/data/prisma/PrismaPraticheRepository.ts` | 1× `incasso.findMany` fallback firestore |

**Chiamate operative residue fuori repo layer: 0**

---

## Migration SQL

**Nessuna migration necessaria.**  
Tabelle `Incassi` e `Attivita` già presenti in `002_operational_tables.sql` con FK, colonne e indici (`005_indexes.sql`).

---

## Endpoint Connettore creati

### Incassi — `/api/v1/tenants/:tenantId/incassi`

| Metodo | Path | Descrizione |
|--------|------|-------------|
| POST | `/list` | Lista con filtri (pratica, date, mandante, sede, user) |
| POST | `/count` | Conteggio |
| POST | `/aggregate` | SUM importo/capitale/interessi/spese |
| POST | `/group-by-metodo` | Aggregazione per metodo pagamento |
| POST | `/registra` | **Transaction SQL**: incasso + provvigione + update pratica |
| GET | `/:id` | Dettaglio (404 cross-tenant) |

### Attività — `/api/v1/tenants/:tenantId/attivita`

| Metodo | Path | Descrizione |
|--------|------|-------------|
| POST | `/list` | Lista con filtri (pratica, user, ruolo, date) + include user |
| POST | `/count` | Conteggio |
| POST | `/group-by-user` | Produttività operatori (KPI home) |
| POST | `/` | Creazione |
| PATCH | `/:id` | Modifica nota/flags |
| POST | `/update-many` | Update bulk (es. unfissate) |
| POST | `/delete-many` | Delete bulk per pratica (import cascade) |
| POST | `/toggle-fissa` | Transaction: unfissate tutte + fissa una |
| GET | `/:id` | Dettaglio (404 cross-tenant) |

---

## Architettura app

| Layer | File |
|-------|------|
| Contratti | `src/lib/data/contracts/incassi.ts`, `attivita.ts` |
| Connector repo | `ConnectorIncassiRepository.ts`, `ConnectorAttivitaRepository.ts` |
| Prisma repo | `PrismaIncassiRepository.ts`, `PrismaAttivitaRepository.ts` |
| Drop-in | `src/lib/incassiRepo.ts`, `src/lib/attivitaRepo.ts` |
| Connector services | `connector/src/services/incassiService.ts`, `attivitaService.ts` |
| Connector routes | `connector/src/routes/incassi.ts`, `attivita.ts` |

### Funzioni export aggiuntive

- `registraIncassoWithSideEffects()` — incasso + provvigione + update pratica (firestore e connector)
- `toggleFissaAttivita()` — toggle fissa atomico

---

## File modificati (call-site)

| File | Modifiche |
|------|-----------|
| `src/actions/core.ts` | `attivitaModel()`, `registraIncassoWithSideEffects`, toggle fissa |
| `src/app/(app)/page.tsx` | KPI incassi + produttività attività |
| `src/app/(app)/pratiche/[id]/page.tsx` | aggregate incassi pagato |
| `src/actions/importBatch.ts` | count incassi, deleteMany attività |
| `src/lib/lavorateOggi.ts` | findMany attività via scope pratica IDs |
| `connector/src/server.ts` | Registrazione route |

---

## Test eseguiti

| Test | Esito |
|------|-------|
| `npx tsc --noEmit` | ✅ |
| `npm run build` | ✅ |
| `node database/scripts/test-phase-e-incassi-attivita.mjs` | ✅ |
| Incassi count/aggregate/groupBy/list | ✅ |
| Attività CRUD + list + groupBy + toggle-fissa | ✅ |
| Relazione Pratica → Incassi (list per praticaId) | ✅ |
| Relazione Pratica → Attività (create/list per praticaId) | ✅ |
| Tenant isolation demo ↔ alfa (attivita GET 404) | ✅ |
| `POST /incassi/registra` transaction SQL | ✅ |
| Connettore riavviato su `:8443` | ✅ |

### Test manuali consigliati (non eseguiti in CI)

- Login UI demo → scheda pratica → aggiungi nota
- Registra incasso da UI → verifica residuo pratica e provvigione
- Dashboard ADMIN → widget incassi per metodo
- `DATABASE_PROVIDER=firestore` → stessi flussi UI

---

## Completamento

| Metrica | Valore |
|---------|--------|
| Chiamate iniziali (operativo src/) | 25 |
| Migrate | 24 (+ 1 già su ConnectorPraticheRepository) |
| Residue operative | **0** |
| **Completamento FASE E** | **100%** |

---

## Problemi aperti

1. **Provvigioni** — create solo dentro `registraIncasso` (transaction); dominio Provvigioni resta su Prisma (FASE successiva).
2. **Attività nested `pratica` filter** — `lavorateOggi.ts` risolve prima gli ID pratica visibili, poi filtra `praticaId IN (...)` (equivalente semantico, performante su SQL).
3. **E2E UI** — non automatizzati; consigliato smoke test manuale post-deploy.
4. **Script seed/baseline** — ancora su Prisma diretto (non in scope FASE E).

---

## Prossimi passi (NON FASE E)

- **FASE F** — residui Home/KPI `prisma.pratica`
- **Provvigioni** — migrazione dominio completo
- **Audit log / Agenda** — per FASE H

**FASE E dichiarata completa.** Non procedere a FASE F senza conferma.
