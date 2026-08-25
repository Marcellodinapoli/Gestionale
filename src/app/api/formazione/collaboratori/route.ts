import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { listCollaboratorsForSupervisor } from "@/lib/formazione/collaboratorAccess";

export async function GET() {
  const userOrRes = await requireApiUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    assertCan(userOrRes, "formazione:view");
    if (userOrRes.role !== "SUPERVISOR" && userOrRes.role !== "ADMIN") {
      return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  try {
    const collaboratori = await listCollaboratorsForSupervisor(userOrRes);
    return NextResponse.json({ collaboratori });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore caricamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
