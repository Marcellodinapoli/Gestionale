/** Logica PDR allineata a CreditCalc (cadenza + pratica singola / multi-piano). */

export type PdrBand = {
  from: number;
  to: number;
  installments: number;
};

export type PdrPlanMode = "lastAdjustment" | "allEqual";

export type PdrCadenza =
  | "mensile"
  | "bimestrale"
  | "trimestrale"
  | "modulato";

export type PdrPlanLine = {
  numero: number;
  scadenza: Date;
  importo: number;
};

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function addMonthsSameCalendarDay(base: Date, months: number) {
  const day = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1, 12, 0, 0);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export function cadenzaMonthStep(cadenza: PdrCadenza): number {
  switch (cadenza) {
    case "bimestrale":
      return 2;
    case "trimestrale":
      return 3;
    default:
      return 1;
  }
}

export function cadenzaLabel(cadenza: PdrCadenza): string {
  switch (cadenza) {
    case "bimestrale":
      return "Bimestrale";
    case "trimestrale":
      return "Trimestrale";
    case "modulato":
      return "Modulato";
    default:
      return "Mensile";
  }
}

export function bandForAmount(bands: PdrBand[], amount: number): PdrBand | null {
  const value = Math.round(amount);
  for (const band of bands) {
    if (value >= band.from && value <= band.to) return band;
  }
  return null;
}

export function mesiDisponibiliPdr(
  annoNascita: number | null,
  maxAgePdr: number | null
): number | null {
  if (annoNascita == null || maxAgePdr == null) return null;
  const age = new Date().getFullYear() - annoNascita;
  if (age < 0 || age > 120) return null;
  return Math.max(0, (maxAgePdr - age) * 12);
}

export function effectiveMaxInstallments(
  bandMax: number,
  mesiDisponibili: number | null,
  monthStep = 1
): number {
  const step = Math.max(1, monthStep);
  const fromAge =
    mesiDisponibili == null ? null : Math.floor(mesiDisponibili / step);
  if (fromAge == null) return Math.max(0, bandMax);
  return Math.max(0, Math.min(bandMax, fromAge));
}

function minRata(minInstallmentAmount: number | null) {
  const m =
    minInstallmentAmount != null && minInstallmentAmount > 0
      ? minInstallmentAmount
      : 0.01;
  return m;
}

function lineScadenza(start: Date, index: number, monthStep: number) {
  return addMonthsSameCalendarDay(start, index * Math.max(1, monthStep));
}

/** Automatico: usa il max rate possibile rispettando min rata. */
export function resolveAutoInstallmentCount(
  netto: number,
  maxInstallments: number,
  minInstallmentAmount: number | null
): number | null {
  if (netto <= 0 || maxInstallments < 1) return null;
  const min = minRata(minInstallmentAmount);
  for (let n = maxInstallments; n >= 1; n--) {
    const provisional = Math.floor((netto / n) * 100) / 100;
    if (provisional >= min - 0.001) return n;
  }
  return null;
}

export function buildLastAdjustmentPlan(
  netto: number,
  count: number,
  start: Date,
  minInstallmentAmount: number | null,
  monthStep = 1
): PdrPlanLine[] | null {
  if (count < 1 || netto <= 0) return null;
  const min = minRata(minInstallmentAmount);
  const totalCents = Math.round(netto * 100);
  const equalCents = Math.floor(totalCents / count);
  const equal = equalCents / 100;
  if (equal < min - 0.001 && count > 1) return null;
  const lines: PdrPlanLine[] = [];
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const importo = isLast
      ? round2((totalCents - allocated * 100) / 100)
      : equal;
    if (importo < min - 0.001) return null;
    lines.push({
      numero: i + 1,
      scadenza: lineScadenza(start, i, monthStep),
      importo,
    });
    allocated = round2(allocated + importo);
  }
  return lines;
}

