import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { loadPreavvisoStragiudizialeSummary } from "@/lib/agenda/loadPreavvisoStragiudiziale";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await loadPreavvisoStragiudizialeSummary(user));
}
