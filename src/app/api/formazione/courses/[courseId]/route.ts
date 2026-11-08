import { NextResponse } from "next/server";
import { requireApiModule, requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import { checkFirebaseOrError } from "@/lib/formazione/firebaseGuard";

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

  const fbError = checkFirebaseOrError();
  if (fbError) return fbError;

  const { courseId } = await params;
  const id = decodeURIComponent(courseId);

  try {
    const snap = await getFirebaseFirestore().collection("courses").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Corso non trovato" }, { status: 404 });
    }
    const data = snap.data()!;
    return NextResponse.json({
      id: snap.id,
      title: String(data.title ?? ""),
      description: String(data.description ?? ""),
      category: String(data.category ?? ""),
      videoUrl: data.videoUrl ? String(data.videoUrl) : null,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      contents: Array.isArray(data.contents) ? data.contents.map(String) : [],
      attachments: Array.isArray(data.attachments) ? data.attachments : [],
      quiz: data.quiz ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore caricamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