export function buildAllEqualPlan(
  netto: number,
  count: number,
  start: Date,
  minInstallmentAmount: number | null,
  monthStep = 1
): { lines: PdrPlanLine[]; recovered: number; shortfall: number } | null {
  if (count < 1 || netto <= 0) return null;
  const min = minRata(minInstallmentAmount);
  const equal = Math.floor(netto / count);
  if (equal < min - 0.001) return null;
  const recovered = equal * count;
  const lines = Array.from({ length: count }, (_, i) => ({
    numero: i + 1,
    scadenza: lineScadenza(start, i, monthStep),
    importo: equal,
  }));
  return { lines, recovered, shortfall: round2(netto - recovered) };
}

export function buildManualByCount(
  netto: number,
  count: number,
  start: Date,
  mode: PdrPlanMode,
  minInstallmentAmount: number | null,
  monthStep = 1
): { lines: PdrPlanLine[]; recovered: number; shortfall: number } | null {
  if (mode === "allEqual") {
    return buildAllEqualPlan(
      netto,
      count,
      start,
      minInstallmentAmount,
      monthStep
    );
  }
  const lines = buildLastAdjustmentPlan(
    netto,
    count,
    start,
    minInstallmentAmount,
    monthStep
  );
  if (!lines) return null;
  return { lines, recovered: netto, shortfall: 0 };
}

export function buildManualByAmount(
  netto: number,
  desiredAmount: number,
  maxInstallments: number,
  start: Date,
  mode: PdrPlanMode,
  minInstallmentAmount: number | null,
  monthStep = 1
): { lines: PdrPlanLine[]; recovered: number; shortfall: number } | null {
  const min = minRata(minInstallmentAmount);
  if (desiredAmount < min - 0.001) return null;
  if (desiredAmount > netto + 0.001) return null;
  let n =
    mode === "allEqual"
      ? Math.floor(netto / desiredAmount)
      : Math.ceil(netto / desiredAmount);
  if (n < 1) n = 1;
  if (n > maxInstallments) return null;
  if (mode === "allEqual") {
    const equal = round2(desiredAmount);
    const recovered = round2(equal * n);
    if (recovered > netto + 0.001) return null;
    const lines = Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      scadenza: lineScadenza(start, i, monthStep),
      importo: equal,
    }));
    return { lines, recovered, shortfall: round2(netto - recovered) };
  }
  const totalCents = Math.round(netto * 100);
  const equalCents = Math.round(desiredAmount * 100);
  if (equalCents * (n - 1) >= totalCents && n > 1) {
    n = Math.max(1, Math.ceil(totalCents / equalCents));
    if (n > maxInstallments) return null;
  }
  const lines: PdrPlanLine[] = [];
  let allocatedCents = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const cents = isLast ? totalCents - allocatedCents : equalCents;
    const importo = cents / 100;
    if (importo < min - 0.001) return null;
    lines.push({
      numero: i + 1,
      scadenza: lineScadenza(start, i, monthStep),
      importo,
    });
    allocatedCents += cents;
  }
  return { lines, recovered: netto, shortfall: 0 };
}

/** Limite iterazioni calendario multi-pratica (come CreditCalc). */
const MAX_MULTI_SCHEDULE = 2400;

export type PdrPracticeDebt = {
  netAmount: number;
  accontoAmount: number;
};

export type PdrMultiCalendarLine = {
  date: Date;
  practiceLabel: string;
  amount: number;
  practiceInstallmentIndex: number;
};

export type PdrMultiPracticeSchedule = {
  planNumber: number;
  label: string;
  netAmount: number;
  accontoAmount: number;
  recovered: number;
  shortfall: number;
  lines: PdrPlanLine[];
};

export type PdrMultiPracticeResult = {
  monthlyClientPayment: number;
  practices: PdrMultiPracticeSchedule[];
  calendar: PdrMultiCalendarLine[];
  overallEndDate: Date;
  phaseDescriptions: string[];
  monthlyParallel: boolean;
};

