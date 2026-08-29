import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseDateOnly } from "@/lib/domain";
import { getCurrentUser, isCurrentUserPasswordExpired } from "@/lib/auth";
import { can, isManutenzione } from "@/lib/permissions";
import { parseImportContesto } from "@/lib/importContesto";
import {
  finalizePraticheImport,
  initPraticheImportBatch,
  processPraticheImportChunk,
  type PraticheImportContext,
} from "@/lib/importPraticheBatch";

function ctxForClient(ctx: PraticheImportContext) {
  return {
    ...ctx,
    affidoIl:
      ctx.affidoIl instanceof Date ? ctx.affidoIl.toISOString() : String(ctx.affidoIl),
    scadenzaMandato: ctx.scadenzaMandato
      ? ctx.scadenzaMandato instanceof Date
        ? ctx.scadenzaMandato.toISOString()
        : String(ctx.scadenzaMandato)
      : null,
  };
}

function ctxFromClient(ctx: PraticheImportContext): PraticheImportContext {
  return {
    ...ctx,
    affidoIl: new Date(ctx.affidoIl as unknown as string),
    scadenzaMandato: ctx.scadenzaMandato
      ? new Date(ctx.scadenzaMandato as unknown as string)
      : null,
  };
}

async function requireImportUser() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  if (await isCurrentUserPasswordExpired()) {
    return NextResponse.json(
      { error: "Password scaduta: aggiornala per continuare" },
      { status: 403 }
    );
  }
  if (isManutenzione(user)) {
    return NextResponse.json({ error: "Account manutenzione: sola lettura" }, { status: 403 });
  }
  if (!can(user, "import:run")) {
    return NextResponse.json({ error: "Operazione non consentita" }, { status: 403 });
  }
  return user;
}

export async function POST(request: Request) {
  const userOrRes = await requireImportUser();
  if (userOrRes instanceof NextResponse) return userOrRes;
  const user = userOrRes;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const step = String(body.step || "");

  if (step === "init") {
    const fd = new FormData();
    fd.set("mandanteId", String(body.mandanteId || ""));
    fd.set("perimetro", String(body.perimetro || ""));
    fd.set("lotto", String(body.lotto || ""));
    fd.set("affidoIl", String(body.affidoIl || ""));
    if (body.scadenzaMandato) fd.set("scadenzaMandato", String(body.scadenzaMandato));

    const contesto = await parseImportContesto(fd, user.tenantId);
    if ("error" in contesto) {
      return NextResponse.json({ error: contesto.error }, { status: 400 });
    }

    const { mandanteId, perimetro, lotto, affidoIl, mandanteCodice, scadenzaMandato } =
      contesto.ok;

    const ctx = await initPraticheImportBatch({
      tenantId: user.tenantId,
      userId: user.id,
      userName: user.name,
      mandanteId,
      mandanteCodice,
      perimetro,
      lotto,
      affidoIl,
      scadenzaMandato,
      fileName: body.fileName ? String(body.fileName).trim() : null,
    });

    return NextResponse.json({
      ok: true,
      ctx: ctxForClient(ctx),
    });
  }

  if (step === "chunk") {
    const rawCtx = body.ctx as PraticheImportContext | undefined;
    if (!rawCtx?.batchId) {
      return NextResponse.json({ error: "Batch import mancante" }, { status: 400 });
    }
    const lines = Array.isArray(body.lines) ? body.lines.map((l) => String(l)) : [];
    const header = Array.isArray(body.header)
      ? body.header.map((h) => String(h).trim().toLowerCase())
      : [];
    const delim = body.delim === "," ? "," : ";";

    const result = await processPraticheImportChunk({
      tenantId: user.tenantId,
      ctx: ctxFromClient(rawCtx),
      header,
      delim,
      lines,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  if (step === "finalize") {
    const rawCtx = body.ctx as PraticheImportContext | undefined;
    const totals = body.totals as
      | { created: number; updated: number; skipped: number }
      | undefined;
    if (!rawCtx?.batchId || !totals) {
      return NextResponse.json({ error: "Dati finalizzazione mancanti" }, { status: 400 });
    }

    const maxScadenzaCsv = body.maxScadenzaCsv
      ? parseDateOnly(String(body.maxScadenzaCsv))
      : null;

    const ctx = ctxFromClient(rawCtx);
    const { imported } = await finalizePraticheImport({
      tenantId: user.tenantId,
      userId: user.id,
      ctx,
      totals,
      maxScadenzaCsv,
    });

    revalidatePath("/pratiche");
    revalidatePath("/import");

    if (imported === 0) {
      return NextResponse.json({
        error: `Nessuna pratica importata (${totals.skipped} righe saltate).`,
      });
    }

    return NextResponse.json({
      ok: ctx.isIntegrazione
        ? `Integrazione completata sul lotto ${ctx.lotto}.`
        : `Import completato sul lotto ${ctx.lotto}.`,
      importSummary: {
        isIntegrazione: ctx.isIntegrazione,
        lotto: ctx.lotto,
        mandanteCodice: ctx.mandanteCodice,
        perimetro: ctx.perimetro,
        created: totals.created,
        updated: totals.updated,
        skipped: totals.skipped,
      },
    });
  }

  return NextResponse.json({ error: "Step non valido" }, { status: 400 });
}
