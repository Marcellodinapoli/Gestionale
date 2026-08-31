# Migration Audit — Credixa Firestore → SQL Connector

Generato: 2026-08-29T19:32:10.049Z

## Riepilogo

| Metrica | Valore |
|---------|--------|
| File con chiamate `prisma.*` (escl. adapter) | **75** |
| Chiamate `prisma.*` totali (stima) | **~392** |
| Riferimenti Firestore diretti (non formazione) | **12** |
| Tabelle SQL CredixaDev | **26** |
| Endpoint Connettore attuali | **6** |

## Chiamate per modello Prisma

| Modello | Chiamate | Dominio | Repository | Stato |
|---------|----------|---------|------------|-------|
| `pratica` | 105 | Pratiche | `ConnectorPraticheRepository` | ⬜ da migrare |
| `user` | 81 | Utenti | `ConnectorUtentiRepository` | ⬜ da migrare |
| `mandante` | 23 | Mandanti | `ConnectorMandantiRepository` | ⬜ da migrare |
| `sede` | 21 | Sedi | `ConnectorSediRepository` | ⬜ da migrare |
| `importBatch` | 17 | Import/Affidi | `ConnectorImportAffidiRepository` | ⬜ da migrare |
| `attivita` | 15 | Attivita | `ConnectorAttivitaRepository` | ⬜ da migrare |
| `postazione` | 14 | Postazioni | `ConnectorPostazioniRepository` | ⬜ da migrare |
| `provvigione` | 14 | Provvigioni | `ConnectorProvvigioniRepository` | ⬜ da migrare |
| `messaggioInterno` | 11 | Messaggi | `ConnectorMessaggiRepository` | ⬜ da migrare |
| `praticaLock` | 11 | Lock | `ConnectorLockRepository` | ⬜ da migrare |
| `debitore` | 9 | Debitori | `ConnectorDebitoriRepository` | ⬜ da migrare |
| `debitoreRecapito` | 9 | Recapiti | `ConnectorRecapitiRepository` | ⬜ da migrare |
| `garanteRecapito` | 9 | Recapiti | `ConnectorRecapitiRepository` | ⬜ da migrare |
| `incasso` | 8 | Incassi | `ConnectorIncassiRepository` | ⬜ da migrare |
| `messaggioAgenda` | 8 | Agenda/Memo | `ConnectorAgendaMemoRepository` | ⬜ da migrare |
| `configurazioneSistema` | 7 | Configurazione | `ConnectorConfigurazioneRepository` | ⬜ da migrare |
| `garante` | 6 | Garanti | `ConnectorGarantiRepository` | ⬜ da migrare |
| `impegnoAgenda` | 6 | Agenda | `ConnectorAgendaRepository` | ⬜ da migrare |
| `auditLog` | 5 | Audit | `ConnectorAuditRepository` | ⬜ da migrare |
| `registrazioneChiamata` | 4 | Registrazioni | `ConnectorRegistrazioniRepository` | ⬜ da migrare |
| `pianoRata` | 3 | PianoRate | `ConnectorPianoRateRepository` | ⬜ da migrare |
| `fattura` | 2 | Fatture | `ConnectorFattureRepository` | ⬜ da migrare |
| `documento` | 2 | Documenti | `ConnectorDocumentiRepository` | ⬜ da migrare |
| `tenant` | 1 | Tenant/Auth | `ConnectorTenantAuthRepository` | ⬜ da migrare |
| `passwordHistory` | 1 | Auth | `ConnectorAuthRepository` | ⬜ da migrare |

## Chiamate per operazione

| Operazione | Count | Note migrazione |
|------------|-------|-----------------|
| `findMany` | 111 |  |
| `update` | 66 |  |
| `findFirst` | 58 |  |
| `findUnique` | 50 |  |
| `create` | 29 |  |
| `count` | 24 |  |
| `deleteMany` | 19 |  |
| `delete` | 10 |  |
| `aggregate` | 9 | ⚠️ full-scan Firestore → SQL aggregato/KPI |
| `groupBy` | 8 | ⚠️ full-scan Firestore → SQL aggregato/KPI |
| `updateMany` | 6 |  |
| `createMany` | 1 |  |
| `upsert` | 1 |  |

## Rollup per dominio funzionale

- **Pratiche**: ~105 chiamate prisma
- **Utenti**: ~81 chiamate prisma
- **Mandanti**: ~23 chiamate prisma
- **Sedi**: ~21 chiamate prisma
- **Recapiti**: ~18 chiamate prisma
- **Import/Affidi**: ~17 chiamate prisma
- **Attivita**: ~15 chiamate prisma
- **Postazioni**: ~14 chiamate prisma
- **Provvigioni**: ~14 chiamate prisma
- **Messaggi**: ~11 chiamate prisma
- **Lock**: ~11 chiamate prisma
- **Debitori**: ~9 chiamate prisma
- **Incassi**: ~8 chiamate prisma
- **Agenda/Memo**: ~8 chiamate prisma
- **Configurazione**: ~7 chiamate prisma
- **Garanti**: ~6 chiamate prisma
- **Agenda**: ~6 chiamate prisma
- **Audit**: ~5 chiamate prisma
- **Registrazioni**: ~4 chiamate prisma
- **PianoRate**: ~3 chiamate prisma
- **Fatture**: ~2 chiamate prisma
- **Documenti**: ~2 chiamate prisma
- **Tenant/Auth**: ~1 chiamate prisma
- **Auth**: ~1 chiamate prisma

