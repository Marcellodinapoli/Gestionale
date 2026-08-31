import type { BaselineReport } from "./types";

function fmt(n: number) {
  return n.toLocaleString("it-IT");
}

export function generateMarkdownReport(r: BaselineReport): string {
  const lines: string[] = [];

  lines.push("# Credixa — Baseline Performance (Fase 0)");
  lines.push("");
  lines.push(`**Generato:** ${r.generatedAt}`);
  lines.push(`**Tenant:** ${r.tenant.tenantSlug} (\`${r.tenant.tenantId}\`)`);
  lines.push(`**Documenti Firestore:** ${fmt(r.tenant.totalDocuments)}`);
  lines.push(`**Utente benchmark:** ${r.user.email} (${r.user.role})`);
  lines.push(`**Modalità:** ${r.mode}`);
  if (r.environment.firebaseError) {
    lines.push(`**⚠ Firebase:** ${r.environment.firebaseError}`);
  }
  lines.push("");

  if (r.comparison) {
    lines.push("## Confronto LIVE vs EXTRAPOLATED");
    lines.push("");
    lines.push("| Metrica | LIVE (tenant attuale) | Stima @ 5k pratiche | Extrapolated offline |");
    lines.push("|---|---:|---:|---:|");
    lines.push(`| prisma calls (ADMIN home) | ${r.comparison.livePrismaCalls} | — | ${r.comparison.extrapolatedPrismaCalls} |`);
    lines.push(`| Firestore reads | ${fmt(r.comparison.liveReads)} | ${fmt(r.comparison.scaledReads5k)} | ${fmt(r.comparison.extrapolatedReads)} |`);
    lines.push(`| Tempo server (ms) | ${r.comparison.liveDurationMs} | — | ${r.comparison.extrapolatedDurationMs} |`);
    if (r.comparison.readsPerPratica != null) {
      lines.push(`| Reads / pratica (live) | ${r.comparison.readsPerPratica} | — | — |`);
    }
    lines.push("");
    lines.push(
      "> **Interpretazione:** il numero di **query prisma** è stabile (~22–46) indipendentemente dal volume dati. Le **reads** scalano linearmente con le collection (full scan aggregate/groupBy/findMany). L'estrapolazione offline era **coerente nel pattern**, sovrastimava leggermente per profilo 5k."
    );
    lines.push("");
  }

  if (r.homeByRole?.length) {
    lines.push("## Home per ruolo (LIVE)");
    lines.push("");
    lines.push("| Ruolo | prisma | reads | writes | ms |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const row of r.homeByRole) {
      lines.push(
        `| ${row.role} | ${row.prismaCalls} | ${fmt(row.estimatedFirestoreReads)} | ${row.estimatedFirestoreWrites ?? 0} | ${row.totalDurationMs} |`
      );
    }
    lines.push("");
  }

  // Collection sizes
  lines.push("## Dimensioni collection (tenant attuale)");
  lines.push("");
  lines.push("| Collection | Documenti |");
  lines.push("|---|---:|");
  const sortedCols = Object.entries(r.tenant.collections).sort((a, b) => b[1] - a[1]);
  for (const [model, count] of sortedCols) {
    if (count > 0) lines.push(`| ${model} | ${fmt(count)} |`);
  }
  if (r.tenant.totalDocuments === 0) {
    lines.push("| *(vuoto)* | 0 |");
    lines.push("");
    lines.push(
      "> **Nota:** il tenant demo è quasi vuoto. I conteggi *reads* assoluti sono bassi, ma il **numero di query prisma** e i **pattern full-scan** sono rappresentativi. Per produzione, moltiplica le reads per N documenti in collection."
    );
  }
  lines.push("");

  // 1 HOME
  lines.push("## 1. Home dashboard");
  lines.push("");
  lines.push("| Metrica | Valore |");
  lines.push("|---|---:|");
  lines.push(`| Tempo totale (server-side simulato) | ${r.home.totalDurationMs} ms |`);
  lines.push(`| Chiamate prisma.* | ${r.home.prismaCalls} |`);
  lines.push(`| Reads Firestore stimate (tenant attuale) | ~${fmt(r.home.estimatedFirestoreReads)} |`);
  lines.push(`| Firestore writes (home) | ${r.home.estimatedFirestoreWrites ?? 0} |`);
  if (r.homeReadsAtScale) {
    lines.push(`| Reads @ 5k pratiche (profilo extrapolated) | ~${fmt(r.homeReadsAtScale.estimatedFirestoreReads)} |`);
  }
  lines.push(`| Durata prisma cumulata | ${r.home.totalPrismaDurationMs} ms |`);
  lines.push(`| Serverless invocations (1 apertura) | 1 |`);
  lines.push("");

  if (r.http?.routes.length) {
    const homeHttp = r.http.routes.find((x) => x.url.endsWith("/") || x.url.endsWith(":3001/"));
    if (homeHttp) {
      lines.push("| TTFB HTTP (se dev server attivo) | " + homeHttp.ttfbMs + " ms |");
      lines.push("| Tempo totale HTTP | " + homeHttp.totalMs + " ms |");
      lines.push("");
    }
  }

  lines.push("### Blocchi principali");
  lines.push("");
  lines.push("| Blocco | ms | prisma calls | reads stimate |");
  lines.push("|---|---:|---:|---:|");
  for (const b of r.home.blocks) {
    lines.push(`| ${b.block} | ${b.durationMs} | ${b.prismaCalls} | ~${fmt(b.estimatedReads)} |`);
  }
  lines.push("");

  lines.push("### Query più lente (top 10)");
  lines.push("");
  lines.push("| # | Model | Metodo | ms | reads | scan |");
  lines.push("|---:|---|---|---:|---:|---|");
  for (const q of r.home.slowestQueries) {
    lines.push(
      `| ${q.id} | ${q.model} | ${q.delegate}.${q.method} | ${q.durationMs} | ${q.estimatedReads} | ${q.scanKind} |`
    );
  }
  lines.push("");

  // 2 PRATICA
  lines.push("## 2. Apertura pratica");
  lines.push("");
  if (r.pratica.open) {
    lines.push("| Metrica | Valore |");
    lines.push("|---|---:|");
    lines.push(`| Tempo totale | ${r.pratica.open.totalDurationMs} ms |`);
    lines.push(`| Lock acquire (getPraticaWorkContext) | ${r.pratica.open.lockAcquireMs} ms |`);
    lines.push(`| Rate caricate | ${r.pratica.open.rateCount} |`);
    lines.push(`| Garanti | ${r.pratica.open.garantiCount} |`);
    lines.push("");
    if (r.aggregateGroupBy?.length) {
    lines.push("## aggregate / groupBy (LIVE)");
    lines.push("");
    lines.push("| Blocco | Model | Metodo | reads | ms |");
    lines.push("|---|---|---|---:|---:|");
    for (const a of r.aggregateGroupBy) {
      lines.push(`| ${a.block ?? "—"} | ${a.model} | ${a.method} | ${fmt(a.reads)} | ${a.durationMs} |`);
    }
    lines.push("");
  }

  if (r.pratica.lockOps) {
      lines.push("### Operazioni lock (singola pratica)");
      lines.push("");
      lines.push("| Operazione | ms | Δ prisma calls |");
      lines.push("|---|---:|---:|");
      for (const [op, data] of Object.entries(r.pratica.lockOps)) {
        lines.push(`| ${op} | ${data.durationMs} | ${data.prismaCallsDelta} |`);
      }
      lines.push("");
    }
  } else {
    lines.push("*Nessuna pratica nel tenant — eseguire `npm run db:seed:demo` per misure dinamiche.*");
    lines.push("");
  }

  // 3 PRATICHE LIST
  lines.push("## 3. Lista pratiche");
  lines.push("");
  lines.push("### Default (stato IN_LAVORAZIONE)");
  lines.push("");
  lines.push("| Metrica | Valore |");
  lines.push("|---|---:|");
  lines.push(`| Tempo | ${r.praticheList.default.totalDurationMs} ms |`);
  lines.push(`| Totale pratiche (count) | ${r.praticheList.default.total} |`);
  lines.push(`| Righe pagina | ${r.praticheList.default.rowsReturned} |`);
  lines.push("");
  if (r.praticheList.withImportoFiltri) {
    lines.push("### Con filtro importo totale (full scan)");
    lines.push("");
    lines.push("| Metrica | Valore |");
    lines.push("|---|---:|");
    lines.push(`| Tempo | ${r.praticheList.withImportoFiltri.totalDurationMs} ms |`);
    lines.push(`| Had importo filtri | ${r.praticheList.withImportoFiltri.hadImportoFiltri} |`);
    lines.push("");
  }

  // 4 LOCK traffic
  lines.push("## 4. Lock — traffico teorico");
  lines.push("");
  lines.push(`Heartbeat client: **${r.constants.lockHeartbeatMs / 1000}s** | TTL lock: **${r.constants.lockTtlMs / 1000}s**`);
  lines.push("");
  lines.push("Assunzione: 25% operatori con scheda pratica aperta.");
  lines.push("");
  lines.push("| Operatori | Tab aperte | req/min lock | req/giorno lock |");
  lines.push("|---:|---:|---:|---:|");
  for (const row of r.trafficTheory) {
    lines.push(
      `| ${row.operators} | ${row.lock.tabsOpen} | ${fmt(row.lock.totalReqPerMin)} | ${fmt(row.lock.totalReqPerDay)} |`
    );
  }
  lines.push("");

  // 5 MEMO
  lines.push("## 5. Memo alerts (polling 20s)");
  lines.push("");
  lines.push("| Operatori | req/min | req/giorno | query prisma/giorno |");
  lines.push("|---:|---:|---:|---:|");
  for (const row of r.trafficTheory) {
    lines.push(
      `| ${row.operators} | ${fmt(row.memo.reqPerMin)} | ${fmt(row.memo.reqPerDay)} | ${fmt(row.memo.prismaQueriesPerDay)} |`
    );
  }
  lines.push("");
  lines.push(`Singola chiamata memo (simulata): **${r.memoAlerts.totalDurationMs} ms**`);
  lines.push("");

  // 6 SOFT REFRESH
  lines.push("## 6. Soft refresh (180s + focus)");
  lines.push("");
  lines.push(`Basato su home: ${r.home.prismaCalls} prisma calls / ~${r.home.estimatedFirestoreReads} reads per refresh.`);
  lines.push("");
  lines.push("| Operatori | refresh/utente/giorno | refresh totali/giorno | reads Firestore/giorno |");
  lines.push("|---:|---:|---:|---:|");
  for (const row of r.trafficTheory) {
    lines.push(
      `| ${row.operators} | ${row.softRefresh.refreshesPerUserPerDay} | ${fmt(row.softRefresh.totalRefreshesPerDay)} | ${fmt(row.softRefresh.estimatedReadsPerDay)} |`
    );
  }
  lines.push("");

  // 7 FULL SCAN
  lines.push("## 7. Full scan rilevati (benchmark dinamico)");
  lines.push("");
  if (r.fullScans.dynamic.length) {
    lines.push("| Collection | Metodo | Scan | occorrenze | reads totali | max ms |");
    lines.push("|---|---|---|---:|---:|---:|");
    for (const s of r.fullScans.dynamic.slice(0, 20)) {
      lines.push(
        `| ${s.collection} | ${s.method} | ${s.scanKind} | ${s.occurrences} | ${fmt(s.totalReads)} | ${s.durationMs} |`
      );
    }
  } else {
    lines.push("*Nessun full scan rilevato (tenant vuoto — vedi hotspot statici).*");
  }
  lines.push("");
  lines.push("### Hotspot statici noti");
  lines.push("");
  for (const h of r.fullScans.staticHotspots) {
    lines.push(`- \`${h.file}\` → \`${h.function}\`: ${h.pattern} (${h.collection})`);
  }
  lines.push("");

  // 8 CACHE
  lines.push("## 8. Cache");
  lines.push("");
  lines.push("### ttlCache");
  lines.push(`- TTL default: **${r.cacheAnalysis.ttlCache.defaultTtlMs / 1000}s**`);
  lines.push(`- Scope: **${r.cacheAnalysis.ttlCache.scope}**`);
  lines.push(`- Condivisa tra utenti: **${r.cacheAnalysis.ttlCache.sharedAcrossUsers ? "sì" : "no"}**`);
  lines.push(`- Condivisa tra istanze Netlify: **${r.cacheAnalysis.ttlCache.sharedAcrossInstances ? "sì" : "no"}**`);
  lines.push("");
  lines.push("### Doppio run home (stesso processo)");
  lines.push("");
  lines.push("| Run | ms | prisma | reads |");
  lines.push("|---:|---:|---:|---:|");
  lines.push(
    `| 1 | ${r.cache.run1.durationMs} | ${r.cache.run1.prismaCalls} | ~${r.cache.run1.estimatedFirestoreReads} |`
  );
  lines.push(
    `| 2 | ${r.cache.run2.durationMs} | ${r.cache.run2.prismaCalls} | ~${r.cache.run2.estimatedFirestoreReads} |`
  );
  lines.push("");
  lines.push(`> ${r.cache.interpretation}`);
  lines.push("");

  // TABLE 1 - Problems
  lines.push("---");
  lines.push("");
  lines.push("## Tabella problemi");
  lines.push("");
  lines.push("| Problema | File | Reads | Requests | Tempo | Impatto | Priorità |");
  lines.push("|---|---|---:|---:|---:|---|---|");
  lines.push(...problemTableRows(r));
  lines.push("");

  // TABLE 2 - Interventions
  lines.push("## Tabella interventi");
  lines.push("");
  lines.push("| Intervento | Beneficio stimato | Rischio | Migrazione | Priorità |");
  lines.push("|---|---|---|---|---|");
  lines.push(...interventionTableRows(r));
  lines.push("");

  // DECISIVE ANSWERS
  lines.push("---");
  lines.push("");
  lines.push("## Risposte decisive");
  lines.push("");
  lines.push("### A) Vero collo di bottiglia oggi");
  lines.push("");
  lines.push(decisiveA(r));
  lines.push("");
  lines.push("### B) Prime 3 modifiche (beneficio/rischio)");
  lines.push("");
  lines.push(decisiveB());
  lines.push("");
  lines.push("### C) Reads/requests eliminabili realisticamente");
  lines.push("");
  lines.push(decisiveC(r));
  lines.push("");
  lines.push("### D) Cloud Run / App Hosting dopo ottimizzazioni?");
  lines.push("");
  lines.push(decisiveD(r));
  lines.push("");

  return lines.join("\n");
}