/** Rate tutte uguali a importo mensile fisso (residuo non dilazionato ok). */
export function buildAllEqualWithFixedMonthlyRate(
  netAmount: number,
  monthlyPayment: number,
  minInstallmentAmount: number | null
): { amounts: number[]; recovered: number; shortfall: number } | null {
  const min = minRata(minInstallmentAmount);
  if (monthlyPayment + 1e-9 < min) return null;
  if (netAmount + 1e-9 < monthlyPayment) {
    if (netAmount + 1e-9 < min) return null;
    return {
      amounts: [round2(netAmount)],
      recovered: round2(netAmount),
      shortfall: 0,
    };
  }
  const n = Math.floor(netAmount / monthlyPayment);
  if (n < 1 || n > MAX_MULTI_SCHEDULE) return null;
  const recovered = round2(monthlyPayment * n);
  return {
    amounts: Array.from({ length: n }, () => monthlyPayment),
    recovered,
    shortfall: round2(netAmount - recovered),
  };
}

/** Ripartisce l'acconto in quote uguali (centesimi) sulle N pratiche. */
export function splitAccontoAcrossPractices(
  acconto: number,
  count: number
): number[] {
  if (count < 1) return [];
  if (acconto <= 0) return Array.from({ length: count }, () => 0);
  const accontoCents = Math.round(acconto * 100);
  const base = Math.floor(accontoCents / count);
  let rem = accontoCents % count;
  const shares: number[] = [];
  for (let i = 0; i < count; i++) {
    let c = base;
    if (rem > 0) {
      c++;
      rem--;
    }
    shares.push(c / 100);
  }
  return shares;
}

/** Debiti netti per pratica: gross - quota acconto. */
export function practiceNetsFromGross(
  grossAmounts: number[],
  acconto: number
): number[] {
  const count = grossAmounts.length;
  if (count < 1) return [];
  const shares = splitAccontoAcrossPractices(acconto, count);
  return grossAmounts.map((g, i) => {
    const netCents = Math.round(g * 100) - Math.round(shares[i]! * 100);
    return netCents <= 0 ? 0 : netCents / 100;
  });
}

function compareNetAsc(a: PdrPracticeDebt, b: PdrPracticeDebt) {
  return a.netAmount - b.netAmount;
}

function euroMsg(n: number) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

/**
 * Multi-pratica CreditCalc:
 * - monthlyParallel=false -> rotazione (bi/trimestrale): ogni mese paga una pratica
 * - monthlyParallel=true -> mensile 2/3: ogni mese ripartisce l'importo sui piani aperti
 */
export function tryBuildMultiPracticePlan(opts: {
  practiceDebts: PdrPracticeDebt[];
  monthlyPayment: number;
  startDate: Date;
  minInstallmentAmount: number | null;
  monthlyParallel: boolean;
}): { result: PdrMultiPracticeResult | null; errorMessage: string | null } {
  const {
    practiceDebts,
    monthlyPayment,
    startDate,
    minInstallmentAmount,
    monthlyParallel,
  } = opts;
  if (practiceDebts.length < 2 || monthlyPayment <= 0) {
    return {
      result: null,
      errorMessage: 'Servono almeno due importi e una rata mensile valida.',
    };
  }
  if (practiceDebts.some((d) => d.netAmount <= 0)) {
    return {
      result: null,
      errorMessage: 'Inserisci tutti gli importi delle pratiche.',
    };
  }

  const built = monthlyParallel
    ? buildMonthlyParallelMulti({
        practiceDebts,
        monthlyPayment,
        startDate,
        minInstallmentAmount,
      })
    : buildRotationMulti({
        practiceDebts,
        monthlyPayment,
        startDate,
        minInstallmentAmount,
      });

  if (built) return { result: built, errorMessage: null };

  const min = minRata(minInstallmentAmount);
  if (monthlyParallel) {
    const n = practiceDebts.length;
    const share = monthlyPayment / n;
    if (share + 1e-9 < min) {
      return {
        result: null,
        errorMessage: `Con ${n} piani la quota mensile (${euroMsg(share)}) è inferiore alla rata minima (${euroMsg(min)}). Aumenta l'importo mensile disponibile.`,
      };
    }
  } else if (monthlyPayment + 1e-9 < min) {
    return {
      result: null,
      errorMessage: `La rata mensile (${euroMsg(monthlyPayment)}) è inferiore alla rata minima (${euroMsg(min)}).`,
    };
  }

  return {
    result: null,
    errorMessage:
      'Impossibile strutturare i piani con rata ' + euroMsg(monthlyPayment) + '.',
  };
}

