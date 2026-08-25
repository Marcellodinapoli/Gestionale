import {
  buildAffidiHref,
  parseCodaAffidi,
  type AffidiNavParams,
} from "@/components/affidi/AffidiCaricoOperatori";

export type AffidiBackNav = {
  href: string;
  label: string;
};

function paramsFromSearch(sp: URLSearchParams): AffidiNavParams {
  const perimetroRaw = sp.get("perimetro");
  let perimetro: string | undefined;
  if (perimetroRaw) {
    try {
      perimetro = decodeURIComponent(perimetroRaw);
    } catch {
      perimetro = perimetroRaw;
    }
  }
  return {
    mandato: sp.get("mandato") || undefined,
    perimetro,
    operatore: sp.get("operatore") || undefined,
    coda: parseCodaAffidi(sp.get("coda")),
    sezione: sp.get("sezione") === "affida" ? "affida" : undefined,
  };
}

function back(params: AffidiNavParams, label: string): AffidiBackNav {
  return { href: buildAffidiHref(params), label };
}

/** Panoramica: /affidi oppure solo filtro mandato (stessa vista, nessuna freccia). */
function isAffidiPanoramica(sp: URLSearchParams): boolean {
  if (!sp.has("mandato")) return !sp.toString();
  return (
    !sp.has("perimetro") &&
    !sp.has("sezione") &&
    !sp.has("operatore") &&
    !sp.has("coda")
  );
}

/** Livello padre nella navigazione Affidi (solo query string). */
export function resolveAffidiBackNav(search: string): AffidiBackNav | null {
  const sp = new URLSearchParams(search.replace(/^\?/, ""));
  if (!sp.toString() || isAffidiPanoramica(sp)) return null;

  if (sp.get("sezione") === "affida") {
    const next = paramsFromSearch(sp);
    delete next.sezione;
    return back(next, "Panoramica perimetro");
  }

  if (sp.has("coda")) {
    const next = paramsFromSearch(sp);
    delete next.coda;
    return back(next, "Dettaglio operatore");
  }

  if (sp.has("operatore")) {
    const next = paramsFromSearch(sp);
    delete next.operatore;
    delete next.coda;
    return back(next, "Carico operatori");
  }

  if (sp.has("perimetro")) {
    // Salta il passaggio ?mandato=… (identico alla panoramica quando c’è un solo mandato)
    return { href: "/affidi", label: "Tutti i perimetri" };
  }

  return null;
}

export function affidiBackHrefFromSearch(search: string): string | null {
  return resolveAffidiBackNav(search)?.href ?? null;
}
