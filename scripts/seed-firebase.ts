import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedRegistrazioniDemo } from "./seedRegistrazioni";
import { emptyLatoEconomico, serializePerimetri } from "../src/lib/mandantePerimetri";
import { serializeGruppoMandanti } from "../src/lib/gruppoMandantiUi";
import { createFirebasePrisma } from "../src/lib/firebase/firebasePrisma";

/** Carica .env prima di Firebase Admin (tsx non lo fa da solo). */
function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile();
process.env.OPERATIONAL_BACKEND = "firebase";

const prisma: PrismaClient = createFirebasePrisma();

function latoProvvigioneDemo() {
  return {
    ...emptyLatoEconomico(),
    provvigionePerc: 8,
  };
}

const PERIMETRI_BNL = serializePerimetri([
  {
    id: "per-112608",
    nomeInterno: "112608",
    descrizione: "112608",
    nomeMandante: "112608",
    ricevuta: emptyLatoEconomico(),
    pagata: latoProvvigioneDemo(),
    codiciScarico: [],
    smsPreimpostati: [],
  },
  {
    id: "per-1426001",
    nomeInterno: "1426001",
    descrizione: "1426001",
    nomeMandante: "1426001",
    ricevuta: emptyLatoEconomico(),
    pagata: latoProvvigioneDemo(),
    codiciScarico: [],
    smsPreimpostati: [],
  },
  {
    id: "per-1426055",
    nomeInterno: "1426055",
    descrizione: "1426055",
    nomeMandante: "1426055",
    ricevuta: emptyLatoEconomico(),
    pagata: latoProvvigioneDemo(),
    codiciScarico: [],
    smsPreimpostati: [],
  },
]);

