import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { isFormazioneOnlyPath } from "@/lib/formazioneOnlyAccess";

const COOKIE = "gestionale_session";

function secret() {
  const value = process.env.SESSION_SECRET || "dev-only-secret-not-for-prod";
  return new TextEncoder().encode(value);
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.next();

  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.formazioneOnly !== true) return NextResponse.next();

    const pathname = request.nextUrl.pathname;
    if (isFormazioneOnlyPath(pathname)) return NextResponse.next();

    return NextResponse.redirect(new URL("/formazione/progressi", request.url));
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!api|login|cambia-password|seleziona-postazione|_next/static|_next/image|favicon.ico).*)",
  ],
};