function problemTableRows(r: BaselineReport): string[] {
  const homeReads = r.home.estimatedFirestoreReads;
  const memoDay200 = r.trafficTheory.find((x) => x.operators === 200)?.memo.reqPerDay ?? 0;
  const lockDay200 = r.trafficTheory.find((x) => x.operators === 200)?.lock.totalReqPerDay ?? 0;
  const softReads200 = r.trafficTheory.find((x) => x.operators === 200)?.softRefresh.estimatedReadsPerDay ?? 0;

  return [
    `| Polling memo ogni 20s (globale) | MemoPopupWatcher.tsx, api/memo-alerts | ~${fmt(memoDay200 * 3)}/g (200 op) | ${fmt(memoDay200)}/g | ~${r.memoAlerts.totalDurationMs}ms/req | Alto — costante su tutti | **P1** |`,
    `| Lock HTTP heartbeat 15s | PraticaLockWatcher.tsx, praticaLock.ts | basso/doc | ${fmt(lockDay200)}/g (200 op) | ${r.pratica.lockOps?.heartbeat.durationMs ?? "?"}ms | Alto con tab aperte | **P1** |`,
    `| Home SSR ${r.home.prismaCalls} query | page.tsx, codiciMandantePerimetro.ts | ~${fmt(homeReads)}/load | 1/load | ${r.home.totalDurationMs}ms | Critico ogni apertura | **P2** |`,
    `| Soft refresh 180s | SoftRefresh.tsx, layout.tsx | ~${fmt(softReads200)}/g (200 op) | ~${fmt(r.trafficTheory.find((x) => x.operators === 200)?.softRefresh.totalRefreshesPerDay ?? 0)}/g | ${r.home.totalDurationMs}ms/refresh | Medio-alto | **P2** |`,
    `| Adapter aggregate/groupBy full scan | firebasePrisma.ts | O(N) collection | — | variabile | Critico a scala | **P3** |`,
    `| altriFiltri importo/incassato | praticheAltriFiltri.ts | O(pratiche+incassi) | — | ${r.praticheList.withImportoFiltri?.totalDurationMs ?? "?"}ms | Alto su filtri | **P3** |`,
    `| purgeExpiredLocks ogni GET | praticaLock.ts | 1 write/query | incluso lock | — | Medio | **P1** |`,
    `| ttlCache non condivisa (Netlify) | ttlCache.ts | 0 hit cross-user | — | — | Medio strutturale | **P4** |`,
  ];
}

