# Architettura database Credixa

## Panoramica

Credixa usa un modello **multi-tenant**: ogni riga operativa appartiene a un `TenantId`. L'isolamento è obbligatorio in ogni query:

```sql
WHERE TenantId = @tenantId
```

## Sorgenti dati (target cloud)

| Layer | Ruolo | Source of truth |
|-------|-------|-----------------|
| Gestionale operativo | Pratiche, incassi, utenti, mandanti, … | **Neon (Postgres)** su cloud |
| Formazione | Corsi, progressi, roleplay | **Firebase / Firestore** (permanente) |
| SQL Server on-premise | Legacy / clienti con Connettore | Solo via Connettore — **non toccato** in questa fase |
| Legacy transitorio | Finché `DATABASE_PROVIDER=firestore` | Firestore via `firebasePrisma` |

### Regola fissa

**Formazione resta su Firebase** indipendentemente da `DATABASE_PROVIDER` / Neon.

## Deploy previsto

```text
Browser
  → Credixa Next.js (Netlify)
       ├─ dati operativi → Neon Postgres (NEON_DATABASE_URL)
       └─ Formazione     → Firebase (service account + NEXT_PUBLIC_FIREBASE_*)
```

SQL Server sul PC / LAN resta disponibile in parallelo tramite Connettore (`DATABASE_PROVIDER=connector`) quando servirà: **non è richiesto per collegare Neon**.

## Collegare Neon (fase attuale)

1. Console Neon → org **Credixa** → progetto **Credixa-Test** → **Connection details**
2. Copia la connection string (consigliata: **pooled** / serverless)
3. In `.env` (locale) e in Netlify → Environment variables:

```env
NEON_DATABASE_URL="postgresql://…@….neon.tech/neondb?sslmode=require"
```

4. Verifica (non scrive dati, non tocca SQL Server):

```powershell
npm run neon:ping
```

5. Copia dati da SQL Server locale → Neon (sola lettura su SQL; wipe+ricrea su Neon):

```powershell
npm run neon:migrate-from-sqlserver
```

Client runtime: `src/lib/neon/client.ts` (`@neondatabase/serverless`).
Script migrazione: `scripts/migrate-sqlserver-to-neon.mjs`.

> `DATABASE_URL` del Prisma schema resta il file SQLite tipi (`file:./src/lib/firebase/.types-only.db`). **Non** sovrascriverlo con la stringa Neon.

## SQL Server — CredixaDev (on-premise, invariato)

| Parametro | Valore dev |
|-----------|------------|
| Istanza | `CREDIXA_DEV` |
| Porta | `1433` |
| Database | `CredixaDev` |
| Login app | `credixa_dev` (vedi `connector/.env`) |

Usato solo con Connettore. Nessuna migration Neon↔SQL in questa fase.

### Schema (riferimento Connettore)

Core: `Tenants`, `Users`, `Sedi`, `Postazioni`, `Mandanti`, `Debitori`, `Pratiche`  
Operativo: `Incassi`, `Attivita`, `PianoRata`, `PraticheLock`, `ImportBatch`, …  
Dashboard: `DashboardKpi`  
Audit: `AuditLog`

Migrations SQL Server: `database/migrations/001` …

## Repository layer

```text
src/lib/data/
  contracts/repositories.ts
  connector/…          # path SQL Server via HTTP
  factory.ts
src/lib/neon/client.ts # Postgres Neon (cloud) — ping / prossimi repo
```

## Tenant isolation — test

Verificare sempre che `demo` non veda dati `alfa` su liste, KPI, incassi, lock, utenti.
