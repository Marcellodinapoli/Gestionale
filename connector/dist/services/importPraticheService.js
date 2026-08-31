import { sql, getPool } from "../db/pool.js";
import { nextNumeroPratica } from "./praticheService.js";
const PRATICA_FIELD_MAP = {
    numeroMandante: "NumeroMandante",
    contratto: "Contratto",
    commessa: "Commessa",
    scadenza: "Scadenza",
    capitale: "Capitale",
    interessi: "Interessi",
    spese: "Spese",
    speseRecupero: "SpeseRecupero",
    residuo: "Residuo",
    importoRata: "ImportoRata",
    rateArretrate: "RateArretrate",
    nettoDaPagare: "NettoDaPagare",
    stato: "Stato",
    importBatchId: "ImportBatchId",
};
const DEBITORE_FIELD_MAP = {
    nome: "Nome",
    cognome: "Cognome",
    codiceFiscale: "CodiceFiscale",
    telefono: "Telefono",
    citta: "Citta",
    indirizzo: "Indirizzo",
    cap: "Cap",
    provincia: "Provincia",
};
async function allocateNumeriPratica(cfg, tenantId, count) {
    if (count <= 0)
        return [];
    const first = await nextNumeroPratica(cfg, tenantId);
    const year = new Date().getFullYear();
    const match = first.match(/PRC-(\d+)-(\d+)/);
    const startN = match ? Number(match[2]) : 1;
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push(`PRC-${year}-${String(startN + i).padStart(4, "0")}`);
    }
    return out;
}
function bindDynamicUpdate(req, prefix, data, fieldMap, idx) {
    const sets = [];
    for (const [k, v] of Object.entries(data)) {
        if (v === undefined)
            continue;
        const col = fieldMap[k];
        if (!col)
            continue;
        const p = `${prefix}${idx.n++}`;
        if (v === null) {
            sets.push(`${col} = NULL`);
        }
        else if (typeof v === "number") {
            req.input(p, sql.Decimal(18, 2), v);
            sets.push(`${col} = @${p}`);
        }
        else if (k.includes("Id") || k.endsWith("Id")) {
            req.input(p, sql.UniqueIdentifier, String(v));
            sets.push(`${col} = @${p}`);
        }
        else if (k.includes("At") || k === "scadenza" || k === "dataAffido") {
            req.input(p, sql.DateTime2, new Date(String(v)));
            sets.push(`${col} = @${p}`);
        }
        else {
            req.input(p, sql.NVarChar(500), String(v));
            sets.push(`${col} = @${p}`);
        }
    }
    return sets;
}
export async function processImportPraticheChunk(cfg, tenantId, input) {
    const pool = await getPool(cfg);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const createdPratiche = [];
    try {
        const idx = { n: 0 };
        for (const u of input.updates) {
            const req = new sql.Request(tx);
            req.input("tenantId", sql.UniqueIdentifier, tenantId);
            req.input("praticaId", sql.UniqueIdentifier, u.praticaId);
            req.input("debitoreId", sql.UniqueIdentifier, u.debitoreId);
            const debSets = bindDynamicUpdate(req, "d", u.debitore, DEBITORE_FIELD_MAP, idx);
            if (debSets.length) {
                await req.query(`
          UPDATE dbo.Debitori SET ${debSets.join(", ")}
          WHERE Id = @debitoreId AND TenantId = @tenantId
        `);
            }
            const prSets = bindDynamicUpdate(req, "p", u.pratica, PRATICA_FIELD_MAP, idx);
            prSets.push("UpdatedAt = SYSUTCDATETIME()");
            await req.query(`
        UPDATE dbo.Pratiche SET ${prSets.join(", ")}
        WHERE Id = @praticaId AND TenantId = @tenantId
      `);
        }
        const numeri = await allocateNumeriPratica(cfg, tenantId, input.creates.length);
        let numIdx = 0;
        for (const c of input.creates) {
            const reqDeb = new sql.Request(tx);
            reqDeb.input("tenantId", sql.UniqueIdentifier, tenantId);
            reqDeb.input("nome", sql.NVarChar(100), c.debitore.nome);
            reqDeb.input("cognome", sql.NVarChar(100), c.debitore.cognome);
            reqDeb.input("cf", sql.NVarChar(50), c.debitore.codiceFiscale ?? null);
            reqDeb.input("tel", sql.NVarChar(50), c.debitore.telefono ?? null);
            reqDeb.input("citta", sql.NVarChar(100), c.debitore.citta ?? null);
            reqDeb.input("ind", sql.NVarChar(200), c.debitore.indirizzo ?? null);
            reqDeb.input("cap", sql.NVarChar(10), c.debitore.cap ?? null);
            reqDeb.input("prov", sql.NVarChar(5), c.debitore.provincia ?? null);
            const debRes = await reqDeb.query(`
        INSERT INTO dbo.Debitori (TenantId, Nome, Cognome, CodiceFiscale, Telefono, Citta, Indirizzo, Cap, Provincia, CreatedAt)
        OUTPUT INSERTED.Id
        VALUES (@tenantId, @nome, @cognome, @cf, @tel, @citta, @ind, @cap, @prov, SYSUTCDATETIME())
      `);
            const debitoreId = String(debRes.recordset[0].Id);
            const numero = numeri[numIdx++] ?? (await nextNumeroPratica(cfg, tenantId));
            const p = c.pratica;
            const reqP = new sql.Request(tx);
            reqP.input("tenantId", sql.UniqueIdentifier, tenantId);
            reqP.input("numero", sql.NVarChar(50), numero);
            reqP.input("mandanteId", sql.UniqueIdentifier, p.mandanteId);
            reqP.input("debitoreId", sql.UniqueIdentifier, debitoreId);
            reqP.input("numeroMandante", sql.NVarChar(100), p.numeroMandante);
            reqP.input("contratto", sql.NVarChar(100), p.contratto ?? null);
            reqP.input("commessa", sql.NVarChar(100), p.commessa ?? null);
            reqP.input("dataAffido", sql.DateTime2, new Date(p.dataAffido));
            reqP.input("scadenza", sql.DateTime2, p.scadenza ? new Date(p.scadenza) : null);
            reqP.input("capitale", sql.Decimal(18, 2), p.capitale);
            reqP.input("interessi", sql.Decimal(18, 2), p.interessi);
            reqP.input("spese", sql.Decimal(18, 2), p.spese);
            reqP.input("speseRec", sql.Decimal(18, 2), p.speseRecupero);
            reqP.input("residuo", sql.Decimal(18, 2), p.residuo);
            reqP.input("importoRata", sql.Decimal(18, 2), p.importoRata ?? null);
            reqP.input("rateArretrate", sql.Int, p.rateArretrate ?? null);
            reqP.input("netto", sql.Decimal(18, 2), p.nettoDaPagare);
            reqP.input("stato", sql.NVarChar(50), p.stato);
            reqP.input("batchId", sql.UniqueIdentifier, p.importBatchId);
            const prRes = await reqP.query(`
        INSERT INTO dbo.Pratiche (
          TenantId, Numero, MandanteId, DebitoreId, NumeroMandante, Contratto, Commessa,
          DataAffido, Scadenza, Capitale, Interessi, Spese, SpeseRecupero, Residuo,
          ImportoRata, RateArretrate, NettoDaPagare, Stato, ImportBatchId, CreatedAt, UpdatedAt
        )
        OUTPUT INSERTED.Id
        VALUES (
          @tenantId, @numero, @mandanteId, @debitoreId, @numeroMandante, @contratto, @commessa,
          @dataAffido, @scadenza, @capitale, @interessi, @spese, @speseRec, @residuo,
          @importoRata, @rateArretrate, @netto, @stato, @batchId, SYSUTCDATETIME(), SYSUTCDATETIME()
        )
      `);
            createdPratiche.push({
                id: String(prRes.recordset[0].Id),
                debitoreId,
                contratto: p.contratto ?? null,
                commessa: p.commessa ?? null,
                stato: p.stato,
                codiceFiscale: c.debitore.codiceFiscale ?? null,
            });
        }
        await tx.commit();
        return {
            created: input.creates.length,
            updated: input.updates.length,
            skipped: 0,
            createdPratiche,
        };
    }
    catch (err) {
        await tx.rollback();
        throw err;
    }
}
