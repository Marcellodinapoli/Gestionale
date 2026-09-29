import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isFormazioneOnlyPath } from "@/lib/formazioneOnlyAccess";
import { isPasswordExpired } from "@/lib/passwordRules";

const COOKIE = "gestionale_session";

const PLATFORM_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

/** Pagine consentite con password scaduta (solo cambio password / uscita). */
function allowsExpiredPassword(pathname: string) {
  return (
    pathname === "/cambia-password" ||
    pathname.startsWith("/cambia-password/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/attiva-account" ||
    pathname.startsWith("/attiva-account/")
  );
}

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

    // Password scaduta: niente gestionale finché non si cambia (tutti i ruoli).
    if (
      !allowsExpiredPassword(pathname) &&
      isPasswordExpired(
        typeof payload.passwordChangedAt === "string"
          ? payload.passwordChangedAt
          : null
      )
    ) {
      return NextResponse.redirect(new URL("/cambia-password", request.url));
    }

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
    // Inclusi setup-sedi e seleziona-postazione: con password scaduta → /cambia-password.
    "/((?!api|login|attiva-account|cambia-password|_next/static|_next/image|favicon.ico).*)",
  ],
};
