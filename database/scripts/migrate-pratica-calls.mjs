import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const importLine = `import { praticaDbFromUser, idsAffidoTemporaneoForTenant, idsImportoTotaleForTenant, idsTotIncassatoForTenant, type PraticaDbContext } from "@/lib/praticheRepo";`;

const files = [
  "src/actions/assignPratica.ts",
  "src/app/(app)/pratiche/page.tsx",
  "src/app/(app)/pratiche/[id]/page.tsx",
  "src/app/(app)/pratiche/[id]/stampa/page.tsx",
  "src/app/(app)/pratiche/[id]/incassi/page.tsx",
  "src/app/(app)/pratiche/[id]/fatture/page.tsx",
  "src/app/(app)/pratiche/[id]/estratto/page.tsx",
  "src/app/api/pratiche-cerca/route.ts",
  "src/app/api/pratiche/[id]/extra/route.ts",
  "src/lib/praticheStessoDebitore.ts",
  "src/lib/praticheAltriFiltri.ts",
  "src/lib/praticaOrdine.ts",
  "src/lib/domain.ts",
  "src/lib/gruppoPerimetroScope.ts",
  "src/lib/codiciMandantePerimetro.ts",
  "src/lib/lavorateOggi.ts",
  "src/lib/lavorazioneSuggerita.ts",
  "src/app/(app)/lavorazione/page.tsx",
  "src/lib/registrazioniScope.ts",
  "src/lib/sanzioneIncassoMassivo.ts",
  "src/lib/memoAgenda.ts",
  "src/actions/registrazioni.ts",
];

for (const rel of files) {
  const f = path.join(root, rel);
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("prisma.pratica")) {
    console.log("skip (no prisma.pratica):", rel);
    continue;
  }
  if (!s.includes('from "@/lib/praticheRepo"')) {
    s = s.replace(
      /import \{ prisma \} from "@\/lib\/prisma";/,
      `import { prisma } from "@/lib/prisma";\n${importLine}`
    );
  }
  s = s.replace(/prisma\.pratica/g, "praticaModel");

  if (s.includes("requireUser()") && !s.includes("const praticaModel = praticaDbFromUser(user)")) {
    s = s.replace(
      /const user = await requireUser\(\);/,
      "const user = await requireUser();\n  const praticaModel = praticaDbFromUser(user);"
    );
  }

  if (s.includes("requireApiUser()") && !s.includes("const praticaModel = praticaDbFromUser(user)")) {
    s = s.replace(
      /(const user = await requireApiUser\(\);\s*if \(user instanceof NextResponse\) return user;)/,
      "$1\n\n  const praticaModel = praticaDbFromUser(user);"
    );
  }

  fs.writeFileSync(f, s);
  console.log("updated:", rel);
}
