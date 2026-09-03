import { Card, PageHeader } from "@/components/ui";
import { saveDialerIntegrationConfigAction } from "@/actions/predictiveDialer";
import { requirePermission } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import {
  DIALER_CONFIG_API_BASE,
  DIALER_CONFIG_CATEGORIA,
  DIALER_CONFIG_PROVIDER,
  DIALER_CONFIG_WEBHOOK_SECRET,
} from "@/lib/predictive-dialer/constants";
import {
  FILTRI_APPLY_BUTTON_CLASS,
  FILTRI_PAGE_INPUT_CLASS,
  FILTRI_PAGE_SELECT_CLASS,
} from "@/components/filtri/filtriFieldStyles";

export default async function PredictiveDialerAdminPage() {
  const user = await requirePermission("dialer:admin");
  const rows = await prisma.configurazioneSistema.findMany({
    where: { tenantId: user.tenantId, categoria: DIALER_CONFIG_CATEGORIA },
  });
  const map = Object.fromEntries(rows.map((r) => [r.chiave, r.valore]));

  return (
    <>
      <PageHeader
        title="Configurazione Predictive Dialer"
        subtitle="Integrazione con provider VoIP/dialer esterno (API predisposte, provider da collegare)."
      />
      <Card title="Provider dialer">
        <form action={saveDialerIntegrationConfigAction} className="max-w-lg space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Provider</span>
            <select
              name="provider"
              defaultValue={map[DIALER_CONFIG_PROVIDER] || "null"}
              className={FILTRI_PAGE_SELECT_CLASS}
            >
              <option value="null">Nessuno (locale / stub)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">API base URL</span>
            <input
              name="apiBaseUrl"
              defaultValue={map[DIALER_CONFIG_API_BASE] || ""}
              placeholder="https://…"
              className={`${FILTRI_PAGE_INPUT_CLASS} w-full`}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Webhook secret</span>
            <input
              name="webhookSecret"
              defaultValue={map[DIALER_CONFIG_WEBHOOK_SECRET] || ""}
              className={`${FILTRI_PAGE_INPUT_CLASS} w-full`}
            />
          </label>
          <p className="text-xs text-[var(--muted)]">
            Webhook eventi: <code>POST /api/predictive-dialer/webhook</code> con header{" "}
            <code>x-dialer-secret</code>
          </p>
          <button type="submit" className={FILTRI_APPLY_BUTTON_CLASS}>
            Salva configurazione
          </button>
        </form>
      </Card>
    </>
  );
}
