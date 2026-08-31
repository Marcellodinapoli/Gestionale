# Architettura Connettore Credixa

Il **Connettore** è un servizio Express/TypeScript che espone API typed verso SQL Server. È l'unico componente autorizzato ad accedere al database cliente.

## Posizione nel flusso

```text
Credixa (Next.js server)  --HTTP-->  Connettore  --mssql-->  SQL Server
```

Il frontend/browser **non** contatta mai il Connettore direttamente.

## Avvio

```bash
cd connector
cp .env.example .env   # configurare SQL + porta
npm install
npm run dev            # watch
npm run start          # produzione
```

Default: `http://localhost:8443`

## Configurazione (`.env`)

```env
CONNECTOR_PORT=8443
SQL_SERVER=localhost
SQL_PORT=1433
SQL_DATABASE=CredixaDev
SQL_USER=credixa_dev
SQL_PASSWORD=...
CONNECTOR_API_KEY=     # opzionale in dev; consigliato in prod
```

**Nota connessione:** usare `localhost:1433` senza `instanceName` (SQL Browser disabilitato).

## Endpoint

### Health

| Metodo | Path | Descrizione |
|--------|------|-------------|
| GET | `/health` | Stato servizio |
| GET | `/health/db` | Ping SQL |

### Tenant-scoped (`:tenantId` = slug tenant, es. `demo`)

| Metodo | Path | Stato |
|--------|------|-------|
| GET | `/api/v1/tenants/:tenantId/pratiche/:id` | ✅ |
| POST | `/api/v1/tenants/:tenantId/pratiche/search` | ✅ |
| GET | `/api/v1/tenants/:tenantId/dashboard/home` | ✅ |
| GET/POST/DELETE | `/api/v1/tenants/:tenantId/pratiche/:id/lock` | ✅ |

### Auth / interni (server-to-server)

| Metodo | Path | Descrizione |
|--------|------|-------------|
| GET | `/api/v1/tenants/:slug/auth/tenant` | Risolve tenant per login |
| POST | `/api/v1/internal/users/by-email` | Login |
| GET | `/api/v1/internal/users/:id/session` | Sessione corrente |
| PATCH | `/api/v1/internal/users/:id/login` | Aggiorna lastLoginAt |
| GET | `/api/v1/internal/postazioni/:id` | Verifica postazione attiva |

### Da implementare

Vedi [`docs/SQL_MIGRATION_PLAN.md`](../docs/SQL_MIGRATION_PLAN.md) — debitori, mandanti, incassi, attività, utenti, agenda, import, audit, config, …

## Regole API

1. **VIETATO** `POST /query` o SQL arbitrario
2. Ogni endpoint = operazione business typed e parametrizzata
3. Risoluzione tenant: slug URL → `TenantId` GUID via middleware
4. Header opzionale: `X-Connector-Key` se `CONNECTOR_API_KEY` configurata

## Struttura codice

```text
connector/src/
  server.ts           # bootstrap Express
  config.ts           # env
  db/pool.ts          # connection pool mssql
  middleware/tenant.ts
  routes/             # health, pratiche, dashboard, lock, auth
  services/           # query SQL per dominio
```

## Sicurezza

- Credenziali SQL solo nel Connettore (mai in Next.js public env)
- Query sempre parametrizzate (`@tenantId`, `@id`, …)
- Log senza password/token
- In produzione: TLS tra Credixa Cloud e Connettore cliente

## Test

```bash
node database/scripts/test-connector-e2e.mjs
curl http://localhost:8443/health
curl http://localhost:8443/health/db
```
