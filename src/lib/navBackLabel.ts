import {
  etichettaCodaAffidi,
  parseCodaAffidi,
} from "@/components/affidi/AffidiCaricoOperatori";

function isAffidiPanoramica(sp: URLSearchParams): boolean {
  if (!sp.has("mandato")) return !sp.toString();
  return (
    !sp.has("perimetro") &&
    !sp.has("sezione") &&
    !sp.has("operatore") &&
    !sp.has("coda")
  );
}

const MAIN_SECTION_LABELS: Record<string, string> = {
  "/": "Home",
  "/pratiche": "Lista pratiche",
  "/affidi": "Panoramica affidi",
  "/agenda": "Agenda",
  "/messaggi": "Messaggi",
  "/statistiche": "Statistiche",
  "/provigioni": "Provvigioni",
  "/report": "Registrazioni",
  "/rubrica": "Rubrica",
  "/lavorazione": "Lavorazione",
  "/account": "Account",
  "/formazione/progressi": "Formazione",
  "/strumenti/ricerca-normativa": "Strumenti AI",
};

/** Etichetta leggibile per il pulsante ← in base alla pagina di provenienza. */
export function labelForNavBackHref(href: string): string {
  if (!href) return "Indietro";

  const qIdx = href.indexOf("?");
  const path = (qIdx >= 0 ? href.slice(0, qIdx) : href) || "/";
  const query = qIdx >= 0 ? href.slice(qIdx + 1) : "";

  if (path.startsWith("/pratiche/")) {
    const rest = path.slice("/pratiche/".length);
    if (!rest.includes("/")) return "Scheda pratica";
    if (rest.endsWith("/fatture")) return "Fatture insolute";
    if (rest.endsWith("/estratto")) return "Estratto conto";
    if (rest.endsWith("/incassi")) return "Incassi registrati";
    if (rest.endsWith("/stampa")) return "Stampa pratica";
    return "Scheda pratica";
  }

  if (path === "/affidi") {
    const sp = new URLSearchParams(query);
    if (!sp.toString() || isAffidiPanoramica(sp)) return "Panoramica affidi";
    if (sp.get("sezione") === "affida") return "Affida pratiche";
    const coda = parseCodaAffidi(sp.get("coda"));
    if (coda) {
      const codaLabel = etichettaCodaAffidi(coda);
      return codaLabel === "tutte" ? "Coda lavorazione" : `Pratiche ${codaLabel}`;
    }
    if (sp.has("operatore")) return "Dettaglio operatore";
    if (sp.has("perimetro")) {
      try {
        const p = decodeURIComponent(sp.get("perimetro") || "");
        return p ? `Perimetro ${p}` : "Perimetro";
      } catch {
        return sp.get("perimetro") || "Perimetro";
      }
    }
    if (sp.has("mandato")) return "Affidi · mandato";
    return "Panoramica affidi";
  }

  if (MAIN_SECTION_LABELS[path]) return MAIN_SECTION_LABELS[path]!;

  if (path.startsWith("/formazione/")) return "Formazione";
  if (path.startsWith("/strumenti/")) return "Strumenti AI";

  return "Indietro";
}

/** Evita etichetta uguale alla voce di menu attiva (es. ← Affidi + Affidi). */
export function navBackDisplayLabel(
  menuLabel: string,
  backHref: string,
  explicitLabel?: string
): string {
  const label = explicitLabel || labelForNavBackHref(backHref);
  if (label === menuLabel) return "Indietro";
  return label;
}
