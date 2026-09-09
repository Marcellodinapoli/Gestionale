import { sql, getPool } from "../db/pool.js";
import type { ConnectorConfig } from "../config.js";

const COLS = `
  g.Id, g.TenantId, g.PraticaId, g.StatoAvvio, g.DataAffidamentoGiudiziale,
  g.StudioLegale, g.AvvocatoReferente, g.ReferenteInternoId, g.NoteAffidamento,
  g.MotivoPassaggio, g.MotivoAltroDettaglio,
  g.DocumentazioneDisponibile, g.PrescrizioneVerificata, g.AnagraficaDebitoreVerificata,
  g.ValutazioneRecuperabilita, g.NoteVerifica,
  g.MotivazioneArchiviazione, g.NoteArchiviazione,
  g.TitoloCreditoEsistenza, g.TitoloCreditoValidita, g.TitoloCreditoEsigibilita,
  g.PrescrizioneTermini, g.DocumentazioneProve, g.ContestazioniDebitore, g.SolvibilitaRecupero,
  g.GiudiceCompetente, g.ForoEventuale, g.TipoAzioneIpotizzata, g.TipoAzioneAltroDettaglio,
  g.CostiBenefici, g.RischiLegali, g.ParereValutazione, g.ParereMotivazione,
  g.ValutazioneCompletataAt, g.ValutazioneById,
  g.StrategiaScelta, g.ProceduraDaSeguire, g.ProfessionistaIncaricato, g.AttivitaProceduraJson,
  g.AgendaScadenze, g.DocumentiDaProdurre, g.StatoProcedura, g.EventiStorico, g.CostiSostenuti,
  g.EsitoGiudiziale, g.NoteLegaliOperatori, g.StrategiaAggiornataAt, g.EsitoRegistratoAt,
  g.CreatedById, g.CreatedAt, g.UpdatedAt, g.ClosedAt
`;

export async function getPraticaGiudizialeByPraticaId(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  praticaId: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .input("praticaId", sql.UniqueIdentifier, praticaId)
    .query(`
      SELECT ${COLS}
      FROM dbo.PraticheGiudiziali g
      WHERE g.TenantId = @tenantId AND g.PraticaId = @praticaId
    `);
  return res.recordset[0] ?? null;
}

