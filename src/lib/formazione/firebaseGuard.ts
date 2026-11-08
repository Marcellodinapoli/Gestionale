import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function isFirebaseAvailable(): boolean {
  // Controlla JSON inline
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      JSON.parse(inline);
      return true;
    } catch {
      return false;
    }
  }

  // Controlla file path - verifica che il file esista realmente
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  
  if (filePath) {
    const absolute = resolve(process.cwd(), filePath);
    return existsSync(absolute) || existsSync(filePath);
  }

  return false;
}

export function checkFirebaseOrError(): NextResponse | null {
  if (!isFirebaseAvailable()) {
    return NextResponse.json(
      {
        error:
          "Formazione non disponibile: Firebase non è configurato su questo server. Contatta l'amministratore di sistema.",
      },
      { status: 503 }
    );
  }
  return null;
}
