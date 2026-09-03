/**
 * Test scenari resilienza Predictive Dialer.
 * Esegui: npx tsx scripts/test-predictive-dialer.ts
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./test-hooks/server-only-hook.mjs", pathToFileURL("./scripts/"));

async function main() {
const { PrismaClient } = await import("@prisma/client");
const { registerDialerCallEvent } = await import("../src/lib/predictive-dialer/callEvents");
const { releaseExpiredPraticaLocks, recoverStaleOperatorSessions } = await import(
  "../src/lib/predictive-dialer/recovery"
);

const prisma = new PrismaClient();

type TestResult = { name: string; pass: boolean; detail?: string };

const results: TestResult[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  results.push({ name, pass: condition, detail });
  console.log(`${condition ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function setupFixture() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) throw new Error("Nessun tenant nel DB");

  const operatoreA = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "OPERATOR", active: true },
  });
  let operatoreB = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: "OPERATOR",
      active: true,
      id: { not: operatoreA.id },
    },
  });
  if (!operatoreB) {
    operatoreB = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        role: { in: ["SUPERVISOR", "ADMIN"] },
        active: true,
        id: { not: operatoreA.id },
      },
    });
  }
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "ADMIN", active: true },
  });
  if (!operatoreA || !operatoreB || !admin) throw new Error("Servono 2 operatori e 1 admin");

  const pratica = await prisma.pratica.findFirst({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  if (!pratica) throw new Error("Serve almeno una pratica");

  const campagna = await prisma.dialerCampagna.create({
    data: {
      tenantId: tenant.id,
      nome: `Test resilienza ${Date.now()}`,
      createdById: admin.id,
      stato: "ATTIVA",
      lockTimeoutSec: 2,
      postCallSec: 5,
      externalId: `test:${Date.now()}`,
    },
  });

  await prisma.dialerCampagnaOperatore.createMany({
    data: [
      { campagnaId: campagna.id, operatoreId: operatoreA.id, accettatoAt: new Date(), sessioneStato: "disponibile", lastHeartbeatAt: new Date() },
      { campagnaId: campagna.id, operatoreId: operatoreB.id, accettatoAt: new Date(), sessioneStato: "disponibile", lastHeartbeatAt: new Date() },
    ],
  });

  await prisma.dialerCampagnaPratica.create({
    data: { campagnaId: campagna.id, praticaId: pratica.id, stato: "disponibile" },
  });

  const user = { id: admin.id, tenantId: tenant.id, role: "ADMIN" } as import("../src/lib/permissions").SessionUser;

  return { tenant, campagna, operatoreA, operatoreB, pratica, user };
}

async function getOpState(campagnaId: string, operatoreId: string) {
  return prisma.dialerCampagnaOperatore.findFirst({
    where: { campagnaId, operatoreId },
  });
}

async function getQueueState(campagnaId: string, praticaId: string) {
  return prisma.dialerCampagnaPratica.findFirst({
    where: { campagnaId, praticaId },
  });
}

async function getPraticaAffido(praticaId: string) {
  return prisma.pratica.findUnique({
    where: { id: praticaId },
    select: { assegnatarioId: true },
  });
}

async function runTests() {
  const fx = await setupFixture();
  const { campagna, operatoreA, operatoreB, pratica, user } = fx;
  const base = {
    campagnaId: campagna.id,
    operatoreId: operatoreA.id,
    praticaId: pratica.id,
    numero: "3331234567",
  };

  // TEST 1
  const c1 = "CALL-T1";
  await registerDialerCallEvent(user, { ...base, callId: c1, tipo: "iniziata" });
  await registerDialerCallEvent(user, { ...base, callId: c1, tipo: "collegata", affidaSeCollegata: true });
  await registerDialerCallEvent(user, { ...base, callId: c1, tipo: "terminata", durataSec: 30 });
  const op1 = await getOpState(campagna.id, operatoreA.id);
  const aff1 = await getPraticaAffido(pratica.id);
  assert("TEST 1 — flusso iniziata→collegata→terminata", op1?.sessioneStato === "post_call", op1?.sessioneStato);
  assert("TEST 1 — affido una sola volta", !!aff1?.assegnatarioId, aff1?.assegnatarioId ?? "none");

  // Reset for next tests
  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId: campagna.id },
    data: { sessioneStato: "disponibile", praticaCorrenteId: null, callIdCorrente: null, postCallFineAt: null },
  });
  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null },
  });
  await prisma.pratica.update({
    where: { id: pratica.id },
    data: { assegnatarioId: null, operatoreTitolareId: null },
  });

  // TEST 2
  const c2 = "CALL-T2";
  await registerDialerCallEvent(user, { ...base, callId: c2, tipo: "iniziata" });
  await registerDialerCallEvent(user, { ...base, callId: c2, tipo: "no_risposta" });
  const op2 = await getOpState(campagna.id, operatoreA.id);
  const q2 = await getQueueState(campagna.id, pratica.id);
  const aff2 = await getPraticaAffido(pratica.id);
  assert("TEST 2 — no_risposta torna disponibile", op2?.sessioneStato === "disponibile", op2?.sessioneStato);
  assert("TEST 2 — pratica rilasciata", q2?.stato === "non_risposta" && !q2?.lockedByOperatoreId);
  assert("TEST 2 — nessun affido", !aff2?.assegnatarioId);

  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null, tentativi: 0 },
  });

  // TEST 3
  const c3 = "CALL-T3";
  await registerDialerCallEvent(user, { ...base, callId: c3, tipo: "iniziata" });
  await registerDialerCallEvent(user, { ...base, callId: c3, tipo: "terminata" });
  const op3 = await getOpState(campagna.id, operatoreA.id);
  const q3 = await getQueueState(campagna.id, pratica.id);
  const aff3 = await getPraticaAffido(pratica.id);
  assert("TEST 3 — terminata senza collegata → disponibile", op3?.sessioneStato === "disponibile");
  assert("TEST 3 — pratica rilasciata", q3?.stato === "disponibile" && !q3?.lockedByOperatoreId);
  assert("TEST 3 — nessun affido", !aff3?.assegnatarioId);

  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null },
  });

  // TEST 4
  const c4 = "CALL-T4";
  await registerDialerCallEvent(user, { ...base, callId: c4, tipo: "iniziata" });
  const r4a = await registerDialerCallEvent(user, { ...base, callId: c4, tipo: "collegata", affidaSeCollegata: true });
  const r4b = await registerDialerCallEvent(user, { ...base, callId: c4, tipo: "collegata", affidaSeCollegata: true });
  const events4 = await prisma.dialerChiamataEvento.count({
    where: { campagnaId: campagna.id, callId: c4, tipo: "collegata", applied: true },
  });
  assert("TEST 4 — seconda collegata è duplicate", r4b.duplicate === true);
  assert("TEST 4 — una sola collegata applicata", events4 === 1, String(events4));

  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId: campagna.id },
    data: { sessioneStato: "disponibile", praticaCorrenteId: null, callIdCorrente: null },
  });
  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null },
  });
  await prisma.pratica.update({ where: { id: pratica.id }, data: { assegnatarioId: null, operatoreTitolareId: null } });

  // TEST 5
  const c5a = "CALL-T5A";
  const c5b = "CALL-T5B";
  const r5a = await registerDialerCallEvent(user, {
    ...base,
    operatoreId: operatoreA.id,
    callId: c5a,
    tipo: "iniziata",
  });
  const r5b = await registerDialerCallEvent(user, {
    ...base,
    operatoreId: operatoreB.id,
    callId: c5b,
    tipo: "iniziata",
  });
  const q5 = await getQueueState(campagna.id, pratica.id);
  assert("TEST 5 — primo operatore ottiene lock", !r5a.skipped && q5?.lockedByOperatoreId === operatoreA.id);
  assert("TEST 5 — secondo operatore non ottiene lock", r5b.skipped === true && r5b.skipReason === "lock_non_acquisito");

  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId: campagna.id },
    data: { sessioneStato: "disponibile", praticaCorrenteId: null, callIdCorrente: null },
  });
  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null },
  });

  // TEST 6
  const c6 = "CALL-T6";
  await registerDialerCallEvent(user, { ...base, callId: c6, tipo: "iniziata" });
  await new Promise((r) => setTimeout(r, 2500));
  await releaseExpiredPraticaLocks(fx.tenant.id, campagna.id);
  const q6 = await getQueueState(campagna.id, pratica.id);
  const op6 = await getOpState(campagna.id, operatoreA.id);
  assert("TEST 6 — timeout rilascia pratica", q6?.stato === "disponibile" && !q6?.lockedByOperatoreId);
  assert("TEST 6 — operatore torna disponibile", op6?.sessioneStato === "disponibile");

  // TEST 7 — stale connecting (simulate no heartbeat)
  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null },
  });
  const c7 = "CALL-T7";
  await registerDialerCallEvent(user, { ...base, callId: c7, tipo: "iniziata" });
  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId: campagna.id, operatoreId: operatoreA.id },
    data: { lastHeartbeatAt: new Date(Date.now() - 120_000) },
  });
  await recoverStaleOperatorSessions(fx.tenant.id, campagna.id);
  const q7 = await getQueueState(campagna.id, pratica.id);
  const op7 = await getOpState(campagna.id, operatoreA.id);
  assert("TEST 7 — stale connecting rilascia pratica", q7?.stato === "disponibile" && !q7?.lockedByOperatoreId);
  assert("TEST 7 — operatore recuperato", op7?.sessioneStato === "disponibile");

  // TEST 8 — stale in_chiamata
  await prisma.dialerCampagnaPratica.updateMany({
    where: { campagnaId: campagna.id, praticaId: pratica.id },
    data: { stato: "disponibile", lockedByOperatoreId: null, lockedByCallId: null, lockedAt: null },
  });
  await prisma.pratica.update({ where: { id: pratica.id }, data: { assegnatarioId: null, operatoreTitolareId: null } });
  const c8 = "CALL-T8";
  await registerDialerCallEvent(user, { ...base, callId: c8, tipo: "iniziata" });
  await registerDialerCallEvent(user, { ...base, callId: c8, tipo: "collegata", affidaSeCollegata: true });
  const affBefore = await getPraticaAffido(pratica.id);
  await prisma.dialerCampagnaOperatore.updateMany({
    where: { campagnaId: campagna.id, operatoreId: operatoreA.id },
    data: { lastHeartbeatAt: new Date(Date.now() - 120_000) },
  });
  await recoverStaleOperatorSessions(fx.tenant.id, campagna.id);
  const op8 = await getOpState(campagna.id, operatoreA.id);
  const affAfter = await getPraticaAffido(pratica.id);
  assert("TEST 8 — in_chiamata stale → offline", op8?.sessioneStato === "offline");
  assert("TEST 8 — affido non duplicato/sovrascritto", affBefore?.assegnatarioId === affAfter?.assegnatarioId && !!affAfter?.assegnatarioId);

  // Cleanup
  await prisma.dialerChiamataEvento.deleteMany({ where: { campagnaId: campagna.id } });
  await prisma.dialerCampagnaPratica.deleteMany({ where: { campagnaId: campagna.id } });
  await prisma.dialerCampagnaOperatore.deleteMany({ where: { campagnaId: campagna.id } });
  await prisma.dialerCampagna.delete({ where: { id: campagna.id } });

  const failed = results.filter((r) => !r.pass);
  console.log("\n--- RIEPILOGO ---");
  console.log(`Totale: ${results.length}, Pass: ${results.length - failed.length}, Fail: ${failed.length}`);
  if (failed.length) {
    failed.forEach((f) => console.log(`  FAIL: ${f.name} ${f.detail ?? ""}`));
    throw new Error(`${failed.length} test falliti`);
  }
}

await runTests();
await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
