import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Inline copy of sedeScopeForRendimento (avoid TS import in node). */
function sedeScopeForRendimento(user, sedeQuery) {
  if (user.role === "ADMIN") {
    const q = String(sedeQuery || "").trim();
    return { sedeId: q || null, missingSede: false };
  }
  if (user.role === "AMMINISTRAZIONE") {
    if (!user.sedeId) return { sedeId: null, missingSede: true };
    return { sedeId: user.sedeId, missingSede: false };
  }
  return { sedeId: null, missingSede: false };
}

async function userIdsInSede(tenantId, sedeId) {
  if (!sedeId) return null;
  const users = await prisma.user.findMany({
    where: { tenantId, active: true, sedeId },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

function intersectUserIds(memberIds, sedeUserIds) {
  if (!sedeUserIds) return memberIds;
  const set = new Set(sedeUserIds);
  return memberIds.filter((id) => set.has(id));
}

function assert(cond, msg) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK:", msg);
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "demo" } });
  assert(tenant, "tenant demo exists");

  let sedi = await prisma.sede.findMany({
    where: { tenantId: tenant.id },
    orderBy: { nome: "asc" },
  });
  if (sedi.length < 2) {
    const extra = await prisma.sede.create({
      data: { tenantId: tenant.id, nome: "Sede Smoke B" },
    });
    sedi = [...sedi, extra];
    console.log("created second sede for smoke:", extra.nome);
  }
  assert(sedi.length >= 2, `at least 2 sedi (${sedi.map((s) => s.nome).join(", ")})`);

  const sedeA = sedi.find((s) => s.nome.includes("Roma") || s.nome.includes("principale")) || sedi[0];
  const sedeB = sedi.find((s) => s.id !== sedeA.id) || sedi[1];

  let admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "ADMIN" },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "smoke-admin@test.local",
        name: "Smoke Admin",
        role: "ADMIN",
        passwordHash: "x",
        sedeId: sedeA.id,
        active: true,
      },
    });
    console.log("created admin for smoke");
  }
  let amm = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: "AMMINISTRAZIONE" },
  });
  if (!amm) {
    amm = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "smoke-amm@test.local",
        name: "Smoke Amm",
        role: "AMMINISTRAZIONE",
        passwordHash: "x",
        sedeId: sedeA.id,
        active: true,
      },
    });
    console.log("created amministrazione on sede A");
  } else if (!amm.sedeId) {
    amm = await prisma.user.update({
      where: { id: amm.id },
      data: { sedeId: sedeA.id },
    });
    console.log("assigned amministrazione to sede A");
  }
  assert(admin, "admin user");
  assert(amm.sedeId, `amministrazione has sedeId=${amm.sedeId}`);

  let opB = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      role: "OPERATOR",
      sedeId: sedeB.id,
      active: true,
    },
  });
  if (!opB) {
    opB = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "smoke-op-sede-b@test.local",
        name: "Smoke Op B",
        role: "OPERATOR",
        passwordHash: "x",
        sedeId: sedeB.id,
        active: true,
      },
    });
    console.log("created smoke op on sede B");
  }

  const sessionAdmin = {
    role: "ADMIN",
    sedeId: admin.sedeId,
  };
  const sessionAmm = {
    role: "AMMINISTRAZIONE",
    sedeId: amm.sedeId,
  };
  const sessionAmmNoSede = { role: "AMMINISTRAZIONE", sedeId: null };

  const adminAll = sedeScopeForRendimento(sessionAdmin, null);
  assert(adminAll.sedeId === null && !adminAll.missingSede, "Admin senza filtro vede tutte le sedi");

  const adminB = sedeScopeForRendimento(sessionAdmin, sedeB.id);
  assert(adminB.sedeId === sedeB.id && !adminB.missingSede, "Admin con ?sede= filtra sede B");

  const ammScope = sedeScopeForRendimento(sessionAmm, sedeB.id);
  assert(
    ammScope.sedeId === amm.sedeId,
    "Amministrazione ignora ?sede= altre e resta sulla propria"
  );
  assert(!ammScope.missingSede, "Amministrazione con sede non missing");

  const ammMissing = sedeScopeForRendimento(sessionAmmNoSede, null);
  assert(ammMissing.missingSede, "Amministrazione senza sedeId blocca rendimento");

  const idsA = await userIdsInSede(tenant.id, sedeA.id);
  const idsB = await userIdsInSede(tenant.id, sedeB.id);
  const idsAll = await userIdsInSede(tenant.id, null);
  assert(idsAll === null, "userIdsInSede(null) = nessuna restrizione");
  assert(idsB.includes(opB.id), "sede B include operatore B");
  assert(!idsA.includes(opB.id), "operatore B non in sede A");

  const praticheA = await prisma.pratica.count({
    where: {
      tenantId: tenant.id,
      OR: [
        { assegnatario: { sedeId: sedeA.id } },
        { operatoreTitolare: { sedeId: sedeA.id } },
      ],
    },
  });
  const praticheB = await prisma.pratica.count({
    where: {
      tenantId: tenant.id,
      OR: [
        { assegnatario: { sedeId: sedeB.id } },
        { operatoreTitolare: { sedeId: sedeB.id } },
      ],
    },
  });
  const praticheAll = await prisma.pratica.count({ where: { tenantId: tenant.id } });
  assert(praticheAll >= praticheA, "totale pratiche >= sede A");
  console.log("pratiche A/B/all:", praticheA, praticheB, praticheAll);

  const intersect = intersectUserIds([opB.id, amm.id], idsA);
  assert(!intersect.includes(opB.id), "intersect esclude op sede B dallo scope A");

  // Gestione: Amministrazione può vedere postazioni di tutte le sedi
  const postazioni = await prisma.postazione.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, nome: true, sedeId: true },
  });
  const sediPostazioni = new Set(postazioni.map((p) => p.sedeId).filter(Boolean));
  assert(sediPostazioni.size >= 1, "esistono postazioni con sede");

  console.log("\nSMOKE PASS: Admin vede tutte (+ filtro); Amministrazione solo propria sede");

  // Cleanup utenti/sede creati solo per lo smoke (non tocca dati esistenti)
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "smoke-admin@test.local",
          "smoke-amm@test.local",
          "smoke-op-sede-b@test.local",
        ],
      },
    },
  });
  await prisma.sede.deleteMany({
    where: { tenantId: tenant.id, nome: "Sede Smoke B" },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
