# Architettura database Credixa

## Panoramica

Credixa usa un modello **multi-tenant**: ogni riga operativa appartiene a un `TenantId`. L'isolamento è obbligatorio in ogni query SQL:

```sql
WHERE TenantId = @tenantId
```

## Sorgenti dati

| Layer | Ruolo | Source of truth |
|-------|-------|-----------------|
| Gestionale operativo | Pratiche, incassi, utenti, … | **SQL Server** (target) |
| Formazione | Corsi, progressi | **Firestore** (permanente) |
| Legacy transitorio | Moduli non ancora migrati | Firestore via `firebasePrisma` |

## SQL Server — CredixaDev

| Parametro | Valore dev |
|-----------|------------|
| Istanza | `CREDIXA_DEV` |
| Porta | `1433` |
| Database | `CredixaDev` |
| Login app | `credixa_dev` (vedi `connector/.env`) |

### Schema (26 tabelle)

Core: `Tenants`, `Users`, `Sedi`, `Postazioni`, `Mandanti`, `Debitori`, `Pratiche`  
Operativo: `Incassi`, `Attivita`, `PianoRata`, `PraticheLock`, `ImportBatch`, …  
Dashboard: `DashboardKpi`  
Audit: `AuditLog`

Migrations: `database/migrations/001` … `005`

### Seed demo

- Tenant `demo` e `alfa`
- ~10.100 pratiche, ~20.000 incassi, ~8.000 debitori
- Login demo: `admin@gestionale.local` / `Demo123!` (tenant `demo`)

## Repository layer

```text
src/lib/data/
  contracts/repositories.ts   # interfacce per dominio
  connector/ConnectorRepository.ts
  connector/ConnectorClient.ts
  factory.ts                  # getPraticheRepository(), …
  operationalAccess.ts        # bridge auth (Firestore | Connector)
```

La business logic **non** deve chiamare `prisma.*` per dati operativi migrati.

## Produzione futura

```text
Credixa Cloud (Netlify/Vercel)
        ↓ HTTPS
Connettore on-premise (unico accesso LAN)
        ↓
SQL Server aziendale (non esposto su Internet)
```

Il Connettore è progettato per poter supportare in futuro Oracle o altri DB — l'app parla solo HTTP typed API.

## Tenant isolation — test

Verificare sempre che `demo` non veda dati `alfa` su:

- Liste pratiche / ricerca
- Dashboard KPI
- Incassi / attività
- Lock pratica
- Utenti / operatori