function buildRotationMulti(opts: {
  practiceDebts: PdrPracticeDebt[];
  monthlyPayment: number;
  startDate: Date;
  minInstallmentAmount: number | null;
}): PdrMultiPracticeResult | null {
  const { practiceDebts, monthlyPayment, startDate, minInstallmentAmount } =
    opts;
  const min = minRata(minInstallmentAmount);
  if (monthlyPayment + 1e-9 < min) return null;

  const sorted = [...practiceDebts].sort(compareNetAsc);
  const numbered = sorted.map((d, i) => ({
    label: 'Piano di rientro ' + (i + 1),
    netAmount: d.netAmount,
    accontoAmount: d.accontoAmount,
    planNumber: i + 1,
  }));

  const amountsByPractice: number[][] = [];
  const shortfalls: number[] = [];
  const recovereds: number[] = [];
  for (const debt of numbered) {
    const plan = buildAllEqualWithFixedMonthlyRate(
      debt.netAmount,
      monthlyPayment,
      minInstallmentAmount
    );
    if (!plan) return null;
    amountsByPractice.push(plan.amounts);
    shortfalls.push(plan.shortfall);
    recovereds.push(plan.recovered);
  }

  const indices = amountsByPractice.map(() => 0);
  const paymentDates: Date[][] = amountsByPractice.map(() => []);
  const paymentAmounts: number[][] = amountsByPractice.map(() => []);
  const calendar: PdrMultiCalendarLine[] = [];
  const phaseDescriptions: string[] = [];
  let lastPhase: string | null = null;
  let monthOffset = 0;
  let rotation = 0;

  while (true) {
    const active: number[] = [];
    for (let i = 0; i < numbered.length; i++) {
      if (indices[i]! < amountsByPractice[i]!.length) active.push(i);
    }
    if (active.length === 0) break;
    if (monthOffset > MAX_MULTI_SCHEDULE) return null;

    let phase: string;
    if (active.length === 1) {
      phase =
        'Pagamento mensile sulla pratica residua (' +
        numbered[active[0]!]!.label +
        ')';
    } else if (active.length === 2) {
      phase =
        `Rotazione bimestrale su 2 pratiche (${numbered[active[0]!]!.label} ↔ ${numbered[active[1]!]!.label})`;
    } else {
      phase = `Rotazione trimestrale su 3 pratiche (${numbered[active[0]!]!.label} → ${numbered[active[1]!]!.label} → ${numbered[active[2]!]!.label})`;
    }
    if (phase !== lastPhase) {
      phaseDescriptions.push(phase);
      lastPhase = phase;
    }

    const pick = active[rotation % active.length]!;
    const installmentIdx = indices[pick]!;
    const amount = amountsByPractice[pick]![installmentIdx]!;
    const date = addMonthsSameCalendarDay(startDate, monthOffset);
    calendar.push({
      date,
      practiceLabel: numbered[pick]!.label,
      amount,
      practiceInstallmentIndex: installmentIdx + 1,
    });
    paymentDates[pick]!.push(date);
    paymentAmounts[pick]!.push(amount);
    indices[pick] = installmentIdx + 1;
    monthOffset++;
    rotation++;
  }

  const practices: PdrMultiPracticeSchedule[] = numbered.map((d, i) => ({
    planNumber: d.planNumber,
    label: d.label,
    netAmount: d.netAmount,
    accontoAmount: d.accontoAmount,
    recovered: recovereds[i]!,
    shortfall: shortfalls[i]!,
    lines: paymentAmounts[i]!.map((importo, j) => ({
      numero: j + 1,
      scadenza: paymentDates[i]![j]!,
      importo,
    })),
  }));

  return {
    monthlyClientPayment: monthlyPayment,
    practices,
    calendar,
    overallEndDate:
      calendar.length === 0 ? startDate : calendar[calendar.length - 1]!.date,
    phaseDescriptions,
    monthlyParallel: false,
  };
}

