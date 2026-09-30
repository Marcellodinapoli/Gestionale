import "server-only";
import { clearSession, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/domain";
import { usersDbFromUser } from "@/lib/usersRepo";
import { releaseAllUserLocks, lockScopeFromUser } from "@/lib/praticaLock";
import { clearPostazioneSkip } from "@/lib/postazioneGate";

/**
 * Termina la sessione per tutti i ruoli: rilascia lock, cancella cookie,
 * registra lastLogoutAt + audit. Rilascia la postazione se non fissa
 * (così rubrica e occupazione coincidono con chi è davvero loggato).
 * Idempotente se già scollegati.
 */
export async function endUserSession(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    try {
      await releaseAllUserLocks(user.id, lockScopeFromUser(user));
    } catch {
      /* best-effort: il logout non deve fallire per un lock */
    }
  }
  await clearSession();
  try {
    await clearPostazioneSkip();
  } catch {
    /* ignore */
  }
  if (!user) return;
  try {
    await Promise.all([
      usersDbFromUser(user).update({
        where: { id: user.id },
        data: {
          lastLogoutAt: new Date(),
          // Postazione non fissa = assegnazione di sessione: va liberata.
          ...(!user.postazioneFissa ? { postazioneId: null } : {}),
        },
      }),
      writeAudit({
        userId: user.id,
        action: "logout",
        entity: "user",
        entityId: user.id,
      }),
    ]);
  } catch {
    /* best-effort su chiusura finestra / beacon */
  }
}
