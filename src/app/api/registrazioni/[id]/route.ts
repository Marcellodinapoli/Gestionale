import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { praticaWhere } from "@/lib/domain";
import { pathRegistrazione } from "@/lib/registrazioneAudio";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !can(user, "report:view")) {
    return new NextResponse("Non autorizzato", { status: 401 });
  }

  const { id } = await params;
  const rec = await prisma.registrazioneChiamata.findFirst({
    where: {
      id,
      pratica: praticaWhere(user),
    },
    select: { fileName: true },
  });
  if (!rec) return new NextResponse("Non trovata", { status: 404 });

  const filePath = pathRegistrazione(rec.fileName);
  if (!existsSync(filePath)) {
    return new NextResponse("File audio assente", { status: 404 });
  }

  const bytes = await readFile(filePath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${rec.fileName}"`,
    },
  });
}
