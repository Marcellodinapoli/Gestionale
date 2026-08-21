export const STATI_TELEFONO = {
  CONFERMATO: "Confermato",
  ALTRA_PERSONA: "Risponde altra persona",
  NON_LAVORA_PIU: "Non lavora più",
  RECAPITO_ERRATO: "Recapito errato",
  NON_RISPONDE: "Non risponde",
  DA_VERIFICARE: "Da verificare",
} as const;

export type StatoTelefono = keyof typeof STATI_TELEFONO;

export function parseStatoTelefono(raw?: string | null): StatoTelefono | null {
  if (!raw) return null;
  return raw in STATI_TELEFONO ? (raw as StatoTelefono) : null;
}

export function statoTelefonoLabel(stato?: string | null) {
  if (!stato) return null;
  return STATI_TELEFONO[stato as StatoTelefono] || stato;
}

export function statoTelefonoClassi(stato?: string | null) {
  switch (stato) {
    case "CONFERMATO":
      return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-300";
    case "ALTRA_PERSONA":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-300";
    case "NON_LAVORA_PIU":
      return "bg-orange-100 text-orange-950 ring-1 ring-orange-300";
    case "RECAPITO_ERRATO":
      return "bg-rose-100 text-rose-950 ring-1 ring-rose-300";
    case "NON_RISPONDE":
      return "bg-violet-100 text-violet-950 ring-1 ring-violet-300";
    case "DA_VERIFICARE":
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-300";
    default:
      return "bg-white text-[var(--navy)] ring-1 ring-[var(--line)]";
  }
}

export const STATI_TELEFONO_OPTIONS = Object.entries(STATI_TELEFONO) as [
  StatoTelefono,
  string,
][];
