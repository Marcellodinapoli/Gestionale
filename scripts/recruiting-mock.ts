/**
 * Seed mock Recruiting su SQL Server (CredixaDev).
 * MAI Firebase — solo dbo.OfferteLavoro / Recruiting*.
 *
 *   npx tsx scripts/recruiting-mock.ts
 *   npx tsx scripts/recruiting-mock.ts --clean
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sql from "mssql";

const MARKER = "[MOCK]";
const SOURCE = "mock";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
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
}

loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve("connector/.env"));

function cuid() {
  return `c${randomBytes(12).toString("hex")}`;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function dbConfig(): sql.config {
  // Allineato al Connector: porta TCP (named instance risolta da SQL Server su 1433).
  return {
    server: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "CredixaDev",
    user: process.env.DB_USER || "credixa_dev",
    password: process.env.DB_PASSWORD || "",
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };
}

async function clean(pool: sql.ConnectionPool) {
  const offerte = await pool.request().query(`
    SELECT Id FROM dbo.OfferteLavoro WHERE Titolo LIKE N'${MARKER}%'
  `);
  const offertaIds = offerte.recordset.map((r) => String(r.Id));
  const candReq = pool.request();
  let candSql = `
    SELECT Id FROM dbo.RecruitingCandidature
    WHERE Source IN (N'mock', N'percorso')
  `;
  if (offertaIds.length) {
    offertaIds.forEach((id, i) => candReq.input(`o${i}`, sql.NVarChar(64), id));
    candSql += ` OR OffertaId IN (${offertaIds.map((_, i) => `@o${i}`).join(",")})`;
  }
  const candidature = await candReq.query(candSql);
  const candIds = candidature.recordset.map((r) => String(r.Id));

  if (candIds.length) {
    const del = pool.request();
    candIds.forEach((id, i) => del.input(`c${i}`, sql.NVarChar(64), id));
    const inList = candIds.map((_, i) => `@c${i}`).join(",");
    await del.query(`
      DELETE FROM dbo.RecruitingAttivita WHERE CandidaturaId IN (${inList});
      DELETE FROM dbo.RecruitingColloqui WHERE CandidaturaId IN (${inList});
      DELETE FROM dbo.RecruitingCandidature WHERE Id IN (${inList});
    `);
  }
  if (offertaIds.length) {
    const delO = pool.request();
    offertaIds.forEach((id, i) => delO.input(`o${i}`, sql.NVarChar(64), id));
    await delO.query(
      `DELETE FROM dbo.OfferteLavoro WHERE Id IN (${offertaIds.map((_, i) => `@o${i}`).join(",")})`
    );
  }
  console.log(
    JSON.stringify({ ok: true, action: "clean", offerte: offertaIds.length, candidature: candIds.length }, null, 2)
  );
  return { offertaIds, candIds };
}

async function insertOfferta(
  pool: sql.ConnectionPool,
  row: {
    tenantId: string;
    titolo: string;
    luogo: string;
    modalitaLavoro: string;
    tipoContratto: string;
    orario: string;
    numeroPosizioni: number;
    descrizione: string;
    attivitaPrincipali: string;
    requisiti: string;
    competenze: string;
    retribuzione: string;
    benefit: string;
    stato: string;
  }
) {
  const id = cuid();
  const req = pool.request();
  req.input("id", sql.NVarChar(64), id);
  req.input("tenantId", sql.NVarChar(64), row.tenantId);
  req.input("titolo", sql.NVarChar(200), row.titolo);
  req.input("luogo", sql.NVarChar(200), row.luogo);
  req.input("modalita", sql.NVarChar(20), row.modalitaLavoro);
  req.input("contratto", sql.NVarChar(40), row.tipoContratto);
  req.input("orario", sql.NVarChar(20), row.orario);
  req.input("nPos", sql.Int, row.numeroPosizioni);
  req.input("desc", sql.NVarChar(sql.MAX), row.descrizione);
  req.input("att", sql.NVarChar(sql.MAX), row.attivitaPrincipali);
  req.input("req", sql.NVarChar(sql.MAX), row.requisiti);
  req.input("comp", sql.NVarChar(sql.MAX), row.competenze);
  req.input("ret", sql.NVarChar(500), row.retribuzione);
  req.input("ben", sql.NVarChar(sql.MAX), row.benefit);
  req.input("stato", sql.NVarChar(20), row.stato);
  await req.query(`
    INSERT INTO dbo.OfferteLavoro (
      Id, TenantId, Titolo, Luogo, ModalitaLavoro, TipoContratto, Orario,
      NumeroPosizioni, Descrizione, AttivitaPrincipali, Requisiti, Competenze,
      Retribuzione, Benefit, Paese, Stato, IndeedJobId, CreatedAt, UpdatedAt
    ) VALUES (
      @id, @tenantId, @titolo, @luogo, @modalita, @contratto, @orario,
      @nPos, @desc, @att, @req, @comp, @ret, @ben, N'IT', @stato, NULL,
      SYSUTCDATETIME(), SYSUTCDATETIME()
    )
  `);
  return id;
}

async function insertCandidatura(
  pool: sql.ConnectionPool,
  opts: {
    tenantId: string;
    offertaId: string;
    stato: string;
    source: string;
    receivedAt: Date;
  }
) {
  const id = cuid();
  const req = pool.request();
  req.input("id", sql.NVarChar(64), id);
  req.input("tenantId", sql.NVarChar(64), opts.tenantId);
  req.input("offertaId", sql.NVarChar(64), opts.offertaId);
  req.input("stato", sql.NVarChar(30), opts.stato);
  req.input("source", sql.NVarChar(80), opts.source);
  req.input("receivedAt", sql.DateTime2, opts.receivedAt);
  await req.query(`
    INSERT INTO dbo.RecruitingCandidature (
      Id, TenantId, OffertaId, ExternalApplicationId, ReceiverCandidateId,
      Stato, Source, ReceivedAt, UpdatedAt, LastSyncAt
    ) VALUES (
      @id, @tenantId, @offertaId, NULL, NULL,
      @stato, @source, @receivedAt, SYSUTCDATETIME(), NULL
    )
  `);
  return id;
}

async function insertAttivita(
  pool: sql.ConnectionPool,
  opts: {
    tenantId: string;
    candidaturaId: string;
    tipo: string;
    occurredAt: Date;
    note?: string;
    esito?: string | null;
    statoDa?: string | null;
    statoA?: string | null;
    canale?: string | null;
    colloquioId?: string | null;
    createdById: string;
  }
) {
  const req = pool.request();
  req.input("id", sql.NVarChar(64), cuid());
  req.input("tenantId", sql.NVarChar(64), opts.tenantId);
  req.input("candidaturaId", sql.NVarChar(64), opts.candidaturaId);
  req.input("tipo", sql.NVarChar(40), opts.tipo);
  req.input("occurredAt", sql.DateTime2, opts.occurredAt);
  req.input("note", sql.NVarChar(2000), opts.note || "");
  req.input("esito", sql.NVarChar(30), opts.esito ?? null);
  req.input("statoDa", sql.NVarChar(30), opts.statoDa ?? null);
  req.input("statoA", sql.NVarChar(30), opts.statoA ?? null);
  req.input("colloquioId", sql.NVarChar(64), opts.colloquioId ?? null);
  req.input("canale", sql.NVarChar(20), opts.canale ?? null);
  req.input("createdById", sql.NVarChar(64), opts.createdById);
  await req.query(`
    INSERT INTO dbo.RecruitingAttivita (
      Id, TenantId, CandidaturaId, Tipo, OccurredAt, Note, Esito,
      StatoDa, StatoA, ColloquioId, Canale, CreatedAt, CreatedById
    ) VALUES (
      @id, @tenantId, @candidaturaId, @tipo, @occurredAt, @note, @esito,
      @statoDa, @statoA, @colloquioId, @canale, SYSUTCDATETIME(), @createdById
    )
  `);
}

async function insertColloquio(
  pool: sql.ConnectionPool,
  opts: {
    tenantId: string;
    candidaturaId: string;
    round: number;
    stato: string;
    scheduledAt: Date;
    modalita: string;
    intervistatoreUserId: string;
    intervistatoreLabel: string;
    notePreliminari?: string;
    noteSvolgimento?: string;
    esito?: string | null;
    valutazione?: string;
    createdById: string;
  }
) {
  const id = cuid();
  const req = pool.request();
  req.input("id", sql.NVarChar(64), id);
  req.input("tenantId", sql.NVarChar(64), opts.tenantId);
  req.input("candidaturaId", sql.NVarChar(64), opts.candidaturaId);
  req.input("round", sql.Int, opts.round);
  req.input("stato", sql.NVarChar(30), opts.stato);
  req.input("scheduledAt", sql.DateTime2, opts.scheduledAt);
  req.input("modalita", sql.NVarChar(20), opts.modalita);
  req.input("intUser", sql.NVarChar(64), opts.intervistatoreUserId);
  req.input("intLabel", sql.NVarChar(120), opts.intervistatoreLabel);
  req.input("notePre", sql.NVarChar(2000), opts.notePreliminari || "");
  req.input("noteSvo", sql.NVarChar(2000), opts.noteSvolgimento || "");
  req.input("esito", sql.NVarChar(30), opts.esito ?? null);
  req.input("val", sql.NVarChar(2000), opts.valutazione || "");
  req.input("createdById", sql.NVarChar(64), opts.createdById);
  await req.query(`
    INSERT INTO dbo.RecruitingColloqui (
      Id, TenantId, CandidaturaId, Round, Stato, ScheduledAt, Modalita,
      IntervistatoreUserId, IntervistatoreLabel, NotePreliminari, NoteSvolgimento,
      Esito, Valutazione, CreatedAt, UpdatedAt, CreatedById
    ) VALUES (
      @id, @tenantId, @candidaturaId, @round, @stato, @scheduledAt, @modalita,
      @intUser, @intLabel, @notePre, @noteSvo, @esito, @val,
      SYSUTCDATETIME(), SYSUTCDATETIME(), @createdById
    )
  `);
  return id;
}

async function seed(pool: sql.ConnectionPool) {
  await clean(pool);

  const tables = await pool.request().query(`
    SELECT name FROM sys.tables
    WHERE name IN (N'OfferteLavoro', N'RecruitingCandidature', N'RecruitingAttivita', N'RecruitingColloqui')
  `);
  const names = new Set(tables.recordset.map((r) => String(r.name)));
  for (const need of ["OfferteLavoro", "RecruitingCandidature", "RecruitingAttivita", "RecruitingColloqui"]) {
    if (!names.has(need)) {
      throw new Error(`Tabella dbo.${need} assente — applica le migration 027–032 su CredixaDev`);
    }
  }

  const tenantRes = await pool.request().query(`SELECT TOP 1 Id,Slug FROM dbo.Tenants`);
  const userRes = await pool.request().query(`
    SELECT TOP 1 Id, Name FROM dbo.Users WHERE Active = 1 ORDER BY CreatedAt ASC
  `);
  const tenant = tenantRes.recordset[0];
  const user = userRes.recordset[0];
  if (!tenant || !user) throw new Error("Servono almeno un tenant e un utente in CredixaDev");

  const tenantId = String(tenant.Id);
  const userId = String(user.Id);
  const userName = String(user.Name || "Admin");

  const desc =
    "Gestione telefonate in ingresso e in uscita, aggiornamento pratiche e supporto al team operativo di sede.";

  const bozzaId = await insertOfferta(pool, {
    tenantId,
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
    stato: "BOZZA",
  });

  const pubblicataId = await insertOfferta(pool, {
    tenantId,
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
    stato: "PUBBLICATA",
  });

  const chiusaId = await insertOfferta(pool, {
    tenantId,
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
    stato: "CHIUSA",
  });

  async function candidatura(input: {
    offertaId: string;
    stato: string;
    hours: number;
    source?: string;
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
    const receivedAt = hoursAgo(input.hours);
    const id = await insertCandidatura(pool, {
      tenantId,
      offertaId: input.offertaId,
      stato: input.stato,
      source: input.source || SOURCE,
      receivedAt,
    });
    await insertAttivita(pool, {
      tenantId,
      candidaturaId: id,
      tipo: "RICEZIONE",
      occurredAt: receivedAt,
      statoA: "RICEVUTA",
      createdById: userId,
    });
    for (const a of input.attivita) {
      await insertAttivita(pool, {
        tenantId,
        candidaturaId: id,
        tipo: a.tipo,
        occurredAt: hoursAgo(a.hours),
        note: a.note,
        esito: a.esito,
        statoDa: a.statoDa,
        statoA: a.statoA,
        canale: a.canale,
        colloquioId: a.colloquioId,
        createdById: userId,
      });
    }
    return id;
  }

  await candidatura({ offertaId: pubblicataId, stato: "RICEVUTA", hours: 0, source: "percorso", attivita: [] });
  await candidatura({ offertaId: pubblicataId, stato: "RICEVUTA", hours: 48, attivita: [] });
  await candidatura({
    offertaId: pubblicataId,
    stato: "RICEVUTA",
    hours: 40,
    attivita: [{ tipo: "CONTATTO", hours: 36, canale: "TELEFONO", esito: "RAGGIUNTO", note: "Contatto mock." }],
  });
  await candidatura({
    offertaId: pubblicataId,
    stato: "IN_VALUTAZIONE",
    hours: 24,
    attivita: [
      { tipo: "CONTATTO", hours: 22, canale: "TELEFONO", esito: "RAGGIUNTO" },
      { tipo: "CAMBIO_STATO", hours: 21, statoDa: "RICEVUTA", statoA: "IN_VALUTAZIONE" },
      { tipo: "NOTA", hours: 20, note: "Nota mock: da convocare." },
    ],
  });

  const colloquioCand = await candidatura({
    offertaId: pubblicataId,
    stato: "COLLOQUIO",
    hours: 18,
    attivita: [
      { tipo: "CAMBIO_STATO", hours: 16, statoDa: "RICEVUTA", statoA: "IN_VALUTAZIONE" },
      { tipo: "CAMBIO_STATO", hours: 10, statoDa: "IN_VALUTAZIONE", statoA: "COLLOQUIO" },
    ],
  });
  const colloquioAperto = await insertColloquio(pool, {
    tenantId,
    candidaturaId: colloquioCand,
    round: 1,
    stato: "PROGRAMMATO",
    scheduledAt: hoursAgo(-24),
    modalita: "VIDEO",
    intervistatoreUserId: userId,
    intervistatoreLabel: userName,
    notePreliminari: "Verificare disponibilità oraria.",
    createdById: userId,
  });
  await insertAttivita(pool, {
    tenantId,
    candidaturaId: colloquioCand,
    tipo: "COLLOQUIO_PROGRAMMATO",
    occurredAt: hoursAgo(12),
    colloquioId: colloquioAperto,
    createdById: userId,
  });

  const positiva = await candidatura({
    offertaId: pubblicataId,
    stato: "PROVA",
    hours: 72,
    attivita: [
      { tipo: "CAMBIO_STATO", hours: 60, statoDa: "RICEVUTA", statoA: "IN_VALUTAZIONE" },
      { tipo: "CAMBIO_STATO", hours: 48, statoDa: "IN_VALUTAZIONE", statoA: "COLLOQUIO" },
      { tipo: "CAMBIO_STATO", hours: 28, statoDa: "COLLOQUIO", statoA: "PROVA" },
    ],
  });
  const colloquioPos = await insertColloquio(pool, {
    tenantId,
    candidaturaId: positiva,
    round: 1,
    stato: "ESITATO",
    scheduledAt: hoursAgo(30),
    modalita: "PRESENZA",
    intervistatoreUserId: userId,
    intervistatoreLabel: userName,
    notePreliminari: "Colloquio conoscitivo.",
    noteSvolgimento: "Svolto in sede.",
    esito: "POSITIVO",
    valutazione: "Profilo in linea.",
    createdById: userId,
  });
  await insertAttivita(pool, {
    tenantId,
    candidaturaId: positiva,
    tipo: "COLLOQUIO_ESITO",
    occurredAt: hoursAgo(29),
    esito: "POSITIVO",
    note: "Profilo in linea.",
    colloquioId: colloquioPos,
    createdById: userId,
  });

  await candidatura({
    offertaId: pubblicataId,
    stato: "ASSUNTA",
    hours: 96,
    attivita: [
      { tipo: "CAMBIO_STATO", hours: 50, statoDa: "COLLOQUIO", statoA: "PROVA" },
      { tipo: "CAMBIO_STATO", hours: 20, statoDa: "PROVA", statoA: "ASSUNTA" },
    ],
  });
  await candidatura({
    offertaId: chiusaId,
    stato: "ARCHIVIATA",
    hours: 120,
    attivita: [{ tipo: "CAMBIO_STATO", hours: 100, statoDa: "RICEVUTA", statoA: "ARCHIVIATA" }],
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "seed",
        backend: "sql-server",
        tenant: String(tenant.Slug),
        offerte: [
          `${MARKER} Operatore call center`,
          `${MARKER} Addetto back office`,
          `${MARKER} Stage amministrazione`,
        ],
        note: "Dati solo su SQL. Firebase non toccato.",
        clean: "npx tsx scripts/recruiting-mock.ts --clean",
      },
      null,
      2
    )
  );
  void bozzaId;
}

async function main() {
  const pool = await sql.connect(dbConfig());
  try {
    if (process.argv.includes("--clean")) await clean(pool);
    else await seed(pool);
  } finally {
    await pool.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
