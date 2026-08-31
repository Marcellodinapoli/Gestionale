import "server-only";
import { can, isManutenzione, type SessionUser } from "@/lib/permissions";
import {
  MEMO_ALERT_GRACE_MINUTES,
  MEMO_ALERT_MINUTES_BEFORE,
} from "@/lib/memoAlerts";
import { buildAgendaScopeContext } from "@/lib/agenda/buildAgendaScope";
import { loadMemoAlertsRawAuto } from "@/lib/agenda/loadAgenda";
import { formatMemoAlertsFromBundle } from "@/lib/agenda/formatMemoAlerts";

export async function loadMemoAlertsForUser(user: SessionUser) {
  if (isManutenzione(user)) return { alerts: [], total: 0 };

  const now = new Date();
  const memoAtGte = new Date(now.getTime() - MEMO_ALERT_GRACE_MINUTES * 60_000);
  const memoAtLte = new Date(now.getTime() + MEMO_ALERT_MINUTES_BEFORE * 60_000);
  const ctx = await buildAgendaScopeContext(user);

  const raw = await loadMemoAlertsRawAuto(ctx, user, {
    impegniUserId: user.id,
    canAgenda: can(user, "agenda:view"),
    memoAtGte,
    memoAtLte,
  });

  return formatMemoAlertsFromBundle(raw, now);
}
