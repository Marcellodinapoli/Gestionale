import express from "express";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { closePool } from "./db/pool.js";
import { apiKeyGuard } from "./middleware/tenant.js";
import { createHealthRouter } from "./routes/health.js";
import { createPraticheRouter } from "./routes/pratiche.js";
import { createMandantiRouter } from "./routes/mandanti.js";
import { createDebitoriRouter } from "./routes/debitori.js";
import { createIncassiRouter } from "./routes/incassi.js";
import { createAttivitaRouter } from "./routes/attivita.js";
import { createDashboardRouter } from "./routes/dashboard.js";
import { createLockRouter } from "./routes/lock.js";
import { createAgendaRouter } from "./routes/agenda.js";
import { createImpegniAgendaRouter } from "./routes/impegniAgenda.js";
import { createMessaggiAgendaRouter } from "./routes/messaggiAgenda.js";
import { createMessaggiInterniRouter } from "./routes/messaggiInterni.js";
import { createAuditRouter } from "./routes/audit.js";
import { createImportBatchRouter } from "./routes/importBatch.js";
import { purgeExpiredLocksBatch } from "./services/lockService.js";
import { createAuthRouter, createInternalRouter } from "./routes/auth.js";
function loadEnvFile() {
    const candidates = [
        resolve(process.cwd(), ".env"),
        resolve(process.cwd(), "connector", ".env"),
    ];
    for (const envPath of candidates) {
        if (!existsSync(envPath))
            continue;
        for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
            const t = line.trim();
            if (!t || t.startsWith("#"))
                continue;
            const i = t.indexOf("=");
            if (i < 0)
                continue;
            const key = t.slice(0, i).trim();
            let val = t.slice(i + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            if (!(key in process.env))
                process.env[key] = val;
        }
    }
}
loadEnvFile();
const cfg = loadConfig();
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(apiKeyGuard(cfg));
app.use(createHealthRouter(cfg));
app.use("/api/v1/tenants", createAuthRouter(cfg));
app.use("/api/v1/internal", createInternalRouter(cfg));
app.use("/api/v1/tenants/:tenantId/pratiche", createPraticheRouter(cfg));
app.use("/api/v1/tenants/:tenantId/mandanti", createMandantiRouter(cfg));
app.use("/api/v1/tenants/:tenantId/debitori", createDebitoriRouter(cfg));
app.use("/api/v1/tenants/:tenantId/incassi", createIncassiRouter(cfg));
app.use("/api/v1/tenants/:tenantId/attivita", createAttivitaRouter(cfg));
app.use("/api/v1/tenants/:tenantId/dashboard", createDashboardRouter(cfg));
app.use("/api/v1/tenants/:tenantId/agenda", createAgendaRouter(cfg));
app.use("/api/v1/tenants/:tenantId/impegni-agenda", createImpegniAgendaRouter(cfg));
app.use("/api/v1/tenants/:tenantId/messaggi-agenda", createMessaggiAgendaRouter(cfg));
app.use("/api/v1/tenants/:tenantId/messaggi-interni", createMessaggiInterniRouter(cfg));
app.use("/api/v1/tenants/:tenantId/audit", createAuditRouter(cfg));
app.use("/api/v1/tenants/:tenantId/import-batch", createImportBatchRouter(cfg));
app.use("/api/v1/tenants/:tenantId/pratiche", createLockRouter(cfg));
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({
        error: err instanceof Error ? err.message : "Errore interno",
    });
});
const server = app.listen(cfg.port, () => {
    console.log(`Credixa Connector in ascolto su http://localhost:${cfg.port}`);
    console.log(`Database target: ${cfg.db.database} @ ${cfg.db.server}`);
});
setInterval(() => {
    purgeExpiredLocksBatch(cfg.db).catch((err) => console.error("lock cleanup batch", err));
}, 5 * 60 * 1000);
async function shutdown() {
    server.close();
    await closePool();
    process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
