/**
 * Dati mock Recruiting (solo SQLite locale).
 *
 *   npx tsx scripts/recruiting-mock.ts          # inserisce
 *   npx tsx scripts/recruiting-mock.ts --clean  # elimina solo i mock
 *
 * Marker: titolo offerta inizia con [MOCK], source candidatura = mock.
 * Nessun PII candidato.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const MARKER = "[MOCK]";
const SOURCE = "mock";

function loadEnv() {
  try {
    const text = readFileSync(path.resolve(".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url =
  "file:" +
  path
    .resolve("src/lib/firebase/src/lib/firebase/.local-dev.db")
    .replace(/\\/g, "/");

const prisma = new PrismaClient({ datasources: { db: { url } } });

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

async function clean() {
  const offerte = await prisma.offertaLavoro.findMany({
    where: { titolo: { startsWith: MARKER } },
    select: { id: true, tenantId: true },
  });
  const offertaIds = offerte.map((o) => o.id);
  const candidature = await prisma.recruitingCandidatura.findMany({
    where: {
      OR: [
        { source: { in: [SOURCE, "percorso"] } },
        offertaIds.length ? { offertaId: { in: offertaIds } } : { id: "__none__" },
      ],
    },
    select: { id: true, tenantId: true },
  });
  const candIds = candidature.map((c) => c.id);
  if (candIds.length) {
    await prisma.recruitingAttivita.deleteMany({ where: { candidaturaId: { in: candIds } } });
    await prisma.recruitingColloquio.deleteMany({ where: { candidaturaId: { in: candIds } } });
    await prisma.recruitingCandidatura.deleteMany({ where: { id: { in: candIds } } });
  }
  if (offertaIds.length) {
    await prisma.offertaLavoro.deleteMany({ where: { id: { in: offertaIds } } });
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "clean",
        offerte: offertaIds.length,
        candidature: candIds.length,
      },
      null,
      2
    )
  );
}

async function seed() {
  await clean();
  const tenant = await prisma.tenant.findFirst({ select: { id: true, slug: true } });
  const user = tenant
    ? await prisma.user.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      })
    : null;
  if (!tenant || !user) {
    throw new Error("Servono almeno un tenant e un utente nello SQLite locale");
  }

  const desc =
    "Gestione telefonate in ingresso e in uscita, aggiornamento pratiche e supporto al team operativo di sede.";

  const bozza = await prisma.offertaLavoro.create({
    data: {
      tenantId: tenant.id,
      titolo: `${MARKER} Operatore call center`,
      luogo: "Napoli",
      modalitaLavoro: "PRESENZA",
      tipoContratto: "TEMPO_INDETERMINATO",
      orario: "FULL_TIME",
      numeroPosizioni: 2,
      descrizione: desc,
      attivitaPrincipali: "Chiamate, note operative, aggiornamento stato pratica.",
      requisiti: "Buona dizione, uso PC, disponibilità full time.",
      competenze: "Esperienza in contact center preferibile.",
      retribuzione: "1.400–1.600 € mese",
      benefit: "Ticket restaurant\nFormazione interna",
      paese: "IT",
      stato: "BOZZA",
    },
  });

  const pubblicata = await prisma.offertaLavoro.create({
    data: {
      tenantId: tenant.id,
      titolo: `${MARKER} Addetto back office`,
      luogo: "Milano",
      modalitaLavoro: "IBRIDO",
      tipoContratto: "TEMPO_DETERMINATO",
      orario: "FULL_TIME",
      numeroPosizioni: 1,
      descrizione: desc,
      attivitaPrincipali: "Istruttoria documentale e supporto agli operatori.",
      requisiti: "Diploma, autonomia organizzativa.",
      competenze: "Excel, gestione scadenze.",
      retribuzione: "1.500 € mese",
      benefit: "Smart working due giorni a settimana",
      paese: "IT",
      stato: "PUBBLICATA",
    },
  });

  const chiusa = await prisma.offertaLavoro.create({
    data: {
      tenantId: tenant.id,
      titolo: `${MARKER} Stage amministrazione`,
      luogo: "Roma",
      modalitaLavoro: "REMOTO",
      tipoContratto: "STAGE",
      orario: "PART_TIME",
      numeroPosizioni: 1,
      descrizione: desc,
      attivitaPrincipali: "Supporto archivio e scadenziario.",
      requisiti: "Iscrizione a un percorso di studi.",
      competenze: "",
      retribuzione: "Indennità di stage",
      benefit: "",
      paese: "IT",
      stato: "CHIUSA",
    },
  });

  async function candidatura(input: {
    offertaId: string;
    stato: string;
    hours: number;
    attivita: Array<{
      tipo: string;
      hours: number;
      note?: string;
      esito?: string | null;
      statoDa?: string | null;
      statoA?: string | null;
      canale?: string | null;
      colloquioId?: string | null;
    }>;
  }) {
    const created = await prisma.recruitingCandidatura.create({
      data: {
        tenantId: tenant.id,
        offertaId: input.offertaId,
        stato: input.stato,
        source: SOURCE,
        receivedAt: hoursAgo(input.hours),
      },
    });
    await prisma.recruitingAttivita.create({
      data: {
        tenantId: tenant.id,
        candidaturaId: created.id,
        tipo: "RICEZIONE",
        occurredAt: created.receivedAt,
        note: "",
        statoA: "RICEVUTA",
        createdById: user.id,
      },
    });
    for (const a of input.attivita) {
      await prisma.recruitingAttivita.create({
        data: {
          tenantId: tenant.id,
          candidaturaId: created.id,
          tipo: a.tipo,
          occurredAt: hoursAgo(a.hours),
          note: a.note || "",
          esito: a.esito ?? null,
          statoDa: a.statoDa ?? null,
          statoA: a.statoA ?? null,
          canale: a.canale ?? null,
          colloquioId: a.colloquioId ?? null,
          createdById: user.id,
        },
      });
    }
    return created;
  }

  const percorso = await prisma.recruitingCandidatura.create({
    data: {
      tenantId: tenant.id,
      offertaId: pubblicata.id,
      stato: "RICEVUTA",
      source: "percorso",
      receivedAt: new Date(),
    },
  });
  await prisma.recruitingAttivita.create({
    data: {
      tenantId: tenant.id,
      candidaturaId: percorso.id,
      tipo: "RICEZIONE",
      occurredAt: percorso.receivedAt,
      note: "",
      statoA: "RICEVUTA",
      createdById: user.id,
    },
  });

  const ricevuta = await candidatura({
    offertaId: pubblicata.id,
    stato: "RICEVUTA",
    hours: 48,
    attivita: [],
  });

  const daValutare = await candidatura({
    offertaId: pubblicata.id,
    stato: "RICEVUTA",
    hours: 40,
    attivita: [
      {
        tipo: "CONTATTO",
        hours: 36,
        canale: "TELEFONO",
        esito: "RAGGIUNTO",
        note: "Contatto mock: raggiunto.",
      },
    ],
  });

  const rifiuta = await candidatura({
    offertaId: pubblicata.id,
    stato: "RICEVUTA",
    hours: 30,
    attivita: [
      {
        tipo: "CONTATTO",
        hours: 28,
        canale: "TELEFONO",
        esito: "RIFIUTA",
        note: "Contatto mock: rifiuta.",
      },
    ],
  });

  const inValutazione = await candidatura({
    offertaId: pubblicata.id,
    stato: "IN_VALUTAZIONE",
    hours: 24,
    attivita: [
      {
        tipo: "CONTATTO",
        hours: 22,
        canale: "TELEFONO",
        esito: "RAGGIUNTO",
        note: "Contatto mock.",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 21,
        statoDa: "RICEVUTA",
        statoA: "IN_VALUTAZIONE",
      },
      { tipo: "NOTA", hours: 20, note: "Nota mock: da convocare." },
    ],
  });

  const colloquioCand = await candidatura({
    offertaId: pubblicata.id,
    stato: "COLLOQUIO",
    hours: 18,
    attivita: [
      {
        tipo: "CONTATTO",
        hours: 17,
        canale: "TELEFONO",
        esito: "RAGGIUNTO",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 16,
        statoDa: "RICEVUTA",
        statoA: "IN_VALUTAZIONE",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 10,
        statoDa: "IN_VALUTAZIONE",
        statoA: "COLLOQUIO",
      },
    ],
  });

  const colloquioAperto = await prisma.recruitingColloquio.create({
    data: {
      tenantId: tenant.id,
      candidaturaId: colloquioCand.id,
      round: 1,
      stato: "PROGRAMMATO",
      scheduledAt: hoursAgo(-24),
      modalita: "VIDEO",
      intervistatoreUserId: user.id,
      intervistatoreLabel: user.name,
      notePreliminari: "Verificare disponibilità oraria.",
      createdById: user.id,
    },
  });
  await prisma.recruitingAttivita.create({
    data: {
      tenantId: tenant.id,
      candidaturaId: colloquioCand.id,
      tipo: "COLLOQUIO_PROGRAMMATO",
      occurredAt: hoursAgo(12),
      note: "",
      colloquioId: colloquioAperto.id,
      createdById: user.id,
    },
  });

  const positiva = await candidatura({
    offertaId: pubblicata.id,
    stato: "PROVA",
    hours: 72,
    attivita: [
      {
        tipo: "CAMBIO_STATO",
        hours: 60,
        statoDa: "RICEVUTA",
        statoA: "IN_VALUTAZIONE",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 48,
        statoDa: "IN_VALUTAZIONE",
        statoA: "COLLOQUIO",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 28,
        statoDa: "COLLOQUIO",
        statoA: "PROVA",
      },
    ],
  });
  const colloquioPos = await prisma.recruitingColloquio.create({
    data: {
      tenantId: tenant.id,
      candidaturaId: positiva.id,
      round: 1,
      stato: "ESITATO",
      scheduledAt: hoursAgo(30),
      modalita: "PRESENZA",
      intervistatoreUserId: user.id,
      intervistatoreLabel: user.name,
      notePreliminari: "Colloquio conoscitivo.",
      noteSvolgimento: "Svolto in sede.",
      esito: "POSITIVO",
      valutazione: "Profilo in linea.",
      createdById: user.id,
    },
  });
  await prisma.recruitingAttivita.createMany({
    data: [
      {
        tenantId: tenant.id,
        candidaturaId: positiva.id,
        tipo: "COLLOQUIO_PROGRAMMATO",
        occurredAt: hoursAgo(40),
        note: "",
        colloquioId: colloquioPos.id,
        createdById: user.id,
      },
      {
        tenantId: tenant.id,
        candidaturaId: positiva.id,
        tipo: "COLLOQUIO_SVOLTO",
        occurredAt: hoursAgo(30),
        note: "Svolto in sede.",
        colloquioId: colloquioPos.id,
        createdById: user.id,
      },
      {
        tenantId: tenant.id,
        candidaturaId: positiva.id,
        tipo: "COLLOQUIO_ESITO",
        occurredAt: hoursAgo(29),
        esito: "POSITIVO",
        note: "Profilo in linea.",
        colloquioId: colloquioPos.id,
        createdById: user.id,
      },
    ],
  });

  const assunta = await candidatura({
    offertaId: pubblicata.id,
    stato: "ASSUNTA",
    hours: 96,
    attivita: [
      {
        tipo: "CAMBIO_STATO",
        hours: 50,
        statoDa: "COLLOQUIO",
        statoA: "PROVA",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 20,
        statoDa: "PROVA",
        statoA: "ASSUNTA",
      },
    ],
  });

  const archiviata = await candidatura({
    offertaId: pubblicata.id,
    stato: "ARCHIVIATA",
    hours: 80,
    attivita: [
      {
        tipo: "CONTATTO",
        hours: 70,
        canale: "TELEFONO",
        esito: "RIFIUTA",
      },
      {
        tipo: "CAMBIO_STATO",
        hours: 69,
        statoDa: "RICEVUTA",
        statoA: "ARCHIVIATA",
      },
    ],
  });

  await candidatura({
    offertaId: chiusa.id,
    stato: "ARCHIVIATA",
    hours: 120,
    attivita: [
      {
        tipo: "CAMBIO_STATO",
        hours: 100,
        statoDa: "RICEVUTA",
        statoA: "ARCHIVIATA",
      },
    ],
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "seed",
        tenant: tenant.slug,
        offerte: [bozza.titolo, pubblicata.titolo, chiusa.titolo],
        candidature: {
          percorso: percorso.id,
          ricevuta: ricevuta.id,
          daValutare: daValutare.id,
          rifiuta: rifiuta.id,
          inValutazione: inValutazione.id,
          colloquioAperto: colloquioCand.id,
          esitoPositivo: positiva.id,
          assunta: assunta.id,
          archiviata: archiviata.id,
        },
        clean: "npx tsx scripts/recruiting-mock.ts --clean",
      },
      null,
      2
    )
  );
}

const cleanOnly = process.argv.includes("--clean");
(cleanOnly ? clean() : seed())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
