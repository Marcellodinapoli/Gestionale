import { NextResponse } from "next/server";
import { endUserSession } from "@/lib/sessionLogout";

/** Logout via fetch/sendBeacon (chiusura finestra / tab). Solo POST: niente GET (prefetch). */
export async function POST(request: Request) {
  await endUserSession();
  const url = new URL(request.url);
  if (url.searchParams.get("redirect") === "login") {
    return NextResponse.redirect(new URL("/login", url.origin));
  }
  return new NextResponse(null, { status: 204 });
}
