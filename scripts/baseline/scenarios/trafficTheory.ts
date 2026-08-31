/** Calcoli teorici traffico lock — non tocca il gestionale. */

export const LOCK_HEARTBEAT_MS = 15_000;
export const LOCK_TTL_MS = 45_000;
export const MEMO_POLL_MS = 20_000;
export const SOFT_REFRESH_MS = 180_000;

export type OperatorScenario = {
  operators: number;
  praticaTabsOpen: number;
  /** frazione operatori con tab pratica aperta */
  praticaTabRatio: number;
};

export function lockTrafficPerMinute(scenario: OperatorScenario) {
  const tabs = Math.round(scenario.operators * scenario.praticaTabRatio);
  const reqPerTabPerMin = 60_000 / LOCK_HEARTBEAT_MS; // 4
  const heartbeatReq = tabs * reqPerTabPerMin;
  // acquire ~1 per apertura tab — amortized: 1 ogni 5 min per tab
  const acquireReq = tabs / 5;
  // release ~1 per chiusura — stesso ordine
  const releaseReq = tabs / 5;
  // purge: ogni GET status (non-owner poll) — metà tab non owner in media no, owner fa POST
  // Owner: POST only (no purge on GET). Non-owner: GET with purge every 15s
  const nonOwnerTabs = 0; // baseline: mostly owner on own pratica
  const getStatusReq = nonOwnerTabs * reqPerTabPerMin;

  return {
    tabsOpen: tabs,
    heartbeatReqPerMin: Math.round(heartbeatReq),
    acquireReqPerMin: Math.round(acquireReq * 10) / 10,
    releaseReqPerMin: Math.round(releaseReq * 10) / 10,
    getStatusReqPerMin: Math.round(getStatusReq),
    totalReqPerMin: Math.round(heartbeatReq + acquireReq + releaseReq + getStatusReq),
    totalReqPerHour: Math.round((heartbeatReq + acquireReq + releaseReq + getStatusReq) * 60),
    totalReqPerDay: Math.round((heartbeatReq + acquireReq + releaseReq + getStatusReq) * 60 * 24),
  };
}

export function memoAlertsTraffic(scenario: { operators: number }) {
  const reqPerMin = scenario.operators * (60_000 / MEMO_POLL_MS);
  const prismaQueriesPerReq = 3; // pratica, impegnoAgenda, messaggioInterno
  return {
    reqPerMin: Math.round(reqPerMin),
    reqPerHour: Math.round(reqPerMin * 60),
    reqPerDay: Math.round(reqPerMin * 60 * 24),
    prismaQueriesPerDay: Math.round(reqPerMin * 60 * 24 * prismaQueriesPerReq),
    serverlessInvocationsPerDay: Math.round(reqPerMin * 60 * 24),
  };
}

export function softRefreshTraffic(scenario: {
  operators: number;
  homePrismaCalls: number;
  homeEstimatedReads: number;
  /** refresh ogni 3 min + ~2 focus/giorno */
  focusPerDay?: number;
}) {
  const intervalRefreshesPerDay = (24 * 60 * 60 * 1000) / SOFT_REFRESH_MS;
  const focusPerDay = scenario.focusPerDay ?? 8;
  const refreshesPerUserPerDay = intervalRefreshesPerDay + focusPerDay;
  const totalRefreshesPerDay = scenario.operators * refreshesPerUserPerDay;
  return {
    refreshesPerUserPerDay: Math.round(refreshesPerUserPerDay * 10) / 10,
    totalRefreshesPerDay: Math.round(totalRefreshesPerDay),
    prismaCallsPerDay: Math.round(totalRefreshesPerDay * scenario.homePrismaCalls),
    estimatedReadsPerDay: Math.round(totalRefreshesPerDay * scenario.homeEstimatedReads),
    serverlessInvocationsPerDay: Math.round(totalRefreshesPerDay),
  };
}

export const OPERATOR_SCENARIOS = [50, 100, 200, 500] as const;

export function buildTrafficMatrix(homePrismaCalls: number, homeEstimatedReads: number) {
  return OPERATOR_SCENARIOS.map((operators) => {
    const praticaTabRatio = 0.25; // 25% operatori su scheda pratica
    return {
      operators,
      lock: lockTrafficPerMinute({ operators, praticaTabsOpen: 0, praticaTabRatio }),
      memo: memoAlertsTraffic({ operators }),
      softRefresh: softRefreshTraffic({ operators, homePrismaCalls, homeEstimatedReads }),
    };
  });
}