function interventionTableRows(_r: BaselineReport): string[] {
  return [
    "| Lock realtime Firestore + no HTTP poll | −95% req lock | Basso | No (path esistente praticaLocks) | **P1** |",
    "| Documento aggregati/home | Home 12–46 query → 1–3 reads | Medio | Backfill + hook write | **P2** |",
    "| Memo → listener Firestore o SSE | −95% req memo | Medio | Firebase Auth bridge | **P2** |",
    "| Branch ruolo prima batch home | −12 query ADMIN | Basso | No | **P2** |",
    "| Repository nativi pratiche/incassi | −full scan adapter | Medio | Graduale | **P3** |",
    "| Disabilitare soft refresh su / | −refresh SSR home | Basso | No | **P2** |",
    "| Cloud Run / App Hosting | −cold start, cache condivisa | Medio ops | Sì infra | **P5** |",
  ];
}

function decisiveA(r: BaselineReport): string {
  return (
    "Il collo di bottiglia **primario** è il **traffico HTTP ricorrente** (memo 20s + lock 15s + soft refresh) che genera invocazioni serverless continue indipendentemente dall'attività utente. " +
    "Il collo di bottiglia **secondario** è la **home SSR** con decine di query prisma, molte delle quali fanno **full scan** via adapter (aggregate/groupBy/findMany senza limit). " +
    `Con ${r.home.prismaCalls} chiamate prisma per singola apertura home, il costo per utente è strutturale — non dipende dal volume documenti attuale del tenant demo.`
  );
}