function buildMonthlyParallelMulti(opts: {
  practiceDebts: PdrPracticeDebt[];
  monthlyPayment: number;
  startDate: Date;
  minInstallmentAmount: number | null;
}): PdrMultiPracticeResult | null {
  const { practiceDebts, monthlyPayment, startDate, minInstallmentAmount } =
    opts;
  const min = minRata(minInstallmentAmount);
  const sorted = [...practiceDebts].sort(compareNetAsc);
  const n = sorted.length;
  if (n < 2) return null;

  const minShareEuro = Math.floor(monthlyPayment / n);
  if (minShareEuro + 1e-9 < min) return null;

  const numbered = sorted.map((d, i) => ({
    label: 'Piano di rientro ' + (i + 1),
    netAmount: d.netAmount,
    accontoAmount: d.accontoAmount,
    planNumber: i + 1,
  }));

  const balancesCents = numbered.map((d) => Math.round(d.netAmount * 100));
  if (balancesCents.some((b) => b <= 0)) return null;

  const paymentAmounts: number[][] = Array.from({ length: n }, () => []);
  const paymentDates: Date[][] = Array.from({ length: n }, () => []);
  const installmentIndices = Array.from({ length: n }, () => 0);
  const calendar: PdrMultiCalendarLine[] = [];
  const phaseDescriptions: string[] = [];
  let lastPhase: string | null = null;
  let monthOffset = 0;

  while (true) {
    const active: number[] = [];
    for (let i = 0; i < n; i++) {
      if (balancesCents[i]! > 0) active.push(i);
    }
    if (active.length === 0) break;
    if (monthOffset > MAX_MULTI_SCHEDULE) return null;

    const shareEuro = Math.floor(monthlyPayment / active.length);
    const shareCents = shareEuro * 100;
    if (shareEuro + 1e-9 < min) return null;

    let phase: string;
    if (active.length === 1) {
      phase =
        'Importo mensile intero su ' +
        numbered[active[0]!]!.label +
        ' (chiusura)';
    } else if (active.length === 2) {
      phase =
        'Quota mensile ripartita su 2 piani (' +
        numbered[active[0]!]!.label +
        ' + ' +
        numbered[active[1]!]!.label +
        ')';
    } else {
      phase = 'Quota mensile ripartita su 3 piani attivi';
    }
    if (phase !== lastPhase) {
      phaseDescriptions.push(phase);
      lastPhase = phase;
    }

    const date = addMonthsSameCalendarDay(startDate, monthOffset);
    for (const i of active) {
      if (balancesCents[i]! < shareCents) {
        balancesCents[i] = 0;
        continue;
      }
      const pay = shareEuro;
      installmentIndices[i]!++;
      calendar.push({
        date,
        practiceLabel: numbered[i]!.label,
        amount: pay,
        practiceInstallmentIndex: installmentIndices[i]!,
      });
      paymentAmounts[i]!.push(pay);
      paymentDates[i]!.push(date);
      balancesCents[i]! -= shareCents;
    }
    monthOffset++;
  }

  const practices: PdrMultiPracticeSchedule[] = [];
  for (let i = 0; i < n; i++) {
    const amounts = paymentAmounts[i]!;
    if (amounts.length === 0) return null;
    const recovered = round2(amounts.reduce((s, a) => s + a, 0));
    const net = numbered[i]!.netAmount;
    if (recovered - net > 0.009) return null;
    practices.push({
      planNumber: numbered[i]!.planNumber,
      label: numbered[i]!.label,
      netAmount: net,
      accontoAmount: numbered[i]!.accontoAmount,
      recovered,
      shortfall: round2(net - recovered),
      lines: amounts.map((importo, j) => ({
        numero: j + 1,
        scadenza: paymentDates[i]![j]!,
        importo,
      })),
    });
  }

  return {
    monthlyClientPayment: monthlyPayment,
    practices,
    calendar,
    overallEndDate:
      calendar.length === 0 ? startDate : calendar[calendar.length - 1]!.date,
    phaseDescriptions,
    monthlyParallel: true,
  };
}

export type PdrModulatedPhaseInput = {
  monthsText: string;
  amountText: string;
};