async function main() {
  const passwordHash = await bcrypt.hash("Demo123!", 10);

  await prisma.auditLog.deleteMany();
  await prisma.registrazioneChiamata.deleteMany();
  await prisma.messaggioInterno.deleteMany();
  await prisma.messaggioAgenda.deleteMany();
  await prisma.documento.deleteMany();
  await prisma.pianoRata.deleteMany();
  await prisma.provvigione.deleteMany();
  await prisma.incasso.deleteMany();
  await prisma.fattura.deleteMany();
  await prisma.attivita.deleteMany();
  await prisma.garante.deleteMany();
  await prisma.praticaLock.deleteMany().catch(() => undefined);
  await prisma.passwordHistory.deleteMany().catch(() => undefined);
  await prisma.configurazioneSistema.deleteMany();
  await prisma.pratica.deleteMany();
  await prisma.debitore.deleteMany();
  await prisma.mandante.deleteMany();
  await prisma.postazione.deleteMany();
  await prisma.user.deleteMany();
  await prisma.sede.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: { slug: "demo", nome: "Demo Recupero Crediti S.r.l." },
  });
  const tenantAlfa = await prisma.tenant.create({
    data: { slug: "alfa", nome: "Alfa Credit S.p.A." },
  });

  const sedeRoma = await prisma.sede.create({
    data: { tenantId: tenant.id, nome: "Sede Roma" },
  });
  await prisma.sede.create({
    data: { tenantId: tenant.id, nome: "Sede Milano" },
  });
  const sedeMilano = await prisma.sede.create({
    data: { tenantId: tenantAlfa.id, nome: "Sede Milano" },
  });

  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@gestionale.local",
      name: "Anna",
      passwordHash,
      role: "ADMIN",
      sedeId: sedeRoma.id,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "supervisor@gestionale.local",
      name: "Sara Supervisor",
      passwordHash,
      role: "SUPERVISOR",
      sedeId: sedeRoma.id,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "supervisor.test@gestionale.local",
      name: "Supervisor Test",
      passwordHash,
      role: "SUPERVISOR",
      sedeId: sedeRoma.id,
    },
  });

  const backoffice = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "backoffice@gestionale.local",
      name: "Bruno Backoffice",
      passwordHash,
      role: "BACK_OFFICE",
      sedeId: sedeRoma.id,
    },
  });

  const amministrazione = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "amministrazione@gestionale.local",
      name: "Carla Amministrazione",
      passwordHash,
      role: "AMMINISTRAZIONE",
      sedeId: sedeRoma.id,
    },
  });

  const operatore = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "operatore@gestionale.local",
      name: "Omar Operatore",
      passwordHash,
      role: "OPERATOR",
      supervisorId: supervisor.id,
      sedeId: sedeRoma.id,
    },
  });

  const operatore2 = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "operatore2@gestionale.local",
      name: "Olivia Operatore",
      passwordHash,
      role: "OPERATOR",
      supervisorId: supervisor.id,
      sedeId: sedeRoma.id,
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "manutenzione@gestionale.local",
      name: "Manutenzione",
      passwordHash,
      role: "MANUTENZIONE",
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenantAlfa.id,
      email: "admin@gestionale.local",
      name: "Admin Alfa",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.postazione.createMany({
    data: [
      {
        tenantId: tenant.id,
        nome: "Postazione 1",
        interno: "201",
        email: "post1@gestionale.local",
        numeroFisso: "06 11112222",
        sedeId: sedeRoma.id,
      },
      {
        tenantId: tenant.id,
        nome: "Postazione 2",
        interno: "202",
        email: "post2@gestionale.local",
        numeroFisso: "06 11113333",
        sedeId: sedeRoma.id,
      },
      {
        tenantId: tenant.id,
        nome: "Postazione 3",
        interno: "203",
        email: "post3@gestionale.local",
        sedeId: sedeRoma.id,
      },
      {
        tenantId: tenantAlfa.id,
        nome: "Postazione Alfa 1",
        interno: "301",
        email: "post1@alfa.local",
        sedeId: sedeMilano.id,
      },
    ],
  });

  const mandante = await prisma.mandante.create({
    data: {
      tenantId: tenant.id,
      codice: "BNL01",
      ragioneSociale: "Banca Esempio S.p.A.",
      email: "affidi@bancaesempio.it",
      telefono: "06 12345678",
      perimetri: PERIMETRI_BNL,
    },
  });

  await prisma.user.update({
    where: { id: supervisor.id },
    data: {
      gruppoNome: "Gruppo Sara",
      gruppoMandanti: serializeGruppoMandanti([
        {
          mandanteId: mandante.id,
          perimetriIds: ["per-112608", "per-1426001", "per-1426055"],
        },
      ]),
    },
  });

  await prisma.mandante.create({
    data: {
      tenantId: tenantAlfa.id,
      codice: "ALF01",
      ragioneSociale: "Committente Alfa S.p.A.",
    },
  });

  const d1 = await prisma.debitore.create({
    data: {
      tenantId: tenant.id,
      nome: "Mario",
      cognome: "Rossi",
      codiceFiscale: "RSSMRA80A01H501U",
      telefono: "3331234567",
      citta: "Roma",
      provincia: "RM",
      indirizzo: "Via Appia 12",
      cap: "00100",
      ndg: "1687443",
    },
  });
  const d2 = await prisma.debitore.create({
    data: {
      tenantId: tenant.id,
      nome: "Lucia",
      cognome: "Bianchi",
      codiceFiscale: "BNCLCU75C45F205X",
      telefono: "3479876543",
      citta: "Milano",
      provincia: "MI",
      indirizzo: "Corso Buenos Aires 8",
      cap: "20124",
    },
  });
  const d3 = await prisma.debitore.create({
    data: {
      tenantId: tenant.id,
      nome: "Giuseppe",
      cognome: "Verdi",
      telefono: "3201112233",
      citta: "Napoli",
      provincia: "NA",
    },
  });

  const pratiche = [
    {
      numero: "PRC-2026-0001",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "IN_LAVORAZIONE",
      esitoContatto: "CONTATTO",
      tipoContatto: "TELEFONATA",
      memoAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      capitale: 2400,
      interessi: 180,
      spese: 70,
      residuo: 2650,
    },
    {
      numero: "PRC-2026-0004",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "AFFIDATA",
      capitale: 1200,
      interessi: 90,
      spese: 35,
      residuo: 1325,
    },
    {
      numero: "PRC-2026-0005",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "IN_LAVORAZIONE",
      capitale: 860,
      interessi: 55,
      spese: 20,
      residuo: 935,
    },
    {
      numero: "PRC-2026-0006",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "PROMESSA",
      capitale: 430,
      interessi: 25,
      spese: 15,
      residuo: 470,
    },
    {
      numero: "PRC-2026-0007",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "INCASSO",
      capitale: 980,
      interessi: 60,
      spese: 30,
      residuo: 0,
    },
    {
      numero: "PRC-2026-0008",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "INESIGIBILE",
      capitale: 650,
      interessi: 40,
      spese: 20,
      residuo: 710,
    },
    {
      numero: "PRC-2026-0009",
      debitoreId: d1.id,
      assegnatarioId: operatore.id,
      stato: "RESA",
      capitale: 320,
      interessi: 18,
      spese: 12,
      residuo: 350,
    },
    {
      numero: "PRC-2026-0002",
      debitoreId: d2.id,
      assegnatarioId: operatore2.id,
      stato: "AFFIDATA",
      capitale: 5100,
      interessi: 320,
      spese: 90,
      residuo: 5510,
    },
    {
      numero: "PRC-2026-0003",
      debitoreId: d3.id,
      stato: "NUOVA",
      capitale: 890,
      interessi: 40,
      spese: 25,
      residuo: 955,
    },
  ];

  for (const p of pratiche) {
    await prisma.pratica.create({
      data: {
        ...p,
        tenantId: tenant.id,
        operatoreTitolareId: p.assegnatarioId ?? undefined,
        mandanteId: mandante.id,
        dataAffido: new Date("2026-08-04"),
        numeroMandante: "112608",
        scadenza: new Date("2026-08-31"),
        ...(p.stato === "INCASSO"
          ? { codiceScarico: "PTC" }
          : p.stato === "PROMESSA"
            ? { codiceScarico: "PPC" }
            : p.stato === "INESIGIBILE"
              ? { codiceScarico: "MOV" }
              : p.stato === "PIANO"
                ? { codiceScarico: "LPP" }
                : p.stato === "RESA"
                  ? { codiceScarico: "LPT" }
                  : {}),
      },
    });
  }

  await prisma.pratica.updateMany({
    where: { numero: "PRC-2026-0005" },
    data: {
      assegnatarioId: operatore2.id,
      operatoreTitolareId: operatore.id,
    },
  });

  await prisma.pratica.updateMany({
    where: { numero: "PRC-2026-0009" },
    data: {
      numeroMandante: "1426055",
      dataAffido: new Date("2026-08-14"),
      scadenza: new Date("2026-08-31"),
    },
  });

  await prisma.pratica.updateMany({
    where: { numero: "PRC-2026-0001" },
    data: {
      numeroMandante: "1426001",
      dataAffido: new Date("2026-08-01"),
    },
  });

  const pratica1 = await prisma.pratica.findFirst({
    where: { numero: "PRC-2026-0001" },
  });
  if (pratica1) {
    await prisma.debitoreRecapito.createMany({
      data: [
        {
          debitoreId: d1.id,
          tipo: "TELEFONO",
          valore: "3387654321",
          ordine: 1,
        },
        {
          debitoreId: d1.id,
          tipo: "EMAIL",
          valore: "mario.rossi@email.it",
          ordine: 1,
        },
      ],
    });

    await prisma.fattura.createMany({
      data: [
        {
          praticaId: pratica1.id,
          numero: "P17294033",
          causale: "RATA 1",
          dataFattura: new Date(2026, 2, 20, 12),
          dataScadenza: new Date(2026, 2, 20, 12),
          importo: 100,
          pagato: 100,
        },
        {
          praticaId: pratica1.id,
          numero: "P17294034",
          causale: "RATA 2",
          dataFattura: new Date(2026, 3, 20, 12),
          dataScadenza: new Date(2026, 3, 20, 12),
          importo: 100,
          pagato: 0,
        },
        {
          praticaId: pratica1.id,
          numero: "P17294035",
          causale: "RATA 3",
          dataFattura: new Date(2026, 4, 20, 12),
          dataScadenza: new Date(2026, 4, 20, 12),
          importo: 100,
          pagato: 0,
        },
      ],
    });
    const attivitaDemo = [
      {
        tipo: "TELEFONATA",
        esito: "NON_RISPONDE",
        nota: "da cell 3331234567 sq. segr",
        daysAgo: 7,
        hours: 13,
        minutes: 30,
      },
      {
        tipo: "LETTERA",
        esito: null,
        nota: "SMS -> Telefono -> 3331234567 — Gentile debitore, la invitiamo a contattare il numero verde…",
        daysAgo: 2,
        hours: 12,
        minutes: 45,
      },
      {
        tipo: "NOTA",
        esito: "CONTATTO",
        nota: "conferma indirizzo, richiamare venerdì mattina",
        daysAgo: 0,
        hours: 10,
        minutes: 15,
      },
    ];
    for (const a of attivitaDemo) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - a.daysAgo);
      createdAt.setHours(a.hours, a.minutes, 0, 0);
      await prisma.attivita.create({
        data: {
          praticaId: pratica1.id,
          userId: operatore.id,
          tipo: a.tipo,
          esito: a.esito,
          nota: a.nota,
          createdAt,
        },
      });
    }

    await prisma.garante.create({
      data: {
        praticaId: pratica1.id,
        nome: "Francesco",
        cognome: "Rossi",
        codiceFiscale: "RSSFNC75D12H501Z",
        telefono: "3387654321",
        email: "f.rossi@email.it",
        indirizzo: "Via Tuscolana 45",
        citta: "Roma",
        cap: "00174",
        provincia: "RM",
        ordine: 1,
      },
    });

    const garanteFrancesco = await prisma.garante.findFirst({
      where: { praticaId: pratica1.id, cognome: "Rossi", nome: "Francesco" },
    });
    if (garanteFrancesco) {
      await prisma.garanteRecapito.create({
        data: {
          garanteId: garanteFrancesco.id,
          tipo: "TELEFONO",
          valore: "3209988776",
          ordine: 1,
        },
      });
    }
  }

  const pratica2 = await prisma.pratica.findFirst({
    where: { numero: "PRC-2026-0002" },
  });
  if (pratica2) {
    await prisma.garante.create({
      data: {
        praticaId: pratica2.id,
        nome: "Paolo",
        cognome: "Bianchi",
        telefono: "3209988776",
        indirizzo: "Corso Buenos Aires 8",
        citta: "Milano",
        cap: "20124",
        provincia: "MI",
        ordine: 1,
      },
    });
  }

  const percentualeProv = 8;
  function provImporto(base: number) {
    return Math.round(base * (percentualeProv / 100) * 100) / 100;
  }

  async function seedIncassoConProvvigione(opts: {
    praticaId: string;
    operatoreId: string;
    importo: number;
    giorniFa: number;
    metodo?: string;
    liquidata?: boolean;
  }) {
    const data = new Date();
    data.setDate(data.getDate() - opts.giorniFa);
    const incasso = await prisma.incasso.create({
      data: {
        praticaId: opts.praticaId,
        userId: backoffice.id,
        importo: opts.importo,
        capitale: opts.importo * 0.85,
        interessi: opts.importo * 0.1,
        spese: opts.importo * 0.05,
        metodo: opts.metodo || "bonifico",
        data,
      },
    });
    await prisma.provvigione.create({
      data: {
        incassoId: incasso.id,
        praticaId: opts.praticaId,
        operatoreId: opts.operatoreId,
        baseImporto: opts.importo,
        percentuale: percentualeProv,
        importo: provImporto(opts.importo),
        stato: opts.liquidata ? "LIQUIDATA" : "MATURATA",
        liquidataAt: opts.liquidata ? data : null,
      },
    });
  }

  const praticaIncassata = await prisma.pratica.findFirst({
    where: { numero: "PRC-2026-0007" },
  });
  if (praticaIncassata) {
    await seedIncassoConProvvigione({
      praticaId: praticaIncassata.id,
      operatoreId: operatore.id,
      importo: 1070,
      giorniFa: 45,
      liquidata: true,
    });
  }

  if (pratica1) {
    await seedIncassoConProvvigione({
      praticaId: pratica1.id,
      operatoreId: operatore.id,
      importo: 250,
      giorniFa: 12,
    });
    await seedIncassoConProvvigione({
      praticaId: pratica1.id,
      operatoreId: operatore.id,
      importo: 180,
      giorniFa: 3,
    });
  }

  if (pratica2) {
    await seedIncassoConProvvigione({
      praticaId: pratica2.id,
      operatoreId: operatore2.id,
      importo: 500,
      giorniFa: 8,
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      userId: admin.id,
      action: "seed",
      entity: "sistema",
      dettaglio: `Tenant demo + alfa. Utenti: ${admin.email}, ${supervisor.email}, ${backoffice.email}, ${operatore.email}`,
    },
  });

  await seedRegistrazioniDemo(prisma);

  const senzaTitolare = await prisma.pratica.findMany({
    where: { tenantId: tenant.id, assegnatarioId: { not: null }, operatoreTitolareId: null },
    select: { id: true, assegnatarioId: true },
  });
  for (const p of senzaTitolare) {
    await prisma.pratica.update({
      where: { id: p.id },
      data: { operatoreTitolareId: p.assegnatarioId },
    });
  }

  console.log("Seed ok su Firebase. Password Demo123! — aziende: demo | alfa");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
