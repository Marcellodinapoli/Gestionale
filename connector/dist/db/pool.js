import sql from "mssql";
let pool = null;
export function getPoolConfig(cfg) {
    return {
        server: cfg.server,
        port: cfg.port,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        options: {
            encrypt: false,
            trustServerCertificate: true,
            ...(cfg.port ? {} : { instanceName: cfg.instanceName }),
        },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    };
}
export async function getPool(cfg) {
    if (!pool) {
        pool = await sql.connect(getPoolConfig(cfg));
    }
    return pool;
}
export async function pingDb(cfg) {
    const start = performance.now();
    const p = await getPool(cfg);
    await p.request().query("SELECT 1 AS ok");
    return { ok: true, ms: Math.round(performance.now() - start) };
}
export async function closePool() {
    if (pool) {
        await pool.close();
        pool = null;
    }
}
export { sql };
