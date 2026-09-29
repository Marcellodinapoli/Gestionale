import { NextResponse } from "next/server";
import { endUserSession } from "@/lib/sessionLogout";

/** Logout via fetch/sendBeacon (chiusura finestra / tab). Solo POST: niente GET (prefetch). */
export async function POST() {
  await endUserSession();
  return new NextResponse(null, { status: 204 });
}
