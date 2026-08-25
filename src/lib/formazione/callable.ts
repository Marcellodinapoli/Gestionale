import { httpsCallable } from "firebase/functions";
import type { Functions } from "firebase/functions";
import { FIREBASE_FUNCTIONS_REGION, firebaseConfig } from "@/lib/firebase/config";

export async function callFormazioneFunction<T = unknown>(
  functions: Functions,
  name: string,
  data: Record<string, unknown>
): Promise<T> {
  const fn = httpsCallable(functions, name, {
    limitedUseAppCheckTokens: false,
  });
  const result = await fn(data);
  return result.data as T;
}

export function functionsBaseUrl() {
  return `https://${FIREBASE_FUNCTIONS_REGION}-${firebaseConfig.projectId}.cloudfunctions.net`;
}