export async function upsertPraticaGiudiziale(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  input: {
    praticaId: string;
    statoAvvio: string;
    dataAffidamentoGiudiziale?: string | Date | null;
    studioLegale?: string | null;
    avvocatoReferente?: string | null;
    referenteInternoId?: string | null;
    noteAffidamento?: string | null;
    motivoPassaggio?: string | null;
    motivoAltroDettaglio?: string | null;
    documentazioneDisponibile?: string | null;
    prescrizioneVerificata?: string | null;
    anagraficaDebitoreVerificata?: string | null;
    valutazioneRecuperabilita?: string | null;
    noteVerifica?: string | null;
    motivazioneArchiviazione?: string | null;
    noteArchiviazione?: string | null;
    createdById?: string | null;
    closedAt?: string | Date | null;
  }
) {
  const pool = await getPool(cfg);
  const existing = await getPraticaGiudizialeByPraticaId(cfg, tenantId, input.praticaId);
  const dataAff = input.dataAffidamentoGiudiziale
    ? new Date(input.dataAffidamentoGiudiziale)
    : null;
  const closedAt = input.closedAt ? new Date(input.closedAt) : null;

  if (existing) {
    await pool
      .request()
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .input("praticaId", sql.UniqueIdentifier, input.praticaId)
      .input("statoAvvio", sql.NVarChar(80), input.statoAvvio)
      .input("dataAff", sql.DateTime2, dataAff)
      .input("studio", sql.NVarChar(200), input.studioLegale ?? null)
      .input("avvocato", sql.NVarChar(200), input.avvocatoReferente ?? null)
      .input("referenteId", sql.UniqueIdentifier, input.referenteInternoId ?? null)
      .input("noteAff", sql.NVarChar(sql.MAX), input.noteAffidamento ?? null)
      .input("motivo", sql.NVarChar(80), input.motivoPassaggio ?? null)
      .input("motivoAltro", sql.NVarChar(500), input.motivoAltroDettaglio ?? null)
      .input("doc", sql.NVarChar(30), input.documentazioneDisponibile ?? null)
      .input("prescr", sql.NVarChar(30), input.prescrizioneVerificata ?? null)
      .input("anag", sql.NVarChar(30), input.anagraficaDebitoreVerificata ?? null)
      .input("valut", sql.NVarChar(30), input.valutazioneRecuperabilita ?? null)
      .input("noteVer", sql.NVarChar(sql.MAX), input.noteVerifica ?? null)
      .input("motArch", sql.NVarChar(1000), input.motivazioneArchiviazione ?? null)
      .input("noteArch", sql.NVarChar(sql.MAX), input.noteArchiviazione ?? null)
      .input("closedAt", sql.DateTime2, closedAt)
      .query(`
        UPDATE dbo.PraticheGiudiziali SET
          StatoAvvio = @statoAvvio,
          DataAffidamentoGiudiziale = @dataAff,
          StudioLegale = @studio,
          AvvocatoReferente = @avvocato,
          ReferenteInternoId = @referenteId,
          NoteAffidamento = @noteAff,
          MotivoPassaggio = @motivo,
          MotivoAltroDettaglio = @motivoAltro,
          DocumentazioneDisponibile = @doc,
          PrescrizioneVerificata = @prescr,
          AnagraficaDebitoreVerificata = @anag,
          ValutazioneRecuperabilita = @valut,
          NoteVerifica = @noteVer,
          MotivazioneArchiviazione = @motArch,
          NoteArchiviazione = @noteArch,
          ClosedAt = @closedAt,
          UpdatedAt = SYSUTCDATETIME()
        WHERE TenantId = @tenantId AND PraticaId = @praticaId
      `);
  } else {
    await pool
      .request()
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .input("praticaId", sql.UniqueIdentifier, input.praticaId)
      .input("statoAvvio", sql.NVarChar(80), input.statoAvvio)
      .input("dataAff", sql.DateTime2, dataAff)
      .input("studio", sql.NVarChar(200), input.studioLegale ?? null)
      .input("avvocato", sql.NVarChar(200), input.avvocatoReferente ?? null)
      .input("referenteId", sql.UniqueIdentifier, input.referenteInternoId ?? null)
      .input("noteAff", sql.NVarChar(sql.MAX), input.noteAffidamento ?? null)
      .input("motivo", sql.NVarChar(80), input.motivoPassaggio ?? null)
      .input("motivoAltro", sql.NVarChar(500), input.motivoAltroDettaglio ?? null)
      .input("doc", sql.NVarChar(30), input.documentazioneDisponibile ?? null)
      .input("prescr", sql.NVarChar(30), input.prescrizioneVerificata ?? null)
      .input("anag", sql.NVarChar(30), input.anagraficaDebitoreVerificata ?? null)
      .input("valut", sql.NVarChar(30), input.valutazioneRecuperabilita ?? null)
      .input("noteVer", sql.NVarChar(sql.MAX), input.noteVerifica ?? null)
      .input("motArch", sql.NVarChar(1000), input.motivazioneArchiviazione ?? null)
      .input("noteArch", sql.NVarChar(sql.MAX), input.noteArchiviazione ?? null)
      .input("createdById", sql.UniqueIdentifier, input.createdById ?? null)
      .input("closedAt", sql.DateTime2, closedAt)
      .query(`
        INSERT INTO dbo.PraticheGiudiziali (
          TenantId, PraticaId, StatoAvvio, DataAffidamentoGiudiziale, StudioLegale,
          AvvocatoReferente, ReferenteInternoId, NoteAffidamento, MotivoPassaggio,
          MotivoAltroDettaglio, DocumentazioneDisponibile, PrescrizioneVerificata,
          AnagraficaDebitoreVerificata, ValutazioneRecuperabilita, NoteVerifica,
          MotivazioneArchiviazione, NoteArchiviazione,
          CreatedById, CreatedAt, UpdatedAt, ClosedAt
        ) VALUES (
          @tenantId, @praticaId, @statoAvvio, @dataAff, @studio,
          @avvocato, @referenteId, @noteAff, @motivo,
          @motivoAltro, @doc, @prescr,
          @anag, @valut, @noteVer,
          @motArch, @noteArch,
          @createdById, SYSUTCDATETIME(), SYSUTCDATETIME(), @closedAt
        )
      `);
  }

  return getPraticaGiudizialeByPraticaId(cfg, tenantId, input.praticaId);
}

