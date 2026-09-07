/** Helper di formato puri — sicuri da importare nei Client Component. */

export function importoIt(value: number) {
  return (value || 0).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function dataItShort(value?: Date | string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

export function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value || 0);
}

export function dateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function datetimeLocalValue(value?: Date | string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateOnly(value?: string | null) {
  const raw = String(value || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

export function dataIt(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function dataOraIt(value?: Date | string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Riparto automatico del totale pagato:
 * 1) una sola rata (`importoRata`, non × rate insolute) → capitale
 * 2) spese
 * 3) spese di recupero
 * 4) eccesso → capitale
 * 5) eventuale residuo → mora (interessi)
 * Senza importo rata: spese → spese recupero → capitale → mora.
 */
export function ripartiIncasso(
  importo: number,
  pratica: {
    capitale: number;
    interessi: number;
    spese: number;
    speseRecupero?: number | null;
    importoRata?: number | null;
  },
  giaPagato: {
    capitale: number;
    interessi: number;
    spese: number;
    speseRec?: number;
  }
) {
  const speseRes = Math.max(0, pratica.spese - giaPagato.spese);
  const speseRecRes = Math.max(
    0,
    (pratica.speseRecupero ?? 0) - (giaPagato.speseRec ?? 0)
  );
  const intRes = Math.max(0, pratica.interessi - giaPagato.interessi);
  const capRes = Math.max(0, pratica.capitale - giaPagato.capitale);
  const rataTarget = Math.max(0, Number(pratica.importoRata) || 0);

  let rest = Math.max(0, importo);
  let capitale = 0;
  let spese = 0;
  let speseRec = 0;
  let interessi = 0;

  if (rataTarget > 0) {
    const quotaRata = Math.min(rest, rataTarget, capRes);
    capitale += quotaRata;
    rest -= quotaRata;
  }

  spese = Math.min(rest, speseRes);
  rest -= spese;

  speseRec = Math.min(rest, speseRecRes);
  rest -= speseRec;

  const eccessoCap = Math.min(rest, Math.max(0, capRes - capitale));
  capitale += eccessoCap;
  rest -= eccessoCap;

  interessi = Math.min(rest, intRes);

  return {
    capitale,
    interessi,
    spese,
    speseRec,
    usato: capitale + interessi + spese + speseRec,
  };
}

export function roundMoney(value: number) {
  return Math.round((value || 0) * 100) / 100;
}
