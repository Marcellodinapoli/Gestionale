import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { assertSupervisorCanViewFirebaseUid } from "@/lib/formazione/collaboratorAccess";
import { loadCollaboratorCourseDetail } from "@/lib/formazione/collaboratorProgress";
import { getFirebaseFirestore } from "@/lib/firebase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uid: string; courseId: string }> }
) {
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

  const { uid, courseId } = await params;

  try {
    await assertSupervisorCanViewFirebaseUid(userOrRes, uid);
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
    const status = message.includes("Non autorizzato") ? 403 : 404;
    return NextResponse.json({ error: message }, { status });
  }
}
