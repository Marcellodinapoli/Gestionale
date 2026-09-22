import "server-only";
import { revalidatePath } from "next/cache";
import type { ReceiverCandidate } from "@/lib/recruiting/receiver";
import { mapIndeedApplyToCandidaturaUpsert } from "@/lib/recruiting/indeedApplyMapper";
import type { IndeedApplyApplication } from "@/lib/recruiting/indeedApply";
import {
  findCandidaturaByContactOnOfferta,
  findCandidaturaByExternalApplicationId,
  upsertCandidaturaFromReceiver,
} from "@/lib/recruiting/candidatureRepo";
import { findOffertaByIndeedJobId } from "@/lib/recruiting/offerteRepo";

const SYSTEM_USER = "receiver-push";

export function receiverCandidateToIndeedApply(
  c: ReceiverCandidate,
  sourceName?: string
): IndeedApplyApplication {
  return {
    applicationId: c.externalApplicationId,
    jobId: c.indeedJobId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    emailVerified: c.emailVerified,
    phoneNumber: c.phone,
    coverletter: c.coverLetter,
    resume: c.resumeMeta
      ? {
          present: Boolean(c.resumeMeta.present),
          fileName: c.resumeMeta.fileName,
          contentType: c.resumeMeta.contentType,
          documentId: c.resumeMeta.documentId,
          receiverDocumentRef: c.cvRef ?? null,
        }
      : c.cvRef
        ? { present: true, receiverDocumentRef: c.cvRef }
        : null,
    source: sourceName || "indeed",
  };
}

/**
 * Ingest istantaneo di una candidatura Receiver in Credixa (create/update).
 * Nessun CV persistito.
 */
export async function ingestReceiverCandidatePush(input: {
  tenantId: string;
  candidate: ReceiverCandidate;
  sourceName?: string | null;
  userId?: string;
}): Promise<{ outcome: "created" | "updated"; candidaturaId: string }> {
  const tenantId = String(input.tenantId || "").trim();
  const applicationId = String(
    input.candidate.externalApplicationId || ""
  ).trim();
  const indeedJobId = String(input.candidate.indeedJobId || "").trim();
  if (!tenantId || !applicationId || !indeedJobId) {
    throw new Error("tenantId, externalApplicationId e indeedJobId obbligatori");
  }

  const offerta = await findOffertaByIndeedJobId(tenantId, indeedJobId);
  if (!offerta || offerta.tenantId !== tenantId) {
    throw new Error(`Offerta non trovata per indeedJobId «${indeedJobId}»`);
  }

  const existing = await findCandidaturaByExternalApplicationId(
    tenantId,
    applicationId
  );
  const byContact =
    existing ||
    (await findCandidaturaByContactOnOfferta(tenantId, offerta.id, {
      email: input.candidate.email,
      phone: input.candidate.phone,
    }));

  const indeedApp = receiverCandidateToIndeedApply(
    input.candidate,
    input.sourceName || undefined
  );
  const mapped = await mapIndeedApplyToCandidaturaUpsert(
    indeedApp,
    { tenantId },
    {
      findOffertaByIndeedJobId: async (tid, jid) => {
        if (tid !== tenantId || jid !== indeedJobId) return null;
        return offerta;
      },
    }
  );

  const upsertInput = {
    ...mapped.upsert,
    receiverCandidateId: input.candidate.receiverCandidateId,
  };

  const row = await upsertCandidaturaFromReceiver(
    tenantId,
    upsertInput,
    String(input.userId || SYSTEM_USER).trim() || SYSTEM_USER
  );

  revalidatePath("/recruiting");
  revalidatePath(`/recruiting/offerte/${offerta.id}`);
  if (row.id) {
    revalidatePath(`/recruiting/offerte/${offerta.id}/${row.id}`);
  }

  return {
    outcome: byContact ? "updated" : "created",
    candidaturaId: row.id,
  };
}
