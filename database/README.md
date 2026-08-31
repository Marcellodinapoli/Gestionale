# CredixaDev — SQL Server locale

Infrastruttura database relazionale multi-tenant per simulare l'ambiente cliente.

## Prerequisiti

- SQL Server 2022 Developer Edition, istanza `CREDIXA_DEV`, porta `1433`
- SSMS (opzionale, consigliato)
- Node.js + `npm install --save-dev mssql` nella root del progetto

## Setup

1. Eseguire `database/scripts/000_create_database.sql` come `sa` (modificare password login).
2. Copiare variabili da `connector/.env.example` nel `.env` locale (non committare).
3. Migrazioni:

```bash
npm run db:migrate:sql
```

4. Seed parametrico:

```bash
npm run db:seed:sql
npm run db:seed:sql -- --pratiche=50000 --incassi=100000
npm run db:seed:sql -- --reset
```

5. Avviare il connettore:

```bash
cd connector && npm install && npm run dev
```

6. Audit migrazione:

```bash
node database/scripts/generate-migration-audit.mjs
```

Documentazione: [`docs/SQL_MIGRATION.md`](../docs/SQL_MIGRATION.md), [`docs/SQL_MIGRATION_PLAN.md`](../docs/SQL_MIGRATION_PLAN.md)

## Migrazioni

| File | Contenuto |
|------|-----------|
| `001_initial_schema.sql` | Tenants, Users, Mandanti, Debitori, Pratiche |
| `002_operational_tables.sql` | Incassi, Attivita, Lock, messaggistica, audit |
| `003_dashboard.sql` | DashboardKpi |
| `004_alter_pratiche.sql` | Colonne aggiuntive Pratiche |
| `005_indexes.sql` | Indici operativi |

## Tenant demo

- `demo` — dati principali seed
- `alfa` — isolamento tenant (100 pratiche)

Credenziali admin demo (dopo seed): `admin@gestionale.local` / `Demo123!`
