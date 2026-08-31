/**
 * Misura TTFB HTTP opzionale — richiede dev server avviato.
 * Non modifica il gestionale; usa fetch esterno.
 */

export type HttpMeasurement = {
  url: string;
  ttfbMs: number;
  totalMs: number;
  status: number;
  error?: string;
};

async function fetchTiming(url: string, cookie?: string): Promise<HttpMeasurement> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      redirect: "manual",
      headers: cookie ? { Cookie: cookie } : {},
      cache: "no-store",
    });
    const ttfbMs = Math.round(performance.now() - t0);
    await res.text();
    const totalMs = Math.round(performance.now() - t0);
    return { url, ttfbMs, totalMs, status: res.status };
  } catch (e) {
    return {
      url,
      ttfbMs: Math.round(performance.now() - t0),
      totalMs: Math.round(performance.now() - t0),
      status: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function measureHttpBaseline(baseUrl: string) {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantSlug: "demo",
      email: "admin@gestionale.local",
      password: "Demo123!",
    }),
  });

  let cookie: string | undefined;
  if (loginRes.ok) {
    const setCookie = loginRes.headers.getSetCookie?.() ?? [];
    cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  }

  const routes = ["/", "/pratiche?stato=IN_LAVORAZIONE", "/api/health"];
  const results: HttpMeasurement[] = [];

  for (const route of routes) {
    results.push(await fetchTiming(`${baseUrl}${route}`, cookie));
  }

  if (cookie) {
    const praticheRes = await fetch(`${baseUrl}/pratiche?stato=IN_LAVORAZIONE`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const html = await praticheRes.text();
    const idMatch = html.match(/href="\/pratiche\/([^"]+)"/);
    if (idMatch?.[1]) {
      results.push(
        await fetchTiming(`${baseUrl}/pratiche/${idMatch[1]}`, cookie)
      );
    }
  }

  return {
    loginOk: loginRes.ok,
    loginStatus: loginRes.status,
    routes: results,
    note: cookie
      ? "TTFB misurato con sessione autenticata"
      : "Login fallito — TTFB solo su route pubbliche",
  };
}