export async function listPraticheGiudiziali(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  stati?: string[]
) {
  const pool = await getPool(cfg);
  const req = pool.request().input("tenantId", sql.UniqueIdentifier, tenantId);
  let whereStato = "";
  if (stati?.length) {
    const parts = stati.map((s, i) => {
      const key = `stato${i}`;
      req.input(key, sql.NVarChar(80), s);
      return `@${key}`;
    });
    whereStato = ` AND g.StatoAvvio IN (${parts.join(", ")})`;
  }
  const res = await req.query(`
    SELECT TOP 200
      ${COLS},
      p.Numero AS PraticaNumero,
      p.Residuo AS Residuo,
      LTRIM(RTRIM(CONCAT(ISNULL(d.Cognome, N''), N' ', ISNULL(d.Nome, N'')))) AS DebitoreNome,
      m.Codice AS MandanteCodice
    FROM dbo.PraticheGiudiziali g
    INNER JOIN dbo.Pratiche p ON p.Id = g.PraticaId
    INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
    INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
    WHERE g.TenantId = @tenantId
    ${whereStato}
    ORDER BY g.UpdatedAt DESC
  `);
  return res.recordset;
}

export async function saveValutazioneLegale(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  input: {
    praticaId: string;
    statoAvvio: string;
    titoloCreditoEsistenza?: string | null;
    titoloCreditoValidita?: string | null;
    titoloCreditoEsigibilita?: string | null;
    prescrizioneTermini?: string | null;
    documentazioneProve?: string | null;
    contestazioniDebitore?: string | null;
    solvibilitaRecupero?: string | null;
    giudiceCompetente?: string | null;
    foroEventuale?: string | null;
    tipoAzioneIpotizzata?: string | null;
    tipoAzioneAltroDettaglio?: string | null;
    costiBenefici?: string | null;
    rischiLegali?: string | null;
    parereValutazione?: string | null;
    parereMotivazione?: string | null;
    valutazioneCompletataAt?: string | Date | null;
    valutazioneById?: string | null;
    createdById?: string | null;
  }
) {
  const pool = await getPool(cfg);
  const existing = await getPraticaGiudizialeByPraticaId(cfg, tenantId, input.praticaId);
  const completedAt = input.valutazioneCompletataAt
    ? new Date(input.valutazioneCompletataAt)
    : null;
  const altro =
    input.tipoAzioneIpotizzata === "ALTRA_PROCEDURA"
      ? input.tipoAzioneAltroDettaglio ?? null
      : null;

  const bindCommon = (req: {
    input: (name: string, type: unknown, value: unknown) => typeof req;
    query: (q: string) => Promise<unknown>;
  }) =>
    req
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .input("praticaId", sql.UniqueIdentifier, input.praticaId)
      .input("statoAvvio", sql.NVarChar(80), input.statoAvvio)
      .input("ex", sql.NVarChar(30), input.titoloCreditoEsistenza ?? null)
      .input("va", sql.NVarChar(30), input.titoloCreditoValidita ?? null)
      .input("es", sql.NVarChar(30), input.titoloCreditoEsigibilita ?? null)
      .input("prescr", sql.NVarChar(sql.MAX), input.prescrizioneTermini ?? null)
      .input("doc", sql.NVarChar(sql.MAX), input.documentazioneProve ?? null)
      .input("cont", sql.NVarChar(sql.MAX), input.contestazioniDebitore ?? null)
      .input("solv", sql.NVarChar(sql.MAX), input.solvibilitaRecupero ?? null)
      .input("giudice", sql.NVarChar(200), input.giudiceCompetente ?? null)
      .input("foro", sql.NVarChar(200), input.foroEventuale ?? null)
      .input("tipoAz", sql.NVarChar(40), input.tipoAzioneIpotizzata ?? null)
      .input("tipoAltro", sql.NVarChar(500), altro)
      .input("costi", sql.NVarChar(sql.MAX), input.costiBenefici ?? null)
      .input("rischi", sql.NVarChar(sql.MAX), input.rischiLegali ?? null)
      .input("parere", sql.NVarChar(40), input.parereValutazione ?? null)
      .input("parereMot", sql.NVarChar(sql.MAX), input.parereMotivazione ?? null)
      .input("valAt", sql.DateTime2, completedAt)
      .input("valBy", sql.UniqueIdentifier, input.valutazioneById ?? null);

  if (existing) {
    await bindCommon(pool.request() as never).query(`
      UPDATE dbo.PraticheGiudiziali SET
        StatoAvvio = @statoAvvio,
        TitoloCreditoEsistenza = @ex,
        TitoloCreditoValidita = @va,
        TitoloCreditoEsigibilita = @es,
        PrescrizioneTermini = @prescr,
        DocumentazioneProve = @doc,
        ContestazioniDebitore = @cont,
        SolvibilitaRecupero = @solv,
        GiudiceCompetente = @giudice,
        ForoEventuale = @foro,
        TipoAzioneIpotizzata = @tipoAz,
        TipoAzioneAltroDettaglio = @tipoAltro,
        CostiBenefici = @costi,
        RischiLegali = @rischi,
        ParereValutazione = @parere,
        ParereMotivazione = @parereMot,
        ValutazioneCompletataAt = @valAt,
        ValutazioneById = @valBy,
        UpdatedAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId AND PraticaId = @praticaId
    `);
  } else {
    await bindCommon(pool.request() as never)
      .input("createdById", sql.UniqueIdentifier, input.createdById ?? null)
      .query(`
        INSERT INTO dbo.PraticheGiudiziali (
          TenantId, PraticaId, StatoAvvio,
          TitoloCreditoEsistenza, TitoloCreditoValidita, TitoloCreditoEsigibilita,
          PrescrizioneTermini, DocumentazioneProve, ContestazioniDebitore, SolvibilitaRecupero,
          GiudiceCompetente, ForoEventuale, TipoAzioneIpotizzata, TipoAzioneAltroDettaglio,
          CostiBenefici, RischiLegali, ParereValutazione, ParereMotivazione,
          ValutazioneCompletataAt, ValutazioneById,
          CreatedById, CreatedAt, UpdatedAt
        ) VALUES (
          @tenantId, @praticaId, @statoAvvio,
          @ex, @va, @es,
          @prescr, @doc, @cont, @solv,
          @giudice, @foro, @tipoAz, @tipoAltro,
          @costi, @rischi, @parere, @parereMot,
          @valAt, @valBy,
          @createdById, SYSUTCDATETIME(), SYSUTCDATETIME()
        )
      `);
  }

  return getPraticaGiudizialeByPraticaId(cfg, tenantId, input.praticaId);
}

