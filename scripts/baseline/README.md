# Baseline Performance — Fase 0

Strumenti di misurazione **separati dal codice applicativo**.

Non modificano il gestionale: usano un tsconfig dedicato che reindirizza
solo `@/lib/prisma` → `lib/instrumentedPrisma.ts` durante l'esecuzione degli script.

## Prerequisiti

- `.env` con credenziali Firebase (come per `npm run dev`)
- Tenant `demo` con utente `admin@gestionale.local`

## Esecuzione

```bash
npm run baseline
```

Report generati in:

- `scripts/baseline/output/baseline-latest.json`
- `scripts/baseline/output/baseline-latest.md`

## HTTP TTFB (opzionale)

Con dev server avviato (`npm run dev`):

```bash
# PowerShell
$env:BASELINE_HTTP="1"; npm run baseline

# bash
BASELINE_HTTP=1 npm run baseline
```

## Cosa misura

1. Home — query prisma, reads stimate, timing per blocco
2. Apertura pratica + lock ops
3. Lista pratiche (default + filtro importo full scan)
4. Memo alerts (simulazione route API)
5. Cache — doppio run home (ttlCache 15s)
6. Full scan — dinamico + hotspot statici
7. Traffico teorico lock / memo / soft refresh (50–500 operatori)

## Note

- Con tenant demo **vuoto**, le reads assolute sono basse ma il **numero di query** è rappresentativo.
- Per misure su dati realistici: `npm run db:seed:demo` (solo ambiente di test).
