import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isFormazioneOnlyPath } from "@/lib/formazioneOnlyAccess";

const COOKIE = "gestionale_session";

const PLATFORM_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function secret() {
  const value = process.env.SESSION_SECRET?.trim();
  if (value) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return new TextEncoder().encode("dev-only-secret-not-for-prod");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Preflight + CORS per Platform API (Back Office Flutter web cross-origin).
  if (pathname.startsWith("/api/platform/")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: PLATFORM_CORS });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(PLATFORM_CORS)) {
      res.headers.set(k, v);
    }
    return res;
  }

  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.next();

  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.formazioneOnly !== true) return NextResponse.next();

    if (isFormazioneOnlyPath(pathname)) return NextResponse.next();

    return NextResponse.redirect(new URL("/formazione/progressi", request.url));
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/api/platform/:path*",
    "/((?!api|login|attiva-account|cambia-password|seleziona-postazione|setup-sedi|_next/static|_next/image|favicon.ico).*)",
  ],
};
