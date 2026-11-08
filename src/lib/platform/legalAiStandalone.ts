import {
  ADDON_ONLY_ADMIN_HREFS,
  isLegalAiStandaloneTenant as isLegalAiStandaloneTenantImpl,
} from "@/lib/platform/addonOnlyTenantNav";

/** @deprecated Usare ADDON_ONLY_ADMIN_HREFS — stesso set per tutti gli add-on senza recovery. */
export const LEGAL_AI_STANDALONE_ADMIN_HREFS = ADDON_ONLY_ADMIN_HREFS;

export const isLegalAiStandaloneTenant = isLegalAiStandaloneTenantImpl;

export {
  ADDON_ONLY_ADMIN_HREFS,
  addonOnlyMainNavHrefs,
  isAddonOnlyTenant,
  isRecruitingStandaloneTenant,
} from "@/lib/platform/addonOnlyTenantNav";
