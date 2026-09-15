/** Vocali italiane (Y trattata come vocale). */
const VOCALI = new Set(["A", "E", "I", "O", "U", "Y"]);

function onlyLetters(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function isVocale(ch: string): boolean {
  return VOCALI.has(ch);
}

function isConsonante(ch: string): boolean {
  return /^[A-Z]$/.test(ch) && !isVocale(ch);
}

/** Pattern ammesso: 1 consonante + 2 vocali (CVV) oppure 1 vocale + 2 consonanti (VCC). */
export function isAcronimoPatternValido(acr: string): boolean {
  const a = onlyLetters(acr);
  if (a.length !== 3) return false;
  const [x, y, z] = a;
  const cvv = isConsonante(x) && isVocale(y) && isVocale(z);
  const vcc = isVocale(x) && isConsonante(y) && isConsonante(z);
  return cvv || vcc;
}

function uniquePreserve(chars: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chars) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

function lettersFrom(name: string, cognome: string) {
  const full = onlyLetters(name) + onlyLetters(cognome);
  const cons = uniquePreserve([...full].filter(isConsonante));
  const voc = uniquePreserve([...full].filter(isVocale));
  return { full, cons, voc, nome: onlyLetters(name), cognome: onlyLetters(cognome) };
}

/** Genera candidati CVV e VCC privilegiando lettere di nome/cognome. */
export function candidatiAcronimo(nome: string, cognome: string): string[] {
  const { cons, voc, nome: n, cognome: c } = lettersFrom(nome, cognome);
  const out: string[] = [];
  const push = (s: string) => {
    if (s.length === 3 && isAcronimoPatternValido(s) && !out.includes(s)) out.push(s);
  };

  // Preferiti: iniziali / mix nome+cognome
  if (n && c) {
    // C + V + V (es. PIA da Pinco / Pallino)
    const c0 = [...n, ...c].find(isConsonante);
    const v1 = [...c, ...n].find(isVocale);
    const v2 = [...c, ...n].filter(isVocale).find((v) => v !== v1);
    if (c0 && v1 && v2) push(c0 + v1 + v2);

    // V + C + C
    const v0 = [...n, ...c].find(isVocale);
    const c1 = [...c, ...n].find(isConsonante);
    const c2 = [...c, ...n].filter(isConsonante).find((x) => x !== c1);
    if (v0 && c1 && c2) push(v0 + c1 + c2);

    // Prima consonante nome + due vocali cognome
    const cn = [...n].find(isConsonante);
    const vc = [...c].filter(isVocale);
    if (cn && vc.length >= 2) push(cn + vc[0] + vc[1]);
    if (cn && vc.length === 1 && voc.length) {
      const other = voc.find((v) => v !== vc[0]);
      if (other) push(cn + vc[0] + other);
    }

    // Prima vocale nome + due consonanti cognome
    const vn = [...n].find(isVocale);
    const cc = [...c].filter(isConsonante);
    if (vn && cc.length >= 2) push(vn + cc[0] + cc[1]);
  }

  // Combinazioni sistematiche dalle lettere disponibili
  const consPool = cons.length ? cons : "BCDFGHJKLMNPQRSTVWXZ".split("");
  const vocPool = voc.length ? voc : "AEIOU".split("");

  for (const a of consPool) {
    for (const b of vocPool) {
      for (const d of vocPool) {
        push(a + b + d);
        if (out.length > 80) return out;
      }
    }
  }
  for (const a of vocPool) {
    for (const b of consPool) {
      for (const d of consPool) {
        push(a + b + d);
        if (out.length > 160) return out;
      }
    }
  }

  return out;
}

/**
 * Consiglia un acronimo libero (3 lettere CVV o VCC) da nome/cognome.
 * `esclusi` = acronimi già usati (maiuscoli). `ignore` = acronimo attuale (modifica).
 */
export function suggerisciAcronimo(
  nome: string,
  cognome: string,
  esclusi: Iterable<string> = [],
  ignore?: string | null
): string | null {
  if (!onlyLetters(nome) || !onlyLetters(cognome)) return null;
  const taken = new Set(
    [...esclusi].map((a) => onlyLetters(a)).filter(Boolean)
  );
  const ign = ignore ? onlyLetters(ignore) : "";
  if (ign) taken.delete(ign);

  for (const cand of candidatiAcronimo(nome, cognome)) {
    if (!taken.has(cand)) return cand;
  }
  return null;
}

export function normalizeAcronimo(value: string | null | undefined): string | null {
  const a = onlyLetters(value || "");
  return a || null;
}