## Endpoint Connettore — stato

### Implementati
- ✅ GET /health
- ✅ GET /health/db
- ✅ GET /api/v1/tenants/:tenantId/pratiche/:id
- ✅ POST /api/v1/tenants/:tenantId/pratiche/search
- ✅ GET /api/v1/tenants/:tenantId/dashboard/home
- ✅ GET|POST|DELETE /api/v1/tenants/:tenantId/pratiche/:id/lock

### Da implementare (minimo)
- ⬜ POST /api/v1/tenants/:tenantId/pratiche (create)
- ⬜ PATCH /api/v1/tenants/:tenantId/pratiche/:id
- ⬜ GET /api/v1/tenants/:tenantId/debitori/:id
- ⬜ GET /api/v1/tenants/:tenantId/mandanti
- ⬜ GET /api/v1/tenants/:tenantId/incassi (search/by pratica)
- ⬜ POST /api/v1/tenants/:tenantId/incassi
- ⬜ GET|POST /api/v1/tenants/:tenantId/attivita
- ⬜ GET /api/v1/tenants/:tenantId/users
- ⬜ GET /api/v1/tenants/:tenantId/agenda/memo
- ⬜ GET /api/v1/tenants/:tenantId/agenda/impegni
- ⬜ GET|POST /api/v1/tenants/:tenantId/messaggi
- ⬜ GET|POST /api/v1/tenants/:tenantId/import/batches
- ⬜ GET|PUT /api/v1/tenants/:tenantId/config
- ⬜ POST /api/v1/tenants/:tenantId/audit
- ⬜ GET /api/v1/tenants/:tenantId/garanti/by-pratica/:praticaId
- ⬜ GET /api/v1/tenants/:tenantId/rate/by-pratica/:praticaId
- ⬜ GET /api/v1/tenants/:tenantId/sedi
- ⬜ GET /api/v1/tenants/:tenantId/postazioni
- ⬜ GET /api/v1/tenants/:tenantId/provvigioni

## File coinvolti (ordinati per impatto)

