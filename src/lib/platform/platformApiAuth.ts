import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { isNeonConfigured } from "@/lib/neon/client";

/**
 * Auth platform Back Office — separata dalla sessione gestionale.
 * Header: Authorization: Bearer <PLATFORM_API_KEY>
 */

export function getPlatformApiKey(): string {
  return String(process.env.PLATFORM_API_KEY || "").trim();
}

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function extractBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() || null;
}

export type PlatformAuthOk = { ok: true };
export type PlatformAuthFail = { ok: false; response: NextResponse };

export function requirePlatformApiAuth(req: Request): PlatformAuthOk | PlatformAuthFail {
  const expected = getPlatformApiKey();
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "PLATFORM_API_KEY non configurata sul server" },
        { status: 503 }
      ),
    };
  }
  const token = extractBearerToken(req);
  if (!token || !safeEqualString(token, expected)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }),
    };
  }
  if (!isNeonConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "NEON_DATABASE_URL non configurato" },
        { status: 503 }
      ),
    };
  }
  return { ok: true };
}

export function platformJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function platformError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
