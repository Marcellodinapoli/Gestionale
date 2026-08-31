# Migrazione SQL — Guida operativa

Documento di riferimento per sviluppatori durante la migrazione Firestore → SQL Server.

## Architettura target

```text
Browser → Next.js (Credixa backend)
              ↓
         Repository (src/lib/data/)
              ↓ HTTP (server-only)
         Connettore (connector/, porta 8443)
              ↓ mssql parametrizzato
         SQL Server CredixaDev
```

Vedi anche:

- [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md)
- [`CONNECTOR_ARCHITECTURE.md`](./CONNECTOR_ARCHITECTURE.md)
- [`SQL_MIGRATION_PLAN.md`](./SQL_MIGRATION_PLAN.md)
- [`../database/scripts/migration-audit.md`](../database/scripts/migration-audit.md)

## Avvio ambiente locale

```bash
# 1. SQL Server (già installato: CREDIXA_DEV, porta 1433, DB CredixaDev)

# 2. Connettore
cd connector && npm install && npm run dev

# 3. Credixa con provider SQL
# In .env:
DATABASE_PROVIDER=connector
CONNECTOR_BASE_URL=http://localhost:8443

npm run dev
```

## Switch provider

| `DATABASE_PROVIDER` | Comportamento |
|---------------------|---------------|
| `firestore` (default) | Tutto via `prisma` → Firestore |
| `connector` | Auth/login via Connettore; altri moduli man mano migrati |

Durante la migrazione graduale, i moduli non ancora migrati continuano a usare `prisma` anche con `DATABASE_PROVIDER=connector` finché non vengono convertiti ai repository.

## Moduli esclusi

- **Formazione** — resta su Firebase client + Firestore
- Qualsiasi modulo esplicitamente marcato Firebase

## Sicurezza

- Il browser non conosce SQL Server né il Connettore direttamente
- `tenantId` deriva dalla sessione JWT, non da input utente
- Endpoint `/api/v1/internal/*` — solo server-to-server (API key opzionale)

## Migrazioni schema

```bash
npm run db:migrate:sql
```

Non modificare `CredixaDev` manualmente: usare migration versionate in `database/migrations/`.

## Seed

Dati demo già presenti (2 tenant, ~10k pratiche). Non cancellare senza `--reset` esplicito.

```bash
npm run db:seed:sql
```

## Test Connettore

```bash
node database/scripts/test-connector-e2e.mjs
```

## Rigenerare audit

```bash
node database/scripts/generate-migration-audit.mjs
```
