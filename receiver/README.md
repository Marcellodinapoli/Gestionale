# Credixa Receiver (standalone)

Servizio HTTP installabile sull'infrastruttura aziendale.
Fa da ponte tra Indeed/CreditCore (SOURCE) e Credixa (pull + push).

**Multi-azienda:** ogni tenant Credixa ha secret propri nelle mappe JSON.
Il path `/v1/tenants/:tenantId/...` deve coincidere con `X-Credixa-Tenant-Id`
o `X-Source-Tenant-Id`.

## Avvio

```bash
cd receiver
npm install
cp .env.example .env
npm run dev
```

## Test

```bash
npm test
```

## Auth Credixa → Receiver

- Header `X-Credixa-Tenant-Id` = `tenantId` del path
- Mode: `RECEIVER_AUTH_MODE` = `api_key` | `bearer` | `hmac`
- Secret: `RECEIVER_SECRETS_JSON` = `{ "<tenantId>": "<secret>" }`

## Auth SOURCE (Indeed / CreditCore) → Receiver

- Header `X-Source-Tenant-Id` = `tenantId` del path
- Secret: `RECEIVER_SOURCE_SECRETS_JSON` = `{ "<tenantId>": "<source-secret>" }`
- Non usare `RECEIVER_SOURCE_KEY` globale in multi-azienda

## Push → Credixa

Dopo ogni ingest SOURCE, se `CREDIXA_PUSH_URL` è impostato, il Receiver
notifica Credixa con lo stesso secret SOURCE del tenant.
