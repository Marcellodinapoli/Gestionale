import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { loadMemoAlertsForUser } from "@/lib/agenda/loadMemoAlerts";

export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await loadMemoAlertsForUser(user));
}
