/**
 * Test sync Indeed Apply FASE 4.
 * Esegui: npx tsx --import ./scripts/test-hooks/register.mjs scripts/test-indeed-apply-sync.ts
 */
import "./test-hooks/register.mjs";
import type { OffertaLavoroRecord } from "../src/lib/recruiting/offerte";
import type { ReceiverCandidate } from "../src/lib/recruiting/receiver";
import { ReceiverClientError } from "../src/lib/recruiting/receiver";
import type {
  RecruitingCandidaturaRecord,
  RecruitingCandidaturaReceiverUpsertInput,
} from "../src/lib/recruiting/candidature";
import {
  IndeedSyncError,
  openIndeedCandidateCv,
  syncIndeedApplicationsForOfferta,
} from "../src/lib/recruiting/indeedApplySync";

type TestResult = { name: string; pass: boolean; detail?: string };
const results: TestResult[] = [];

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

const offerta: OffertaLavoroRecord = {
  id: "off-1",
  tenantId: "tenant-a",
  titolo: "Dev",
  luogo: "Roma",
  modalitaLavoro: "REMOTO",
  tipoContratto: "TEMPO_INDETERMINATO",
  orario: "FULL_TIME",
  numeroPosizioni: 1,
  descrizione: "",
  attivitaPrincipali: "",
  requisiti: "",
  competenze: "",
  retribuzione: "",
  benefit: "",
  paese: "IT",
  stato: "PUBBLICATA",
  indeedJobId: "job-111",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const receiverCfg = {
  id: "r1",
  tenantId: "tenant-a",
  baseUrl: "https://receiver.example.com",
  status: "ACTIVE" as const,
  sourceName: "indeed",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeCandidate(
  overrides: Partial<ReceiverCandidate> = {}
): ReceiverCandidate {
  return {
    receiverCandidateId: "rc-1",
    externalApplicationId: "app-1",
    indeedJobId: "job-111",
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario@example.com",
    emailVerified: true,
    phone: "+39 333",
    coverLetter: "Ciao",
    receivedAt: "2026-01-01T00:00:00Z",
    resumeMeta: {
      present: true,
      fileName: "cv.pdf",
      contentType: "application/pdf",
      documentId: "doc-1",
    },
    cvRef: "receiver://docs/doc-1",
    ...overrides,
  };
}

function makeStore() {
  const byExt = new Map<string, RecruitingCandidaturaRecord>();
  const persistedUrls: string[] = [];

  return {
    persistedUrls,
    byExt,
    deps: {
      getOffertaLavoro: async (tenantId: string, offertaId: string) => {
        if (tenantId !== "tenant-a" || offertaId !== "off-1") return null;
        return offerta;
      },
      getReceiverConfig: async (tenantId: string) =>
        tenantId === "tenant-a" ? receiverCfg : null,
      listApplications: async () => [] as ReceiverCandidate[],
      findByExternalApplicationId: async (
        tenantId: string,
        externalApplicationId: string
      ) => {
        if (tenantId !== "tenant-a") return null;
        return byExt.get(externalApplicationId) ?? null;
      },
      upsertFromReceiver: async (
        tenantId: string,
        input: RecruitingCandidaturaReceiverUpsertInput,
        _userId: string
      ) => {
        if (tenantId !== "tenant-a") throw new Error("tenant");
        // J: nessun campo CV nel persist
        const forbidden = ["resume", "base64", "openUrl", "cvRef", "resumeText"];
        for (const k of forbidden) {
          if (k in (input as object)) throw new Error(`CV field leaked: ${k}`);
        }
        const existing = byExt.get(input.externalApplicationId);
        const now = new Date();
        const row: RecruitingCandidaturaRecord = {
          id: existing?.id || `cand-${input.externalApplicationId}`,
          tenantId,
          offertaId: input.offertaId,
          externalApplicationId: input.externalApplicationId,
          receiverCandidateId: input.receiverCandidateId ?? null,
          cognome: input.cognome,
          nome: input.nome,
          email: input.email ?? null,
          emailVerified: input.emailVerified ?? null,
          phone: input.phone ?? null,
          coverLetter: input.coverLetter ?? null,
          stato: existing?.stato || "RICEVUTA",
          source: input.source ?? null,
          receivedAt: existing?.receivedAt || now,
          updatedAt: now,
          lastSyncAt: now,
        };
        byExt.set(input.externalApplicationId, row);
        return row;
      },
      getCandidatura: async (tenantId: string, id: string) => {
        for (const row of byExt.values()) {
          if (row.tenantId === tenantId && row.id === id) return row;
        }
        return null;
      },
      getCvOpenUrl: async (tenantId: string, receiverCandidateId: string) => {
        if (tenantId !== "tenant-a") {
          throw new ReceiverClientError("TENANT_UNAUTHORIZED", "no");
        }
        const url = `https://receiver.example.com/tmp/${receiverCandidateId}?sig=1`;
        return { openUrl: url, expiresAt: "2099-01-01T00:00:00Z" };
      },
      log: () => undefined,
    },
  };
}

async function main() {
  // A — CREATE
  {
    const store = makeStore();
    store.deps.listApplications = async () => [makeCandidate()];
    const r = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    record(
      "A. candidatura valida → CREATE",
      r.created === 1 && r.updated === 0 && store.byExt.size === 1
    );
  }

  // B — doppia sync → una sola
  {
    const store = makeStore();
    store.deps.listApplications = async () => [makeCandidate()];
    await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    const r2 = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    record(
      "B. sync due volte → una sola candidatura",
      store.byExt.size === 1 && r2.created === 0 && r2.updated === 1
    );
  }

  // C — UPDATE + lastSyncAt
  {
    const store = makeStore();
    store.deps.listApplications = async () => [makeCandidate()];
    await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    const firstSync = store.byExt.get("app-1")!.lastSyncAt!;
    await new Promise((r) => setTimeout(r, 5));
    store.deps.listApplications = async () => [
      makeCandidate({ firstName: "Mario", phone: "+39 999" }),
    ];
    const r = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    const after = store.byExt.get("app-1")!;
    record(
      "C. esistente → UPDATE + lastSyncAt",
      r.updated === 1 &&
        after.phone === "+39 999" &&
        after.lastSyncAt != null &&
        after.lastSyncAt.getTime() >= firstSync.getTime()
    );
  }

  // D — applicationId mancante
  {
    const store = makeStore();
    store.deps.listApplications = async () => [
      makeCandidate({ externalApplicationId: "" }),
    ];
    const r = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    record(
      "D. applicationId mancante → error/skip",
      r.errors >= 1 && store.byExt.size === 0 &&
        r.items.some((i) => i.code === "MISSING_APPLICATION_ID")
    );
  }

  // E — indeedJobId mancante sulla candidatura
  {
    const store = makeStore();
    store.deps.listApplications = async () => [
      makeCandidate({ indeedJobId: "" }),
    ];
    const r = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    record(
      "E. indeedJobId mancante → error/skip",
      r.items.some((i) => i.code === "MISSING_JOB_ID") && store.byExt.size === 0
    );
  }

  // F — job mismatch
  {
    const store = makeStore();
    store.deps.listApplications = async () => [
      makeCandidate({ indeedJobId: "altro-job" }),
    ];
    const r = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    record(
      "F. job mismatch → skip/error",
      r.items.some((i) => i.code === "JOB_MISMATCH") && store.byExt.size === 0
    );
  }

  // G — altro tenant
  {
    const store = makeStore();
    try {
      await syncIndeedApplicationsForOfferta(
        { tenantId: "tenant-b", offertaId: "off-1", userId: "u1" },
        store.deps
      );
      record("G. altro tenant → rifiutata", false);
    } catch (e) {
      const ok =
        e instanceof IndeedSyncError && e.code === "OFFERTA_NOT_FOUND";
      record("G. altro tenant → rifiutata", ok, ok ? e.code : String(e));
    }
  }

  // H — Receiver offline
  {
    const store = makeStore();
    store.deps.listApplications = async () => {
      throw new ReceiverClientError("OFFLINE", "down");
    };
    try {
      await syncIndeedApplicationsForOfferta(
        { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
        store.deps
      );
      record("H. Receiver offline → errore controllato", false);
    } catch (e) {
      const ok =
        e instanceof IndeedSyncError && e.code === "RECEIVER_ERROR";
      record(
        "H. Receiver offline → errore controllato",
        ok,
        ok ? e.code : String(e)
      );
    }
  }

  // I — una errata non blocca le altre
  {
    const store = makeStore();
    store.deps.listApplications = async () => [
      makeCandidate({ externalApplicationId: "" }),
      makeCandidate({
        externalApplicationId: "app-ok",
        receiverCandidateId: "rc-ok",
      }),
    ];
    const r = await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    record(
      "I. una errata non blocca le altre",
      r.created === 1 && r.errors >= 1 && store.byExt.has("app-ok")
    );
  }

  // J — CV presente ma nessun file salvato
  {
    const store = makeStore();
    store.deps.listApplications = async () => [makeCandidate()];
    await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    const row = store.byExt.get("app-1")!;
    const json = JSON.stringify(row);
    record(
      "J. CV presente → nessun file in Credixa",
      row.receiverCandidateId === "rc-1" &&
        !json.includes("base64") &&
        !json.includes("cv.pdf") &&
        !json.includes("receiver://")
    );
  }

  // K + L — apertura CV URL temporaneo non persistito
  {
    const store = makeStore();
    store.deps.listApplications = async () => [makeCandidate()];
    await syncIndeedApplicationsForOfferta(
      { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
      store.deps
    );
    const cand = store.byExt.get("app-1")!;
    let openedUrl: string | null = null;
    store.deps.getCvOpenUrl = async (tid, rcid) => {
      openedUrl = `https://receiver.example.com/tmp/${rcid}?sig=xyz`;
      return { openUrl: openedUrl, expiresAt: "2099-01-01T00:00:00Z" };
    };
    const opened = await openIndeedCandidateCv(
      { tenantId: "tenant-a", candidaturaId: cand.id },
      store.deps
    );
    const afterJson = JSON.stringify([...store.byExt.values()]);
    record(
      "K. apertura CV → URL temporaneo dal Receiver",
      opened.openUrl.includes("/tmp/") && openedUrl === opened.openUrl
    );
    record(
      "L. URL CV non persistito",
      !afterJson.includes(opened.openUrl) && !afterJson.includes("sig=xyz")
    );
  }

  // M — utente non autorizzato (tenant/user vuoti)
  {
    try {
      const store = makeStore();
      await syncIndeedApplicationsForOfferta(
        { tenantId: "", offertaId: "off-1", userId: "u1" },
        store.deps
      );
      record("M. non autorizzato → rifiutata", false);
    } catch (e) {
      const ok =
        e instanceof IndeedSyncError && e.code === "UNAUTHORIZED";
      record("M. non autorizzato → rifiutata", ok, ok ? e.code : String(e));
    }
  }

  // Extra: offerta senza indeedJobId
  {
    const store = makeStore();
    store.deps.getOffertaLavoro = async () => ({
      ...offerta,
      indeedJobId: null,
    });
    try {
      await syncIndeedApplicationsForOfferta(
        { tenantId: "tenant-a", offertaId: "off-1", userId: "u1" },
        store.deps
      );
      record("offerta senza indeedJobId → errore", false);
    } catch (e) {
      const ok =
        e instanceof IndeedSyncError && e.code === "INDEED_JOB_ID_MISSING";
      record(
        "offerta senza indeedJobId → errore",
        ok,
        ok ? e.code : String(e)
      );
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passati`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
