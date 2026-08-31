# FASE F — Audit Home/Dashboard

## Chiamate prisma.* in `page.tsx` (operativo)

| # | Chiamata | Ruolo | Sezione |
|---|----------|-------|---------|
| 1 | `prisma.pratica.findMany` | ADMIN | riepilogoMandanti |
| 2 | `prisma.user.findMany` | BACK_OFFICE | supervisori picker |
| 3 | `prisma.pratica.count` | shared | totali |
| 4 | `prisma.pratica.count` | shared | scadute |
| 5 | `prisma.pratica.count` | AMMINISTRAZIONE | totPratiche |
| 6 | `prisma.sede.findMany` | AMMINISTRAZIONE, ADMIN | filtro sede |
| 7 | `prisma.provvigione.aggregate` ×2 | AMMINISTRAZIONE | provvigioni |
| 8 | `prisma.user.count` | AMMINISTRAZIONE, ADMIN | operatori |
| 9 | `prisma.pratica.groupBy` | ADMIN | lotti per mandante |
| 10 | `prisma.user.findMany` | ADMIN | operatori attivi |
| 11 | `prisma.user.findMany` | ADMIN | supervisori |
| 12 | `prisma.user.findMany` ×N | ADMIN | membri gruppo (N+1) |
| 13 | `prisma.pratica.count` ×2N | ADMIN | carico gruppi (N+1) |
| 14 | `prisma.pratica.groupBy` | ADMIN | esiti contatto |
| 15 | `prisma.pratica.count` ×3 | ADMIN | allerte scadenze |
| **Totale diretto page.tsx** | **~11 pratica + ~8 user + 2 provvigione + 2 sede** | | |

## Chiamate indirette (helper Home)

| Helper | prisma.* | Note |
|--------|----------|------|
| `inLavorazionePerPerimetro` | pratica.findMany (full scan scope) | via praticaDb |
| `codiciPerMandantePerimetro` | pratica.findMany (full scan) | via praticaDb |
| `daAffidarePerPerimetroGruppo` | pratica.findMany | via praticaDb |
| `lavoratePerOperatoreInGiornata` | attivita.findMany + audit | FASE E |
| `praticheConCambioCodiceInGiornata` | auditLog.findMany ×2 | |
| `getGruppoLavoro` | user.findMany | layout |
| `incassiDb/attivitaDb/mandantiDb` | — | già migrati FASE D/E |

## Residui FASE C (prisma.pratica in Home path)

11 chiamate dirette + 3 findMany indiretti (full scan per KPI codici/lavorazione/affidare).

## Obiettivo FASE F

1 round-trip Connector → bundle SQL aggregato (≤10 query SQL interne vs ~30 Prisma).
