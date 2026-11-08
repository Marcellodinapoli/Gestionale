import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isConnectorProvider, isNeonProvider } from "@/lib/data/factory";
import { createNeonDialerDb, type DialerDb } from "@/lib/neon/neonDialerDb";
import type { SessionUser } from "@/lib/permissions";

const CONNECTOR_DIALER_MSG =
  "Predictive dialer non ancora disponibile con DATABASE_PROVIDER=connector. Usa neon o firestore.";

function dialerDbFromPrismaTx(tx: Prisma.TransactionClient): DialerDb {
  return {
    dialerCampagna: tx.dialerCampagna,
    dialerCampagnaOperatore: tx.dialerCampagnaOperatore,
    dialerCampagnaPratica: tx.dialerCampagnaPratica,
    dialerChiamataEvento: tx.dialerChiamataEvento,
    $transaction: <T>(inner: (t: DialerDb) => Promise<T>) => inner(dialerDbFromPrismaTx(tx)),
  };
}

function prismaDialerDb(): DialerDb {
  return {
    dialerCampagna: prisma.dialerCampagna,
    dialerCampagnaOperatore: prisma.dialerCampagnaOperatore,
    dialerCampagnaPratica: prisma.dialerCampagnaPratica,
    dialerChiamataEvento: prisma.dialerChiamataEvento,
    $transaction: <T>(fn: (tx: DialerDb) => Promise<T>) =>
      prisma.$transaction((tx) => fn(dialerDbFromPrismaTx(tx))),
  };
}

function resolveDialerDb(ctx: { tenantId: string; user?: SessionUser }): DialerDb {
  if (isConnectorProvider()) throw new Error(CONNECTOR_DIALER_MSG);
  if (isNeonProvider()) return createNeonDialerDb(ctx);
  return prismaDialerDb();
}

/** Accesso dialer con scope utente (liste campagne, CRUD autorizzato). */
export function dialerDbFromUser(user: SessionUser): DialerDb {
  return resolveDialerDb({
    tenantId: user.tenantId,
    user,
  });
}

/** Accesso dialer per tenant (webhook, statistiche per campagnaId). */
export function dialerDbForTenant(tenantId: string, _tenantSlug?: string): DialerDb {
  void _tenantSlug;
  return resolveDialerDb({ tenantId });
}

/** Operazioni dialer senza contesto tenant (query per campagnaId). */
export function dialerDb(): DialerDb {
  return resolveDialerDb({ tenantId: "" });
}

export type { DialerDb };
