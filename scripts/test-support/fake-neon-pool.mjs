// Sostituto di @/lib/neon/pool nei test: delega a un handler registrato dal test.
export async function neonQuery(text, params = []) {
  if (typeof globalThis.__fakeNeonQuery !== "function") throw new Error("fake neon non configurato");
  return globalThis.__fakeNeonQuery(text, params);
}
export function getNeonPool() {
  throw new Error("pool non disponibile nei test");
}
