import { Router } from "express";
import type { ConnectorConfig } from "../config.js";
import { createTenantResolver } from "../middleware/tenant.js";
import {
  getPraticaGiudizialeByPraticaId,
  listPraticheGiudiziali,
  listPratichePerAvvio,
  saveStrategiaProcedura,
  saveValutazioneLegale,
  upsertPraticaGiudiziale,
} from "../services/praticaGiudizialeService.js";

export function createPraticheGiudizialiRouter(cfg: ConnectorConfig) {
  const router = Router({ mergeParams: true });
  const resolveTenant = createTenantResolver(cfg);

  router.get("/", resolveTenant, async (req, res, next) => {
    try {
      const statiRaw = String(req.query.stati || "").trim();
      const stati = statiRaw
        ? statiRaw.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const items = await listPraticheGiudiziali(
        cfg.db,
        req.tenant!.tenantId,
        stati
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post("/per-avvio", resolveTenant, async (req, res, next) => {
    try {
      const items = await listPratichePerAvvio(cfg.db, req.tenant!.tenantId);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });
  router.get("/by-pratica/:praticaId", resolveTenant, async (req, res, next) => {
    try {
      const item = await getPraticaGiudizialeByPraticaId(
        cfg.db,
        req.tenant!.tenantId,
        String(req.params.praticaId)
      );
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/upsert", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const item = await upsertPraticaGiudiziale(cfg.db, req.tenant!.tenantId, {
        praticaId: String(body.praticaId),
        statoAvvio: String(body.statoAvvio || "BOZZA"),
        dataAffidamentoGiudiziale: body.dataAffidamentoGiudiziale ?? null,
        studioLegale: body.studioLegale ?? null,
        avvocatoReferente: body.avvocatoReferente ?? null,
        referenteInternoId: body.referenteInternoId ?? null,
        noteAffidamento: body.noteAffidamento ?? null,
        motivoPassaggio: body.motivoPassaggio ?? null,
        motivoAltroDettaglio: body.motivoAltroDettaglio ?? null,
        documentazioneDisponibile: body.documentazioneDisponibile ?? null,
        prescrizioneVerificata: body.prescrizioneVerificata ?? null,
        anagraficaDebitoreVerificata: body.anagraficaDebitoreVerificata ?? null,
        valutazioneRecuperabilita: body.valutazioneRecuperabilita ?? null,
        noteVerifica: body.noteVerifica ?? null,
        motivazioneArchiviazione: body.motivazioneArchiviazione ?? null,
        noteArchiviazione: body.noteArchiviazione ?? null,
        createdById: body.createdById ?? null,
        closedAt: body.closedAt ?? null,
      });
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/valutazione", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const item = await saveValutazioneLegale(cfg.db, req.tenant!.tenantId, {
        praticaId: String(body.praticaId),
        statoAvvio: String(body.statoAvvio || "IN_ATTESA_VALUTAZIONE_LEGALE"),
        titoloCreditoEsistenza: body.titoloCreditoEsistenza ?? null,
        titoloCreditoValidita: body.titoloCreditoValidita ?? null,
        titoloCreditoEsigibilita: body.titoloCreditoEsigibilita ?? null,
        prescrizioneTermini: body.prescrizioneTermini ?? null,
        documentazioneProve: body.documentazioneProve ?? null,
        contestazioniDebitore: body.contestazioniDebitore ?? null,
        solvibilitaRecupero: body.solvibilitaRecupero ?? null,
        giudiceCompetente: body.giudiceCompetente ?? null,
        foroEventuale: body.foroEventuale ?? null,
        tipoAzioneIpotizzata: body.tipoAzioneIpotizzata ?? null,
        tipoAzioneAltroDettaglio: body.tipoAzioneAltroDettaglio ?? null,
        costiBenefici: body.costiBenefici ?? null,
        rischiLegali: body.rischiLegali ?? null,
        parereValutazione: body.parereValutazione ?? null,
        parereMotivazione: body.parereMotivazione ?? null,
        valutazioneCompletataAt: body.valutazioneCompletataAt ?? null,
        valutazioneById: body.valutazioneById ?? null,
        createdById: body.createdById ?? null,
      });
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.post("/strategia", resolveTenant, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const item = await saveStrategiaProcedura(cfg.db, req.tenant!.tenantId, {
        praticaId: String(body.praticaId),
        statoAvvio: String(body.statoAvvio || "IN_PROCEDURA"),
        strategiaScelta: body.strategiaScelta ?? null,
        proceduraDaSeguire: body.proceduraDaSeguire ?? null,
        professionistaIncaricato: body.professionistaIncaricato ?? null,
        attivitaProceduraJson: body.attivitaProceduraJson ?? null,
        agendaScadenze: body.agendaScadenze ?? null,
        documentiDaProdurre: body.documentiDaProdurre ?? null,
        statoProcedura: body.statoProcedura ?? null,
        eventiStorico: body.eventiStorico ?? null,
        costiSostenuti: body.costiSostenuti ?? null,
        speseGiudizialiJson: body.speseGiudizialiJson ?? null,
        totaleSpeseGiudiziali:
          body.totaleSpeseGiudiziali != null
            ? Number(body.totaleSpeseGiudiziali)
            : null,
        esitoGiudiziale: body.esitoGiudiziale ?? null,
        dataEsito: body.dataEsito ?? null,
        importoRecuperato:
          body.importoRecuperato != null ? Number(body.importoRecuperato) : null,
        noteLegaliOperatori: body.noteLegaliOperatori ?? null,
        strategiaAggiornataAt: body.strategiaAggiornataAt ?? null,
        esitoRegistratoAt: body.esitoRegistratoAt ?? null,
        closedAt: body.closedAt ?? null,
        createdById: body.createdById ?? null,
      });
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
