import { NextResponse } from "next/server";
import { requireApiModule, requireApiUser } from "@/lib/guard";
import { assertCan } from "@/lib/permissions";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import { checkFirebaseOrError } from "@/lib/formazione/firebaseGuard";
import {
  CATEGORY_RECUPERO,
  CATEGORY_SOLLECITO,
} from "@/lib/formazione/courseLabels";

function tsMillis(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  if ("toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis() as number;
  }
  return 0;
}

export async function GET(req: Request) {
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

  const category = new URL(req.url).searchParams.get("category")?.trim();
  if (
    category &&
    category !== CATEGORY_SOLLECITO &&
    category !== CATEGORY_RECUPERO
  ) {
    return NextResponse.json({ error: "Categoria non valida" }, { status: 400 });
  }

  try {
    const db = getFirebaseFirestore();
    const snap = category
      ? await db.collection("courses").where("category", "==", category).get()
      : await db.collection("courses").get();

    const items = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: String(data.title ?? "—"),
          description: String(data.description ?? ""),
          category: String(data.category ?? ""),
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          contents: Array.isArray(data.contents) ? data.contents.map(String) : [],
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
          createdAtMs: tsMillis(data.createdAt),
        };
      })
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore caricamento corsi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
