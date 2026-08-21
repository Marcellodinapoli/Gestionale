import fs from "fs";
import path from "path";

export const REGISTRAZIONI_DIR = path.join(process.cwd(), "uploads", "registrazioni");

export function pathRegistrazione(fileName: string) {
  return path.join(REGISTRAZIONI_DIR, fileName);
}

export function formatDurata(sec: number) {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function direzioneChiamataLabel(value?: string | null) {
  if (value === "entrata") return "Entrata";
  return "Uscita";
}

/** WAV PCM 8 kHz 16-bit, tono telefonico demo. */
export function makeDemoWav(durationSec: number, freq = 440): Buffer {
  const sampleRate = 8000;
  const n = Math.max(1, Math.round(sampleRate * durationSec));
  const dataSize = n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const ring = t < 1.2 ? Math.sin(2 * Math.PI * 425 * t) * ((t * 4) % 2 < 1 ? 0.35 : 0) : 0;
    const speech =
      t >= 1.4
        ? (Math.sin(2 * Math.PI * freq * t) * 0.25 +
            Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.12) *
          (0.4 + 0.6 * Math.sin(2 * Math.PI * 3.2 * t))
        : 0;
    const sample = Math.max(-1, Math.min(1, ring + speech));
    buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buf;
}

export function writeDemoWav(fileName: string, durationSec: number, freq: number) {
  fs.mkdirSync(REGISTRAZIONI_DIR, { recursive: true });
  const filePath = pathRegistrazione(fileName);
  fs.writeFileSync(filePath, makeDemoWav(durationSec, freq));
  return filePath;
}
