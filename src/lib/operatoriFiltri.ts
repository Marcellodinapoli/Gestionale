import {
  dataNascitaDaCodiceFiscale,
  etaDaDataNascita,
  normalizeCf,
} from "@/lib/codiceFiscale";
import type { CondizioneEconomica } from "@/lib/condizioneEconomica";

export type OperatoreListaItem = {
  id: string;
  name: string;
  cognome: string | null;
  email: string;
  role: string;
  roleLabel: string;
  acronimo: string | null;
  formazioneOnly: boolean;
  consulenteEsterno: boolean;
  creditCalcEnabled: boolean;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  postazione: string | null;
  interno: string | null;
  supervisorName: string | null;
  sedeId: string | null;
  sedeNome: string | null;
  condizioneEconomica: string;
  condizioneEconomicaValue: CondizioneEconomica;
  importoFisso: number | null;
  supervisorId: string | null;
  codiceFiscale: string | null;
  residenza: string | null;
  qualificheScolastiche: string | null;
};

export type OperatoriFiltri = {
  nome: string;
  cognome: string;
  email: string;
  acronimo: string;
  ruolo: string;
  accesso: "" | "completo" | "formazione";
  sedeId: string;
  supervisorId: string;
  condizioneEconomica: string;
  consulenteEsterno: "" | "1" | "0";
  creditCalc: "" | "1" | "0";
  codiceFiscale: string;
  residenza: string;
  giornoNascita: string;
  meseNascita: string;
  annoNascita: string;
  etaDa: string;
  etaA: string;
  qualifiche: string;
  postazione: string;
  interno: string;
};

export const OPERATORI_FILTRI_EMPTY: OperatoriFiltri = {
  nome: "",
  cognome: "",
  email: "",
  acronimo: "",
  ruolo: "",
  accesso: "",
  sedeId: "",
  supervisorId: "",
  condizioneEconomica: "",
  consulenteEsterno: "",
  creditCalc: "",
  codiceFiscale: "",
  residenza: "",
  giornoNascita: "",
  meseNascita: "",
  annoNascita: "",
  etaDa: "",
  etaA: "",
  qualifiche: "",
  postazione: "",
  interno: "",
};

function contains(hay: string | null | undefined, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return true;
  return (hay || "").toLowerCase().includes(n);
}

export function hasOperatoriFiltri(f: OperatoriFiltri): boolean {
  return Object.values(f).some((v) => String(v || "").trim() !== "");
}

export function filtraOperatori(
  utenti: OperatoreListaItem[],
  f: OperatoriFiltri
): OperatoreListaItem[] {
  if (!hasOperatoriFiltri(f)) return utenti;

  const etaDa = f.etaDa.trim() ? Number(f.etaDa) : null;
  const etaA = f.etaA.trim() ? Number(f.etaA) : null;
  const giorno = f.giornoNascita.trim() ? Number(f.giornoNascita) : null;
  const mese = f.meseNascita.trim() ? Number(f.meseNascita) : null;
  const anno = f.annoNascita.trim() ? Number(f.annoNascita) : null;

  return utenti.filter((u) => {
    if (!contains(u.name, f.nome)) return false;
    if (!contains(u.cognome, f.cognome)) return false;
    if (!contains(u.email, f.email)) return false;
    if (!contains(u.acronimo, f.acronimo)) return false;
    if (f.ruolo && u.role !== f.ruolo) return false;
    if (f.accesso === "formazione" && !u.formazioneOnly) return false;
    if (f.accesso === "completo" && u.formazioneOnly) return false;
    if (f.sedeId && u.sedeId !== f.sedeId) return false;
    if (f.supervisorId && u.supervisorId !== f.supervisorId) return false;
    if (f.condizioneEconomica && u.condizioneEconomicaValue !== f.condizioneEconomica) {
      return false;
    }
    if (f.consulenteEsterno === "1" && !u.consulenteEsterno) return false;
    if (f.consulenteEsterno === "0" && u.consulenteEsterno) return false;
    if (f.creditCalc === "1" && !u.creditCalcEnabled) return false;
    if (f.creditCalc === "0" && u.creditCalcEnabled) return false;
    if (f.codiceFiscale) {
      const q = normalizeCf(f.codiceFiscale);
      if (!normalizeCf(u.codiceFiscale).includes(q)) return false;
    }
    if (!contains(u.residenza, f.residenza)) return false;
    if (!contains(u.qualificheScolastiche, f.qualifiche)) return false;
    if (!contains(u.postazione, f.postazione)) return false;
    if (!contains(u.interno, f.interno)) return false;

    const nascita = dataNascitaDaCodiceFiscale(u.codiceFiscale);
    if (giorno != null && !Number.isNaN(giorno)) {
      if (!nascita || nascita.giorno !== giorno) return false;
    }
    if (mese != null && !Number.isNaN(mese)) {
      if (!nascita || nascita.mese !== mese) return false;
    }
    if (anno != null && !Number.isNaN(anno)) {
      if (!nascita || nascita.anno !== anno) return false;
    }
    if (
      (etaDa != null && !Number.isNaN(etaDa)) ||
      (etaA != null && !Number.isNaN(etaA))
    ) {
      const eta = etaDaDataNascita(nascita);
      if (eta == null) return false;
      if (etaDa != null && !Number.isNaN(etaDa) && eta < etaDa) return false;
      if (etaA != null && !Number.isNaN(etaA) && eta > etaA) return false;
    }

    return true;
  });
}

export function contaFiltriAttivi(f: OperatoriFiltri): number {
  return Object.values(f).filter((v) => String(v || "").trim() !== "").length;
}
