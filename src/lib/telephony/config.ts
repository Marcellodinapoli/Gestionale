import { cache } from "react";

import { configurazioneDbForTenant } from "@/lib/configurazioneRepo";

import { getCurrentUser } from "@/lib/auth";

import { resolveTenantSlugForConnector } from "@/lib/tenant";

import {

  parseTenantTelephonyConfig,

  toDialClientConfig,

  type DialClientConfig,

  type TenantTelephonyConfig,

} from "@/lib/telephony/clientConfig";



export {

  normalizeVoipProvider,

  normalizeSoftphoneProtocol,

  parseTenantTelephonyConfig,

  toDialClientConfig,

  type SoftphoneProtocol,

  type VoipProviderKey,

  type TenantTelephonyConfig,

  type DialClientConfig,

} from "@/lib/telephony/clientConfig";



export const getTenantTelephonyConfig = cache(

  async (

    tenantId?: string,

    tenantSlug?: string | null

  ): Promise<TenantTelephonyConfig> => {

    const user = await getCurrentUser();

    const tid = tenantId ?? user?.tenantId;

    if (!tid) {

      return parseTenantTelephonyConfig({});

    }



    const slug = await resolveTenantSlugForConnector(

      tid,

      tenantSlug ?? user?.tenantSlug

    );



    const rows = await configurazioneDbForTenant(tid, slug).findMany({

      where: {

        tenantId: tid,

        OR: [

          { chiave: { startsWith: "voip_" } },

          { chiave: { in: ["db_vpn_host", "db_vpn_tipo"] } },

        ],

      },

      select: { chiave: true, valore: true },

    });



    const map: Record<string, string> = {};

    for (const r of rows) map[r.chiave] = r.valore;

    return parseTenantTelephonyConfig(map);

  }

);



export const getDialClientConfig = cache(

  async (

    tenantId?: string,

    tenantSlug?: string | null

  ): Promise<DialClientConfig> => {

    return toDialClientConfig(await getTenantTelephonyConfig(tenantId, tenantSlug));

  }

);


