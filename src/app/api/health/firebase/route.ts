import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getFirebaseFirestore } = await import("@/lib/firebase/admin");
    const db = getFirebaseFirestore();
    const snap = await db.collection("credixa").limit(1).get();
    const hasJson = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
    const hasPath = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim());
    return NextResponse.json({
      ok: true,
      firestore: "connected",
      sampleDocs: snap.size,
      credentials: hasJson ? "json" : hasPath ? "path" : "missing",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore Firebase sconosciuto";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hasJson: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
        hasPath: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim()),
      },
      { status: 500 }
    );
  }
}