export async function saveStrategiaProcedura(
  cfg: ConnectorConfig["db"],
  tenantId: string,
  input: {
    praticaId: string;
    statoAvvio: string;
    strategiaScelta?: string | null;
    proceduraDaSeguire?: string | null;
    professionistaIncaricato?: string | null;
    attivitaProceduraJson?: string | null;
    agendaScadenze?: string | null;
    documentiDaProdurre?: string | null;
    statoProcedura?: string | null;
    eventiStorico?: string | null;
    costiSostenuti?: string | null;
    esitoGiudiziale?: string | null;
    noteLegaliOperatori?: string | null;
    strategiaAggiornataAt?: string | Date | null;
    esitoRegistratoAt?: string | Date | null;
    closedAt?: string | Date | null;
    createdById?: string | null;
  }
) {
  const pool = await getPool(cfg);
  const existing = await getPraticaGiudizialeByPraticaId(cfg, tenantId, input.praticaId);
  const stratAt = input.strategiaAggiornataAt
    ? new Date(input.strategiaAggiornataAt)
    : null;
  const esitoAt = input.esitoRegistratoAt
    ? new Date(input.esitoRegistratoAt)
    : null;
  const closedAt = input.closedAt ? new Date(input.closedAt) : null;

  const bindCommon = (req: {
    input: (name: string, type: unknown, value: unknown) => typeof req;
    query: (q: string) => Promise<unknown>;
  }) =>
    req
      .input("tenantId", sql.UniqueIdentifier, tenantId)
      .input("praticaId", sql.UniqueIdentifier, input.praticaId)
      .input("statoAvvio", sql.NVarChar(80), input.statoAvvio)
      .input("strategia", sql.NVarChar(40), input.strategiaScelta ?? null)
      .input("procedura", sql.NVarChar(sql.MAX), input.proceduraDaSeguire ?? null)
      .input("prof", sql.NVarChar(200), input.professionistaIncaricato ?? null)
      .input("attJson", sql.NVarChar(sql.MAX), input.attivitaProceduraJson ?? null)
      .input("agenda", sql.NVarChar(sql.MAX), input.agendaScadenze ?? null)
      .input("docs", sql.NVarChar(sql.MAX), input.documentiDaProdurre ?? null)
      .input("statoProc", sql.NVarChar(40), input.statoProcedura ?? null)
      .input("eventi", sql.NVarChar(sql.MAX), input.eventiStorico ?? null)
      .input("costi", sql.NVarChar(500), input.costiSostenuti ?? null)
      .input("esito", sql.NVarChar(40), input.esitoGiudiziale ?? null)
      .input("note", sql.NVarChar(sql.MAX), input.noteLegaliOperatori ?? null)
      .input("stratAt", sql.DateTime2, stratAt)
      .input("esitoAt", sql.DateTime2, esitoAt)
      .input("closedAt", sql.DateTime2, closedAt);

  if (existing) {
    await bindCommon(pool.request() as never).query(`
      UPDATE dbo.PraticheGiudiziali SET
        StatoAvvio = @statoAvvio,
        StrategiaScelta = @strategia,
        ProceduraDaSeguire = @procedura,
        ProfessionistaIncaricato = @prof,
        AttivitaProceduraJson = @attJson,
        AgendaScadenze = @agenda,
        DocumentiDaProdurre = @docs,
        StatoProcedura = @statoProc,
        EventiStorico = @eventi,
        CostiSostenuti = @costi,
        EsitoGiudiziale = @esito,
        NoteLegaliOperatori = @note,
        StrategiaAggiornataAt = @stratAt,
        EsitoRegistratoAt = @esitoAt,
        ClosedAt = COALESCE(@closedAt, ClosedAt),
        UpdatedAt = SYSUTCDATETIME()
      WHERE TenantId = @tenantId AND PraticaId = @praticaId
    `);
  } else {
    await bindCommon(pool.request() as never)
      .input("createdById", sql.UniqueIdentifier, input.createdById ?? null)
      .query(`
        INSERT INTO dbo.PraticheGiudiziali (
          TenantId, PraticaId, StatoAvvio,
          StrategiaScelta, ProceduraDaSeguire, ProfessionistaIncaricato, AttivitaProceduraJson,
          AgendaScadenze, DocumentiDaProdurre, StatoProcedura, EventiStorico, CostiSostenuti,
          EsitoGiudiziale, NoteLegaliOperatori, StrategiaAggiornataAt, EsitoRegistratoAt,
          CreatedById, CreatedAt, UpdatedAt, ClosedAt
        ) VALUES (
          @tenantId, @praticaId, @statoAvvio,
          @strategia, @procedura, @prof, @attJson,
          @agenda, @docs, @statoProc, @eventi, @costi,
          @esito, @note, @stratAt, @esitoAt,
          @createdById, SYSUTCDATETIME(), SYSUTCDATETIME(), @closedAt
        )
      `);
  }

  return getPraticaGiudizialeByPraticaId(cfg, tenantId, input.praticaId);
}

