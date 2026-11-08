import { NextResponse } from "next/server";

import { configurazioneDbForTenant } from "@/lib/configurazioneRepo";
import { dialerDbForTenant } from "@/lib/dialerRepo";

import { registerDialerCallEvent } from "@/lib/predictive-dialer/callEvents";

import { DIALER_CONFIG_CATEGORIA, DIALER_CONFIG_WEBHOOK_SECRET } from "@/lib/predictive-dialer/constants";

import type { SessionUser } from "@/lib/permissions";



/** Webhook per eventi dal dialer esterno (autenticazione via secret in configurazione). */

export async function POST(req: Request) {

  const secret = req.headers.get("x-dialer-secret") || "";

  const body = (await req.json()) as {

    tenantId?: string;

    campagnaId?: string;

    operatoreId?: string;

    praticaId?: string;

    numero?: string;

    tipo?: string;

    esito?: string;

    durataSec?: number;

    callId?: string;

    externalCallId?: string;

    providerEventId?: string;

    metadata?: Record<string, unknown>;

  };



  if (!body.tenantId || !body.campagnaId || !body.tipo) {

    return NextResponse.json({ error: "Payload incompleto" }, { status: 400 });

  }



  const cfg = await configurazioneDbForTenant(body.tenantId).findUnique({
    where: {
      tenantId_chiave: {
        tenantId: body.tenantId,
        chiave: DIALER_CONFIG_WEBHOOK_SECRET,
      },
    },
  });

  const expected = cfg?.valore?.trim();

  if (!expected || secret !== expected) {

    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

  }



  const campagna = await dialerDbForTenant(body.tenantId).dialerCampagna.findFirst({
    where: { id: body.campagnaId, tenantId: body.tenantId },
  });

  if (!campagna) {

    return NextResponse.json({ error: "Campagna non trovata" }, { status: 404 });

  }



  const pseudoUser = {

    id: body.operatoreId ?? "system",

    tenantId: body.tenantId,

    role: "ADMIN",

  } as SessionUser;



  const result = await registerDialerCallEvent(pseudoUser, {

    campagnaId: body.campagnaId,

    operatoreId: body.operatoreId,

    praticaId: body.praticaId,

    numero: body.numero,

    tipo: body.tipo as "iniziata",

    esito: body.esito,

    durataSec: body.durataSec,

    callId: body.callId,

    externalCallId: body.externalCallId,

    providerEventId: body.providerEventId,

    metadata: body.metadata,

    affidaSeCollegata: body.tipo === "collegata",

  });



  return NextResponse.json(result);

}

