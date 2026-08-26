/**
 * Genera public/debitori-esempio-100.csv compatibile LibreOffice/Excel.
 * Separatore ; — decimali con punto — UTF-8 BOM
 */
import fs from "node:fs";
import path from "node:path";

const NOMI = [
  "Marco", "Luca", "Andrea", "Giulia", "Francesca", "Alessandro", "Matteo", "Sara",
  "Chiara", "Davide", "Elena", "Paolo", "Laura", "Simone", "Valentina", "Roberto",
  "Martina", "Federico", "Silvia", "Antonio", "Giovanni", "Anna", "Stefano", "Monica",
  "Riccardo", "Elisa", "Fabio", "Claudia", "Daniele", "Ilaria", "Nicola", "Serena",
  "Pietro", "Barbara", "Alberto", "Cristina", "Massimo", "Paola", "Enrico", "Michela",
  "Giuseppe", "Rosa", "Vincenzo", "Teresa", "Salvatore", "Angela", "Luigi", "Beatrice",
  "Carlo", "Nadia", "Tommaso", "Greta", "Emanuele", "Sofia", "Lorenzo", "Alice",
  "Gabriele", "Irene", "Filippo", "Marta",
];
const COGNOMI = [
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
  "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa",
  "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani",
  "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile",
  "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "DAmico", "Fabbri",
  "Marchetti", "Parisi", "Villa", "Conte", "Ferraro", "Ferri", "Fiorentini", "Pellegrini",
  "Bellini", "Basile", "Ruggiero", "Testa", "Bernardi", "Sala", "Piras", "Sanna",
  "Palumbo", "Monti", "Guerra", "Palmieri",
];
const CITTA: [string, string, string][] = [
  ["Roma", "00184", "RM"], ["Milano", "20121", "MI"], ["Torino", "10121", "TO"],
  ["Napoli", "80121", "NA"], ["Bologna", "40121", "BO"], ["Firenze", "50122", "FI"],
  ["Genova", "16121", "GE"], ["Palermo", "90133", "PA"], ["Bari", "70121", "BA"],
  ["Catania", "95121", "CT"], ["Verona", "37121", "VR"], ["Padova", "35121", "PD"],
  ["Trieste", "34121", "TS"], ["Brescia", "25121", "BS"], ["Parma", "43121", "PR"],
  ["Modena", "41121", "MO"], ["Perugia", "06121", "PG"], ["Ancona", "60121", "AN"],
  ["Pescara", "65121", "PE"], ["Cagliari", "09124", "CA"], ["Reggio Emilia", "42121", "RE"],
  ["Livorno", "57123", "LI"], ["Ravenna", "48121", "RA"], ["Rimini", "47921", "RN"],
  ["Salerno", "84121", "SA"],
];
const VIE = [
  "Via Roma", "Via Garibaldi", "Corso Italia", "Via Mazzini", "Via Dante", "Via Verdi",
  "Piazza della Repubblica", "Via Nazionale", "Via Veneto", "Corso Vittorio Emanuele",
  "Via Manzoni", "Via Cavour", "Via XX Settembre", "Vicolo del Sole", "Via dei Mille",
  "Lungotevere", "Via Toscana", "Via Emilia", "Via Milano", "Via Napoli",
];
const MANDANTI = [
  { codice: "BNL01", ragione: "Banca Esempio S.p.A.", lotto: "112608" },
  { codice: "BNL01", ragione: "Banca Esempio S.p.A.", lotto: "1426055" },
  { codice: "ALF01", ragione: "Committente Alfa S.p.A.", lotto: "1426001" },
];

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}
function cfFake(cognome: string, nome: string, i: number) {
  const c = (cognome.replace(/[^A-Za-z]/g, "").toUpperCase() + "XXX").slice(0, 3);
  const n = (nome.replace(/[^A-Za-z]/g, "").toUpperCase() + "XXX").slice(0, 3);
  const yy = pad(70 + (i % 30));
  const mm = "ABCDEHLMPRST"[i % 12];
  const dd = pad(1 + (i % 28));
  return c + n + yy + mm + dd + "H501" + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i % 26];
}
function euro(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}
function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}
function rnd(min: number, max: number, seed: number) {
  const x = Math.sin(seed * 9973) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
}

type Client = {
  nome: string;
  cognome: string;
  cf: string;
  telefono: string;
  indirizzo: string;
  citta: string;
  cap: string;
  provincia: string;
};

