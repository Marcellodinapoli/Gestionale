import os from "node:os";

/** URL pubblico del BFF CredixaApp (pairing + pratiche) per payload QR. */
export function resolveCreditcalcBffPublicUrl(req: Request): string {
  const fromEnv = (
    process.env.CREDIXA_BFF_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_CREDIXA_BFF_URL ||
    ""
  ).trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const hostHeader =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host")?.trim() ||
    "";

  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";

  if (!hostHeader) return "http://127.0.0.1:3001";

  const resolved = substituteLocalHostForLan(hostHeader, proto);
  return `${proto}://${resolved}`.replace(/\/+$/, "");
}

function substituteLocalHostForLan(hostWithPort: string, proto: string): string {
  const hostOnly = hostWithPort.split(":")[0]?.toLowerCase() ?? "";
  if (!isLocalHostname(hostOnly)) return hostWithPort;

  const explicitLan = process.env.CREDIXA_BFF_LAN_HOST?.trim();
  const lan = explicitLan || detectLanIPv4();
  if (!lan) return hostWithPort;

  const portPart = hostWithPort.includes(":")
    ? hostWithPort.slice(hostWithPort.indexOf(":"))
    : proto === "https"
      ? ""
      : ":3001";

  return `${lan}${portPart}`;
}

function isLocalHostname(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Prima IPv4 privata dell’host (per QR in dev senza deploy pubblico). */
export function detectLanIPv4(): string | null {
  const candidates: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    if (!list) continue;
    for (const iface of list) {
      const family = iface.family;
      const isV4 =
        family === "IPv4" || String(family).toLowerCase() === "ipv4";
      if (!isV4 || iface.internal) continue;
      candidates.push(iface.address);
    }
  }
  const score = (ip: string): number => {
    if (ip.startsWith("192.168.")) return 3;
    if (ip.startsWith("10.")) return 2;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
    return 0;
  };
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0] ?? null;
}

export function creditcalcPairQrPayload(
  req: Request,
  linkRequestId: string
): string {
  const base = resolveCreditcalcBffPublicUrl(req);
  return `${base}/creditcalc/pair/${linkRequestId}`;
}
