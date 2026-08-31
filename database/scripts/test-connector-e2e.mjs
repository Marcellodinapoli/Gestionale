/**
 * Test end-to-end ConnectorRepository → HTTP → SQL (no wiring app Credixa)
 */
process.env.CONNECTOR_BASE_URL = "http://localhost:8443";

const { createConnectorRepositories } = await import("../../src/lib/data/connector/ConnectorRepository.ts");

const repos = createConnectorRepositories();
const timings = {};

let t0 = performance.now();
const search = await repos.pratiche.search("demo", { page: 1, pageSize: 10, stato: "NUOVA" });
timings.searchDemoMs = Math.round(performance.now() - t0);

t0 = performance.now();
const dashboard = await repos.dashboard.getHome("demo");
timings.dashboardDemoMs = Math.round(performance.now() - t0);

t0 = performance.now();
const detail = await repos.pratiche.getById("demo", search.items[0].id);
timings.detailMs = Math.round(performance.now() - t0);

t0 = performance.now();
const alfaDash = await repos.dashboard.getHome("alfa");
timings.dashboardAlfaMs = Math.round(performance.now() - t0);

console.log(JSON.stringify({
  ok: true,
  searchTotal: search.total,
  searchItems: search.items.length,
  searchQueryMs: search.queryMs,
  dashboardDemo: dashboard.summary,
  dashboardAlfa: alfaDash.summary,
  detailNumero: detail?.numero,
  timings,
}, null, 2));