function decisiveB(): string {
  return (
    "1. **Lock realtime** (elimina polling 15s) — beneficio immediato, rischio basso, nessuna migrazione dati.\n" +
    "2. **Aggregati home** — massimo impatto su reads/query per apertura, rischio medio (write hooks).\n" +
    "3. **Stop polling memo / listener** — secondo maggiore risparmio req/giorno, richiede auth Firebase per client read sicuro."
  );
}

function decisiveC(r: BaselineReport): string {
  const op200 = r.trafficTheory.find((x) => x.operators === 200)!;
  const pollingReqDay =
    op200.memo.reqPerDay + op200.lock.totalReqPerDay + op200.softRefresh.totalRefreshesPerDay;
  const pollingPrismaDay =
    op200.memo.prismaQueriesPerDay +
    op200.softRefresh.prismaCallsPerDay;

  return (
    `Con **200 operatori**, stimiamo ~**${fmt(pollingReqDay)}** richieste HTTP/giorno solo da polling (memo+lock+soft refresh), ` +
    `e ~**${fmt(pollingPrismaDay)}** chiamate prisma/giorno da memo+refresh.\n\n` +
    "Eliminazione realistica post-ottimizzazione:\n" +
    "- Lock realtime: **~95%** req lock\n" +
    "- Aggregati home: **~90%** reads per apertura home\n" +
    "- Memo listener: **~95%** req memo\n" +
    "- Soft refresh disabilitato su home: **~100%** refresh SSR home\n\n" +
    `Totale: **~70–85%** del traffico serverless eliminabile senza cambiare hosting.`
  );
}

function decisiveD(r: BaselineReport): string {
  return (
    "Dopo lock realtime + aggregati home + stop polling memo/refresh, **Netlify può reggere ~100–150 operatori** attivi " +
    "se il tenant non è enorme. Per **200–500 operatori** con picchi concorrenti, prevedo ancora necessità di **hosting always-on** " +
    "(Cloud Run o Firebase App Hosting) per: cold start, cache non condivisa, limiti concurrency — ma **solo dopo** aver misurato post-ottimizzazione. " +
    `Baseline attuale home: ${r.home.prismaCalls} query/load — obiettivo post-Fase 2: ≤5 reads/load.`
  );
}