/** Pratiche su cui si puo usare Avvia giudiziale (non solo-stragiudiziale). */
export async function listPratichePerAvvio(
  cfg: ConnectorConfig["db"],
  tenantId: string
) {
  const pool = await getPool(cfg);
  const res = await pool
    .request()
    .input("tenantId", sql.UniqueIdentifier, tenantId)
    .query(`
      SELECT TOP 200
        p.Id AS PraticaId,
        p.Numero AS PraticaNumero,
        p.Residuo AS Residuo,
        LTRIM(RTRIM(CONCAT(ISNULL(d.Cognome, N''), N' ', ISNULL(d.Nome, N'')))) AS DebitoreNome,
        m.Codice AS MandanteCodice,
        g.StatoAvvio AS StatoAvvio,
        g.MotivoPassaggio AS MotivoPassaggio
      FROM dbo.Pratiche p
      INNER JOIN dbo.Debitori d ON d.Id = p.DebitoreId
      INNER JOIN dbo.Mandanti m ON m.Id = p.MandanteId
      LEFT JOIN dbo.PraticheGiudiziali g ON g.PraticaId = p.Id
      WHERE p.TenantId = @tenantId
        AND (p.ConferimentoTipo IS NULL OR p.ConferimentoTipo = N'' OR p.ConferimentoTipo <> N'STRAGIUDIZIALE')
      ORDER BY p.UpdatedAt DESC
    `);
  return res.recordset.map((r: Record<string, unknown>) => ({
    praticaId: String(r.PraticaId),
    praticaNumero: String(r.PraticaNumero),
    residuo: Number(r.Residuo || 0),
    debitoreNome: String(r.DebitoreNome || "—"),
    mandanteCodice: String(r.MandanteCodice || "—"),
    statoAvvio: r.StatoAvvio != null ? String(r.StatoAvvio) : null,
    motivoPassaggio: r.MotivoPassaggio != null ? String(r.MotivoPassaggio) : null,
  }));
}
