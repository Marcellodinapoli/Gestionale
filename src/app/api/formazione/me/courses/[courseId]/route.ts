import { NextResponse } from "next/server";
import { requireApiModule, requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { resolveOwnFirebaseUid } from "@/lib/formazione/collaboratorAccess";
import { loadCollaboratorCourseDetail } from "@/lib/formazione/collaboratorProgress";
import { getFirebaseFirestore } from "@/lib/firebase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const userOrRes = await requireApiUser();
  if (userOrRes instanceof NextResponse) return userOrRes;

  try {
    assertCan(userOrRes, "formazione:view");
  } catch {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }
  const moduleDenied = await requireApiModule(userOrRes, "formazione");
  if (moduleDenied) return moduleDenied;

  const { courseId } = await params;
  const uid = await resolveOwnFirebaseUid(userOrRes);
  if (!uid) {
    return NextResponse.json(
      { error: "Sessione formazione non collegata" },
      { status: 403 }
    );
  }

  try {
    const course = await loadCollaboratorCourseDetail(
      getFirebaseFirestore(),
      uid,
      decodeURIComponent(courseId)
    );
    if (!course) {
      return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
    }
    return NextResponse.json({ course });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore caricamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