export type PdrModulatedFixedPhase = {
  months: number;
  monthlyAmount: number;
};

export type PdrModulatedPlanResult = {
  phases: PdrModulatedFixedPhase[];
  modulatedMonths: number;
  modulatedRecovered: number;
  residualDebt: number;
  finalInstallmentCount: number;
  lines: PdrPlanLine[];
  recovered: number;
  shortfall: number;
  netAmountOriginal: number;
};

function parseMonthsDigits(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

function parseEuroLoose(raw: string): number | null {
  const s = raw.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function installmentCountForDesiredAmount(
  netAmount: number,
  desiredInstallment: number
): number | null {
  if (netAmount <= 0 || desiredInstallment <= 0) return null;
  return Math.max(1, Math.ceil(netAmount / desiredInstallment));
}

export function installmentCountForDesiredLastAdjustment(
  netAmount: number,
  desiredInstallment: number,
  minInstallmentAmount: number | null
): number | null {
  if (netAmount <= 0 || desiredInstallment <= 0) return null;
  const min = minRata(minInstallmentAmount);
  if (desiredInstallment + 1e-9 < min) return null;
  const totalCents = Math.round(netAmount * 100);
  const equalCents = Math.round(desiredInstallment * 100);
  const minCents = Math.round(min * 100);
  if (equalCents < minCents) return null;
  if (totalCents <= equalCents) {
    return totalCents >= minCents ? 1 : null;
  }
  const n = Math.floor((totalCents - minCents) / equalCents) + 1;
  if (n < 1) return null;
  const lastCents = totalCents - equalCents * (n - 1);
  if (lastCents < minCents || lastCents <= 0) return null;
  return n;
}

/**
 * Piano modulato CreditCalc: fino a 3 fasi (mesi+importo = rata fissa;
 * solo mesi o solo importo = dilazione del residuo).
 */
export function tryBuildModulatedPlan(opts: {
  netto: number;
  phaseInputs: PdrModulatedPhaseInput[];
  startDate: Date;
  mode: PdrPlanMode;
  maxInstallments: number;
  minInstallmentAmount: number | null;
  mesiDisponibili: number | null;
}): { result: PdrModulatedPlanResult | null; errorMessage: string | null } {
  const {
    netto,
    phaseInputs,
    startDate,
    mode,
    maxInstallments,
    minInstallmentAmount,
    mesiDisponibili,
  } = opts;

  if (netto <= 0) {
    return {
      result: null,
      errorMessage: "Inserisci un importo netto da rateizzare valido.",
    };
  }
  if (maxInstallments < 1) {
    return {
      result: null,
      errorMessage: "Non ci sono dilazioni disponibili (fascia PDR / età).",
    };
  }

  const min = minRata(minInstallmentAmount);
  const visible = phaseInputs.filter(
    (p) => p.monthsText.trim() || p.amountText.trim()
  );
  if (visible.length === 0) {
    return {
      result: null,
      errorMessage: "Compila almeno il numero di mesi o l'importo rata mensile.",
    };
  }

  const fixedPhases: PdrModulatedFixedPhase[] = [];
  let residualDilazioneMonths: number | null = null;
  let residualDilazioneAmount: number | null = null;
  let remainingDebt = netto;
  let monthsUsed = 0;

  for (let i = 0; i < phaseInputs.length; i++) {
    const mRaw = phaseInputs[i]!.monthsText.trim();
    const aRaw = phaseInputs[i]!.amountText.trim();
    const hasMonths = mRaw.length > 0;
    const hasAmount = aRaw.length > 0;
    if (!hasMonths && !hasAmount) {
      if (i === 0) {
        return {
          result: null,
          errorMessage:
            "Compila almeno il numero di mesi o l'importo rata mensile.",
        };
      }
      break;
    }

    if (hasMonths && !hasAmount) {
      const months = parseMonthsDigits(mRaw);
      if (months == null) {
        return {
          result: null,
          errorMessage: `Fase ${i + 1}: indica un numero di mesi valido.`,
        };
      }
      residualDilazioneMonths = months;
      break;
    }

    if (hasAmount && !hasMonths) {
      const amount = parseEuroLoose(aRaw);
      if (amount == null || amount <= 0) {
        return {
          result: null,
          errorMessage: `Fase ${i + 1}: indica un importo rata valido.`,
        };
      }
      residualDilazioneAmount = amount;
      break;
    }

    const months = parseMonthsDigits(mRaw);
    const amount = parseEuroLoose(aRaw);
    if (months == null || amount == null || amount <= 0) {
      return {
        result: null,
        errorMessage: `Fase ${i + 1}: mesi e importo devono essere entrambi validi.`,
      };
    }
    if (amount + 1e-9 < min) {
      return {
        result: null,
        errorMessage: `La rata della fase ${i + 1} (${euroMsg(amount)}) è inferiore al minimo (${euroMsg(min)}).`,
      };
    }
    fixedPhases.push({ months, monthlyAmount: amount });
    monthsUsed += months;
    remainingDebt = round2(remainingDebt - months * amount);
  }

  const residual = remainingDebt;
  const modulatedRecovered = round2(
    fixedPhases.reduce((s, p) => s + p.months * p.monthlyAmount, 0)
  );

  let remainingN: number;
  let chosenRata: number | null = null;

  if (residualDilazioneMonths != null) {
    if (residual <= 0.009) {
      return {
        result: null,
        errorMessage: "Non c'è residuo da dilazionare con i mesi indicati.",
      };
    }
    if (monthsUsed + residualDilazioneMonths > maxInstallments) {
      return {
        result: null,
        errorMessage: `Il piano dura ${monthsUsed + residualDilazioneMonths} mesi: la fascia PDR ne consente al massimo ${maxInstallments}.`,
      };
    }
    if (
      mesiDisponibili != null &&
      monthsUsed + residualDilazioneMonths > mesiDisponibili
    ) {
      return {
        result: null,
        errorMessage: `Il piano dura ${monthsUsed + residualDilazioneMonths} mesi, oltre i ${mesiDisponibili} mesi disponibili per età.`,
      };
    }
    remainingN = residualDilazioneMonths;
  } else if (residualDilazioneAmount != null) {
    if (residual <= 0.009) {
      return {
        result: null,
        errorMessage: "Non c'è residuo da dilazionare con l'importo indicato.",
      };
    }
    if (residualDilazioneAmount + 1e-9 < min) {
      return {
        result: null,
        errorMessage: `L'importo ${euroMsg(residualDilazioneAmount)} è inferiore alla rata minima (${euroMsg(min)}).`,
      };
    }
    if (residualDilazioneAmount - residual > 0.009) {
      return {
        result: null,
        errorMessage: `L'importo ${euroMsg(residualDilazioneAmount)} supera il residuo di ${euroMsg(residual)}.`,
      };
    }
    const n =
      mode === "lastAdjustment"
        ? installmentCountForDesiredLastAdjustment(
            residual,
            residualDilazioneAmount,
            minInstallmentAmount
          )
        : installmentCountForDesiredAmount(residual, residualDilazioneAmount);
    if (n == null || n < 1) {
      return {
        result: null,
        errorMessage: `Con rata ${euroMsg(residualDilazioneAmount)} non è possibile dilazionare il residuo di ${euroMsg(residual)}.`,
      };
    }
    if (monthsUsed + n > maxInstallments) {
      return {
        result: null,
        errorMessage: `Servono ${n} dilazioni sul residuo: il piano totale (${monthsUsed + n} mesi) supera il massimo di fascia (${maxInstallments}).`,
      };
    }
    if (mesiDisponibili != null && monthsUsed + n > mesiDisponibili) {
      return {
        result: null,
        errorMessage: `Il piano dura ${monthsUsed + n} mesi, oltre i ${mesiDisponibili} mesi disponibili per età.`,
      };
    }
    remainingN = n;
    if (mode === "lastAdjustment") chosenRata = residualDilazioneAmount;
  } else {
    if (monthsUsed >= maxInstallments) {
      return {
        result: null,
        errorMessage: `Le fasi personalizzate durano ${monthsUsed} mesi: deve restare almeno 1 mese per il residuo (max ${maxInstallments}).`,
      };
    }
    remainingN = maxInstallments - monthsUsed;
    if (residual <= 0.009) {
      return {
        result: null,
        errorMessage:
          modulatedRecovered >= netto
            ? "Le rate personalizzate coprono già tutto il debito netto: riduci importi o durata per lasciare un residuo da dilazionare."
            : "Il debito residuo da dilazionare deve essere positivo.",
      };
    }
    if (
      mesiDisponibili != null &&
      monthsUsed + remainingN > mesiDisponibili
    ) {
      return {
        result: null,
        errorMessage: `Il piano complessivo dura ${monthsUsed + remainingN} mesi, oltre i ${mesiDisponibili} mesi disponibili per età.`,
      };
    }
    if (
      residual / remainingN + 1e-9 < min &&
      mode !== "lastAdjustment"
    ) {
      return {
        result: null,
        errorMessage: `Sul residuo di ${euroMsg(residual)} in ${remainingN} dilazioni la rata media sarebbe sotto il minimo (${euroMsg(min)}). Accorcia le fasi o usa il conguaglio.`,
      };
    }
  }

  let residualBuilt: {
    lines: PdrPlanLine[];
    recovered: number;
    shortfall: number;
  } | null = null;

  if (chosenRata != null && mode === "lastAdjustment") {
    const totalCents = Math.round(residual * 100);
    const equalCents = Math.round(chosenRata * 100);
    const minCents = Math.round(min * 100);
    if (remainingN < 1 || equalCents < minCents) {
      residualBuilt = null;
    } else {
      const lines: PdrPlanLine[] = [];
      let allocatedCents = 0;
      let ok = true;
      for (let i = 0; i < remainingN; i++) {
        const isLast = i === remainingN - 1;
        const cents = isLast
          ? totalCents - allocatedCents
          : equalCents;
        const importo = cents / 100;
        if (importo + 1e-9 < min) {
          ok = false;
          break;
        }
        lines.push({
          numero: i + 1,
          scadenza: addMonthsSameCalendarDay(startDate, monthsUsed + i),
          importo,
        });
        allocatedCents += cents;
      }
      residualBuilt = ok
        ? { lines, recovered: residual, shortfall: 0 }
        : null;
    }
  } else {
    residualBuilt = buildManualByCount(
      residual,
      remainingN,
      startDate,
      mode,
      minInstallmentAmount,
      1
    );
    if (residualBuilt) {
      residualBuilt = {
        ...residualBuilt,
        lines: residualBuilt.lines.map((line, i) => ({
          ...line,
          scadenza: addMonthsSameCalendarDay(startDate, monthsUsed + i),
        })),
      };
    }
  }

  if (!residualBuilt || residualBuilt.lines.length === 0) {
    return {
      result: null,
      errorMessage: `Impossibile dilazionare il residuo di ${euroMsg(residual)} in ${remainingN} dilazioni (minimo rata ${euroMsg(min)}).`,
    };
  }

  const residualLines = residualBuilt.lines;

  const fixedLines: PdrPlanLine[] = [];
  let offset = 0;
  for (const phase of fixedPhases) {
    for (let m = 0; m < phase.months; m++) {
      fixedLines.push({
        numero: fixedLines.length + 1,
        scadenza: addMonthsSameCalendarDay(startDate, offset),
        importo: phase.monthlyAmount,
      });
      offset++;
    }
  }

  const allLines = [
    ...fixedLines,
    ...residualLines.map((line, i) => ({
      ...line,
      numero: fixedLines.length + i + 1,
    })),
  ];

  const recovered = round2(
    modulatedRecovered + residualBuilt.recovered
  );

  return {
    result: {
      phases: fixedPhases,
      modulatedMonths: monthsUsed,
      modulatedRecovered,
      residualDebt: residual,
      finalInstallmentCount: residualBuilt.lines.length,
      lines: allLines,
      recovered,
      shortfall: round2(netto - recovered),
      netAmountOriginal: netto,
    },
    errorMessage: null,
  };
}
