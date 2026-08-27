import type { Prisma } from "@prisma/client";

export const CAMPI_RICERCA_PRATICA = [
  { id: "telefono", label: "Telefono" },
  { id: "nominativo", label: "Nominativo" },
  { id: "contratto", label: "Contratto" },
  { id: "note", label: "Note" },
] as const;

export type CampoRicercaPratica = (typeof CAMPI_RICERCA_PRATICA)[number]["id"];

export function parseCampoRicercaPratica(
  value?: string | null
): CampoRicercaPratica | undefined {
  if (
    value === "telefono" ||
    value === "nominativo" ||
    value === "contratto" ||
    value === "note"
  ) {
    return value;
  }
  return undefined;
}

function soloCifre(value: string) {
  return value.replace(/\D/g, "");
}

export function buildPraticaCercaWhere(
  campo: CampoRicercaPratica,
  q: string
): Prisma.PraticaWhereInput | null {
  const term = q.trim();
  if (term.length < 2) return null;

  if (campo === "telefono") {
    const digits = soloCifre(term);
    const or: Prisma.PraticaWhereInput[] = [
      { debitore: { telefono: { contains: term } } },
      { debitore: { recapiti: { some: { tipo: "TELEFONO", valore: { contains: term } } } } },
      { garanti: { some: { telefono: { contains: term } } } },
      { garanti: { some: { recapiti: { some: { tipo: "TELEFONO", valore: { contains: term } } } } } },
    ];
    if (digits.length >= 3 && digits !== term) {
      or.push(
        { debitore: { telefono: { contains: digits } } },
        {
          debitore: {
            recapiti: { some: { tipo: "TELEFONO", valore: { contains: digits } } },
          },
        },
        { garanti: { some: { telefono: { contains: digits } } } },
        {
          garanti: {
            some: { recapiti: { some: { tipo: "TELEFONO", valore: { contains: digits } } } },
          },
        }
      );
    }
    return { OR: or };
  }

  if (campo === "nominativo") {
    const parts = term.split(/\s+/).filter(Boolean);
    const or: Prisma.PraticaWhereInput[] = [
      { debitore: { nome: { contains: term } } },
      { debitore: { cognome: { contains: term } } },
      { garanti: { some: { nome: { contains: term } } } },
      { garanti: { some: { cognome: { contains: term } } } },
    ];
    if (parts.length >= 2) {
      const [a, b] = parts;
      or.push(
        {
          AND: [
            { debitore: { cognome: { contains: a } } },
            { debitore: { nome: { contains: b } } },
          ],
        },
        {
          AND: [
            { debitore: { cognome: { contains: b } } },
            { debitore: { nome: { contains: a } } },
          ],
        }
      );
    }
    return { OR: or };
  }

  if (campo === "note") {
    return {
      OR: [
        { note: { contains: term } },
        { attivita: { some: { nota: { contains: term } } } },
      ],
    };
  }

  return {
    OR: [
      { commessa: { contains: term } },
      { contratto: { contains: term } },
      { numero: { contains: term } },
      { fatture: { some: { numero: { contains: term } } } },
    ],
  };
}
