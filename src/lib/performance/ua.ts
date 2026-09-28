/** Clip UA senza cookie/token. Separato per testabilità senza server-only. */
export function clipUserAgent(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 240);
  return s || null;
}
