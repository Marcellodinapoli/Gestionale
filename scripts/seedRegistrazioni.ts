import type { PrismaClient } from "@prisma/client";
import { writeDemoWav } from "../src/lib/registrazioneAudio";

type DemoCall = {
  praticaNumero: string;
  operatoreEmail: string;
  numero: string;
  direzione: "uscita" | "entrata";
  esito: string;
  durataSec: number;
  freq: number;
  giorniFa: number;
  ore: number;
  minuti: number;
};

const DEMO: DemoCall[] = [
  {
    praticaNumero: "PRC-2026-0001",
    operatoreEmail: "operatore@gestionale.local",
    numero: "3331234567",
    direzione: "uscita",
    esito: "NON_RISPONDE",
    durataSec: 18,
    freq: 380,
    giorniFa: 7,
    ore: 13,
    minuti: 30,
  },
  {
    praticaNumero: "PRC-2026-0001",
    operatoreEmail: "operatore@gestionale.local",
    numero: "3331234567",
    direzione: "uscita",
    esito: "CONTATTO",
    durataSec: 94,
    freq: 220,
    giorniFa: 0,
    ore: 10,
    minuti: 18,
  },
  {
    praticaNumero: "PRC-2026-0004",
    operatoreEmail: "operatore@gestionale.local",
    numero: "3331234567",
    direzione: "entrata",
    esito: "CONTATTO",
    durataSec: 41,
    freq: 260,
    giorniFa: 1,
    ore: 16,
    minuti: 5,
  },
  {
    praticaNumero: "PRC-2026-0002",
    operatoreEmail: "operatore2@gestionale.local",
    numero: "3479876543",
    direzione: "uscita",
    esito: "PROMESSA",
    durataSec: 72,
    freq: 310,
    giorniFa: 3,
    ore: 11,
    minuti: 42,
  },
  {
    praticaNumero: "PRC-2026-0002",
    operatoreEmail: "operatore2@gestionale.local",
    numero: "3479876543",
    direzione: "uscita",
    esito: "NON_RISPONDE",
    durataSec: 12,
    freq: 425,
    giorniFa: 8,
    ore: 9,
    minuti: 12,
  },
];

export async function seedRegistrazioniDemo(prisma: PrismaClient) {
  await prisma.registrazioneChiamata.deleteMany();

  for (const [i, row] of DEMO.entries()) {
    const [pratica, operatore] = await Promise.all([
      prisma.pratica.findFirst({ where: { numero: row.praticaNumero } }),
      prisma.user.findFirst({ where: { email: row.operatoreEmail } }),
    ]);
    if (!pratica || !operatore) continue;

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - row.giorniFa);
    createdAt.setHours(row.ore, row.minuti, 0, 0);

    const rec = await prisma.registrazioneChiamata.create({
      data: {
        praticaId: pratica.id,
        operatoreId: operatore.id,
        numero: row.numero,
        direzione: row.direzione,
        esito: row.esito,
        durataSec: row.durataSec,
        fileName: `demo-${i + 1}.wav`,
        createdAt,
      },
    });
    writeDemoWav(rec.fileName, row.durataSec, row.freq);
  }
}
