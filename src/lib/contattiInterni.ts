/** Interno telefonico demo, stabile per utente (in attesa di campo anagrafica reale). */
export function internoFittizio(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return String(210 + (h % 790));
}
