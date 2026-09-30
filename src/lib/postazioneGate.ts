import "server-only";
import { cookies } from "next/headers";

/** Cookie di sessione: admin/amm/bk off entrati senza desk (tutte occupate). */
const COOKIE = "gestionale_postazione_skip";

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function setPostazioneSkip(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, "1", cookieOpts());
}

export async function clearPostazioneSkip(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function hasPostazioneSkip(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value === "1";
}
