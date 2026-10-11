// Esegue i test *.test.ts con node:test, compilandoli con esbuild (già presente via Next).
// neonQuery è sostituito da un database finto in memoria: nessuna connessione reale.
import { build } from "esbuild";
import { readdirSync, statSync, mkdirSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const support = join(root, "scripts", "test-support");
const outDir = join(root, "node_modules", ".cache", "credixa-tests");

function findTests(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) findTests(p, acc);
    else if (name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

const stubs = {
  "server-only": join(support, "empty.mjs"),
  "@/lib/prisma": join(support, "prisma-stub.mjs"),
  "@/lib/neon/pool": join(support, "fake-neon-pool.mjs"),
};

const tests = findTests(join(root, "src"));
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const outFiles = [];
for (const file of tests) {
  const outfile = join(outDir, relative(root, file).replace(/[\\/]/g, "__").replace(/\.ts$/, ".mjs"));
  await build({
    entryPoints: [file],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    tsconfig: join(root, "tsconfig.json"),
    logLevel: "error",
    plugins: [
      {
        name: "test-stubs",
        setup(b) {
          b.onResolve({ filter: /^(server-only|@\/lib\/prisma|@\/lib\/neon\/pool)$/ }, (a) => ({ path: stubs[a.path] }));
        },
      },
    ],
  });
  outFiles.push(outfile);
}
const r = spawnSync(process.execPath, ["--test", ...outFiles], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_PROVIDER: "neon", NEON_DATABASE_URL: "" },
});
process.exit(r.status ?? 1);
