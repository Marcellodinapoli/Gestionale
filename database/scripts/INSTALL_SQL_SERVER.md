# SQL Server 2022 Developer — installazione locale Credixa

**Richiede privilegi amministratore.** Confermare prima di procedere.

## Cosa verrà installato

| Componente | Dettaglio |
|------------|-----------|
| SQL Server 2022 Developer Edition | Gratuito, uso dev/test |
| Database Engine | Istanza nominata `CREDIXA_DEV` |
| Autenticazione | Mixed Mode (Windows + SQL Server) |
| SSMS | SQL Server Management Studio (GUI) |
| sqlcmd | Utility riga di comando (inclusa con SSMS / tools) |

## Configurazione target

```text
Istanza:     CREDIXA_DEV
Porta:       1433 (TCP abilitato)
Database:    CredixaDev
Login app:   credixa_dev  (password da impostare in .env)
```

## Passi manuali (consigliati)

1. Scaricare **SQL Server 2022 Developer** da [Microsoft](https://www.microsoft.com/en-us/sql-server/sql-server-downloads).
2. Durante setup:
   - Feature: **Database Engine Services**
   - Instance name: `CREDIXA_DEV`
   - Authentication: **Mixed Mode**
   - Impostare password `sa` (annotarla in locale, non committare)
3. Scaricare e installare **SSMS**.
4. Aprire SSMS → connettersi a `localhost\CREDIXA_DEV`.
5. Eseguire `database/scripts/000_create_database.sql` (modificare password `credixa_dev`).
6. Abilitare TCP/IP su porta 1433 in **SQL Server Configuration Manager** se necessario.

## Dopo l'installazione

```powershell
# Root progetto
npm install
npm run db:migrate:sql
npm run db:seed:sql

# Connettore
cd connector
npm install
copy .env.example .env
# Modificare DB_PASSWORD nel .env
npm run dev
```

Verificare:

```http
GET http://localhost:8443/health
GET http://localhost:8443/health/db
```

## NON installare

- Docker / container SQL
- WSL per SQL Server
- Database cloud (Azure SQL, ecc.)
