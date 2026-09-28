import "server-only";
import {
  getTenantPlatformConfig,
  tenantHasModule,
} from "@/lib/platform/tenantProfile";

export const CREDITCALC_MODULE_DISABLED_MSG =
  "CreditCalc non attivo per questa azienda. Contattare amministrazione.";

/** Pacchetto CreditCalc attivo nel Back Office per il tenant. */
export async function isTenantCreditCalcEnabled(
  tenantId: string
): Promise<boolean> {
  const platform = await getTenantPlatformConfig(tenantId);
  return tenantHasModule(platform, "creditcalc");
}

export async function assertTenantCreditCalcModule(
  tenantId: string
): Promise<
  | { ok: true }
  | { ok: false; error: string; status: number }
> {
  if (await isTenantCreditCalcEnabled(tenantId)) return { ok: true };
  return {
    ok: false,
    error: CREDITCALC_MODULE_DISABLED_MSG,
    status: 403,
  };
}