const clients: Client[] = [];
for (let i = 0; i < 70; i++) {
  const nome = pick(NOMI, i * 3 + 1);
  const cognome = pick(COGNOMI, i * 5 + 2);
  const [citta, cap, provincia] = pick(CITTA, i * 2);
  clients.push({
    nome,
    cognome,
    cf: cfFake(cognome, nome, i + 11),
    telefono: "3" + String(30 + (i % 70)) + String(1000000 + i * 137).slice(0, 7),
    indirizzo: pick(VIE, i) + " " + (10 + (i % 80)),
    citta,
    cap,
    provincia,
  });
}

type Row = Record<string, string>;
const rows: Row[] = [];
let rowSeed = 1;

function addPratica(client: Client, multiIndex: number) {
  const m = pick(MANDANTI, rowSeed + multiIndex);
  const capitale = Math.round(rnd(400, 8500, rowSeed) * 100) / 100;
  const mora = Math.round(rnd(20, 450, rowSeed + 1) * 100) / 100;
  const spese = Math.round(rnd(10, 120, rowSeed + 2) * 100) / 100;
  const speseRec = Math.round(rnd(0, 80, rowSeed + 3) * 100) / 100;
  const affidato = capitale + mora + spese;
  const pagato = Math.round(rnd(0, affidato * 0.45, rowSeed + 4) * 100) / 100;
  const debResiduo = Math.round((affidato - pagato) * 100) / 100;
  const differenza = Math.max(0, Math.round((affidato - pagato) * 100) / 100);
  const daPagare = debResiduo;
  const impRata = Math.round((debResiduo / (2 + (rowSeed % 5))) * 100) / 100;
  const hasGarante = rowSeed % 3 === 0;
  let g = {
    nome: "",
    cognome: "",
    cf: "",
    telefono: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
  };
  if (hasGarante) {
    const gi = rowSeed + 17;
    g.nome = pick(NOMI, gi * 2);
    g.cognome = pick(COGNOMI, gi * 3 + 1);
    g.cf = cfFake(g.cognome, g.nome, gi + 200);
    g.telefono = "3" + String(40 + (gi % 50)) + String(2000000 + gi * 91).slice(0, 7);
    const [gc, gcap, gpr] = pick(CITTA, gi);
    g.citta = gc;
    g.cap = gcap;
    g.provincia = gpr;
    g.indirizzo = pick(VIE, gi + 4) + " " + (5 + (gi % 60));
  }
  rows.push({
    nome: client.nome,
    cognome: client.cognome,
    cf: client.cf,
    telefono: client.telefono,
    indirizzo: client.indirizzo,
    citta: client.citta,
    cap: client.cap,
    provincia: client.provincia,
    mandante_codice: m.codice,
    mandante_ragione_sociale: m.ragione,
    numero_mandante: m.lotto,
    capitale: euro(capitale),
    interessi: euro(mora),
    spese: euro(spese),
    spese_rec: euro(speseRec),
    deb_residuo: euro(debResiduo),
    imp_rata: euro(impRata),
    pagato: euro(pagato),
    differenza: euro(differenza),
    da_pagare: euro(daPagare),
    garante_nome: g.nome,
    garante_cognome: g.cognome,
    garante_cf: g.cf,
    garante_telefono: g.telefono,
    garante_indirizzo: g.indirizzo,
    garante_citta: g.citta,
    garante_cap: g.cap,
    garante_provincia: g.provincia,
  });
  rowSeed += 1;
}

let ci = 0;
for (; ci < 12; ci++) for (let k = 0; k < 3; k++) addPratica(clients[ci], k);
for (; ci < 20; ci++) for (let k = 0; k < 2; k++) addPratica(clients[ci], k);
for (; ci < 70; ci++) addPratica(clients[ci], 0);
while (rows.length > 100) rows.pop();

const header = [
  "nome", "cognome", "cf", "telefono", "indirizzo", "citta", "cap", "provincia",
  "mandante_codice", "mandante_ragione_sociale", "numero_mandante",
  "capitale", "interessi", "spese", "spese_rec", "deb_residuo", "imp_rata",
  "pagato", "differenza", "da_pagare",
  "garante_nome", "garante_cognome", "garante_cf", "garante_telefono",
  "garante_indirizzo", "garante_citta", "garante_cap", "garante_provincia",
];

const lines = [
  header.join(";"),
  ...rows.map((r) => header.map((h) => r[h] ?? "").join(";")),
];

const out = path.join(process.cwd(), "public", "debitori-esempio-100.csv");
fs.writeFileSync(out, "\uFEFF" + lines.join("\n") + "\n", "utf8");
console.log("OK", out, "righe", rows.length);
console.log(lines[1]);