| File | Tipo | prisma | Firestore | Modelli principali |
|------|------|--------|-----------|-------------------|
| `src/actions/core.ts` | actions | 91 | 0 | pratica(32), attivita(12), debitoreRecapito(8) |
| `src/app/(app)/page.tsx` | pages | 30 | 0 | pratica(11), user(6), mandante(4) |
| `src/actions/importBatch.ts` | actions | 27 | 0 | pratica(6), importBatch(5), incasso(2) |
| `src/actions/operatoriAdmin.ts` | actions | 16 | 0 | user(14), sede(2) |
| `src/actions/postazione.ts` | actions | 15 | 0 | postazione(9), user(4), sede(2) |
| `src/app/(app)/provigioni/page.tsx` | pages | 13 | 0 | provvigione(8), user(3), sede(1) |
| `src/lib/importPraticheBatch.ts` | lib | 12 | 0 | pratica(5), importBatch(5), debitore(2) |
| `src/actions/sedi.ts` | actions | 10 | 0 | sede(9), user(1) |
| `src/lib/domain.ts` | lib | 10 | 0 | pratica(5), debitore(2), garante(1) |
| `src/lib/praticaLock.ts` | lib | 9 | 0 | praticaLock(9) |
| `src/actions/gruppoOperatori.ts` | actions | 8 | 0 | user(7), mandante(1) |
| `src/app/(app)/statistiche/page.tsx` | pages | 8 | 0 | user(4), sede(1), mandante(1) |
| `src/actions/assignPratica.ts` | actions | 7 | 0 | pratica(5), user(2) |
| `src/app/(app)/affidi/page.tsx` | pages | 7 | 0 | user(5), mandante(1), pratica(1) |
| `src/lib/lavorateOggi.ts` | lib | 7 | 0 | pratica(3), auditLog(3), attivita(1) |
| `src/app/(app)/lavorazione/page.tsx` | pages | 6 | 0 | user(3), mandante(1), pratica(1) |
| `src/lib/loginCore.ts` | lib | 6 | 0 | user(4), tenant(1), postazione(1) |
| `src/app/(app)/pratiche/page.tsx` | pages | 5 | 0 | pratica(3), user(1), mandante(1) |
| `src/lib/lavorazioneSuggerita.ts` | lib | 5 | 0 | pratica(3), user(2) |
| `src/lib/memoAgenda.ts` | lib | 5 | 0 | messaggioAgenda(4), pratica(1) |
| `src/lib/passwordPolicy.ts` | lib | 5 | 0 | user(4), passwordHistory(1) |
| `src/lib/codiciMandantePerimetro.ts` | lib | 4 | 0 | pratica(3), mandante(1) |
| `src/lib/praticheAltriFiltri.ts` | lib | 4 | 0 | pratica(3), incasso(1) |
| `src/actions/agendaMessaggi.ts` | actions | 3 | 0 | messaggioAgenda(2), pratica(1) |
| `src/actions/configurazione.ts` | actions | 3 | 0 | configurazioneSistema(3) |
| `src/actions/impegnoAgenda.ts` | actions | 3 | 0 | impegnoAgenda(3) |
| `src/actions/provvigioniAdmin.ts` | actions | 3 | 0 | provvigione(3) |
| `src/app/(app)/operatori/page.tsx` | pages | 3 | 0 | user(2), sede(1) |
| `src/app/(app)/pratiche/[id]/page.tsx` | pages | 3 | 0 | pratica(2), incasso(1) |
| `src/app/api/memo-alerts/route.ts` | api | 3 | 0 | pratica(1), impegnoAgenda(1), messaggioInterno(1) |
| `src/lib/sanzioneIncassoMassivo.ts` | lib | 3 | 0 | pratica(1), praticaLock(1), messaggioInterno(1) |
| `src/actions/account.ts` | actions | 2 | 0 | user(2) |
| `src/actions/registrazioni.ts` | actions | 2 | 0 | pratica(1), registrazioneChiamata(1) |
| `src/app/(app)/account/page.tsx` | pages | 2 | 0 | user(1), postazione(1) |
| `src/app/(app)/agenda/page.tsx` | pages | 2 | 0 | pratica(1), impegnoAgenda(1) |
| `src/app/(app)/configurazione/page.tsx` | pages | 2 | 0 | configurazioneSistema(2) |
| `src/app/(app)/messaggi/page.tsx` | pages | 2 | 0 | messaggioAgenda(1), messaggioInterno(1) |
| `src/app/(app)/postazioni/page.tsx` | pages | 2 | 0 | postazione(1), sede(1) |
| `src/app/(app)/report/page.tsx` | pages | 2 | 0 | user(1), registrazioneChiamata(1) |
| `src/app/api/agenda-giorno/route.ts` | api | 2 | 0 | pratica(1), impegnoAgenda(1) |
| `src/app/api/lavorazione-conteggi/route.ts` | api | 2 | 0 | user(2) |
| `src/app/api/pratiche-cerca/route.ts` | api | 2 | 0 | pratica(2) |
| `src/lib/gruppoLavoro.ts` | lib | 2 | 0 | user(2) |
| `src/lib/praticheStessoDebitore.ts` | lib | 2 | 0 | pratica(2) |
| `src/lib/provvigioniPerimetro.ts` | lib | 2 | 0 | mandante(2) |
| `src/lib/registrazioniScope.ts` | lib | 2 | 0 | pratica(2) |
| `src/lib/statisticheGruppo.ts` | lib | 2 | 0 | pratica(1), importBatch(1) |
| `src/actions/lavorazioneSuggerita.ts` | actions | 1 | 0 | user(1) |
| `src/actions/privacyLock.ts` | actions | 1 | 0 | user(1) |
| `src/app/(app)/import/page.tsx` | pages | 1 | 0 | mandante(1) |
| `src/app/(app)/log/page.tsx` | pages | 1 | 0 | auditLog(1) |
| `src/app/(app)/mandanti/page.tsx` | pages | 1 | 0 | mandante(1) |
| `src/app/(app)/mandanti/[id]/page.tsx` | pages | 1 | 0 | mandante(1) |
| `src/app/(app)/pratiche/[id]/estratto/page.tsx` | pages | 1 | 0 | pratica(1) |
| `src/app/(app)/pratiche/[id]/fatture/page.tsx` | pages | 1 | 0 | pratica(1) |
| `src/app/(app)/pratiche/[id]/incassi/page.tsx` | pages | 1 | 0 | pratica(1) |
| `src/app/(app)/pratiche/[id]/stampa/page.tsx` | pages | 1 | 0 | pratica(1) |
| `src/app/(app)/rubrica/page.tsx` | pages | 1 | 0 | user(1) |
| `src/app/(app)/sedi/page.tsx` | pages | 1 | 0 | sede(1) |
| `src/app/api/pratiche/[id]/extra/route.ts` | api | 1 | 0 | pratica(1) |
| … | | | | +15 file |

## Moduli Firestore esclusi dalla migrazione operativa

- `src/lib/formazione/**` — Formazione (Firebase Auth + Firestore client)
- `src/components/formazione/**`
- `src/lib/firebase/firebasePrisma.ts` — adapter legacy (deprecare a fine migrazione)

## Gap schema SQL vs app

| Area | Gap | Azione |
|------|-----|--------|
| Mandanti | `PerimetriJson` vs struttura perimetri app | migration 006 se necessario |
| Users | `GruppoMandantiJson`, `LavorazioneSuggerita` | verificare colonne mancanti |
| DashboardKpi | tabella vuota | popolare job/batch o query aggregate |
| Import | flussi batch complessi | endpoint import dedicati |
