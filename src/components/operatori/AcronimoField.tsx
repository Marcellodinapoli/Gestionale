"use client";

import { useEffect, useState } from "react";
import {
  isAcronimoPatternValido,
  normalizeAcronimo,
  suggerisciAcronimo,
} from "@/lib/acronimoOperatore";

/**
 * Campo acronimo: suggerisce 3 lettere (CVV o VCC) da nome/cognome, unico nel tenant.
 */
export function AcronimoField({
  nome,
  cognome,
  acronimiUsati,
  defaultValue,
  ignoreAcronimo,
  inputCls,
}: {
  nome: string;
  cognome: string;
  acronimiUsati: string[];
  defaultValue?: string;
  /** In modifica: non considera questo acronimo come duplicato. */
  ignoreAcronimo?: string | null;
  inputCls: string;
}) {
  const [value, setValue] = useState(
    () => normalizeAcronimo(defaultValue) || ""
  );
  const [manuale, setManuale] = useState(Boolean(normalizeAcronimo(defaultValue)));

  useEffect(() => {
    if (manuale) return;
    const s = suggerisciAcronimo(nome, cognome, acronimiUsati, ignoreAcronimo);
    setValue(s || "");
  }, [nome, cognome, acronimiUsati, ignoreAcronimo, manuale]);

  const dup =
    value.length === 3 &&
    acronimiUsati.some(
      (a) =>
        normalizeAcronimo(a) === value &&
        normalizeAcronimo(a) !== normalizeAcronimo(ignoreAcronimo)
    );
  const badPattern = value.length === 3 && !isAcronimoPatternValido(value);

  return (
    <label className="w-28">
      <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
        Acronimo
      </span>
      <input
        name="acronimo"
        maxLength={3}
        value={value}
        onChange={(e) => {
          const next = (normalizeAcronimo(e.target.value) || "").slice(0, 3);
          setValue(next);
          setManuale(next.length > 0);
        }}
        className={`${inputCls} uppercase font-mono tracking-wide ${
          dup || badPattern ? "border-rose-400" : ""
        }`}
        placeholder="es. PAO"
        title="3 lettere: 1 consonante + 2 vocali oppure 1 vocale + 2 consonanti"
      />
      {dup ? (
        <span className="mt-0.5 block text-[10px] text-rose-700">
          Già usato da un altro utente
        </span>
      ) : null}
      {badPattern ? (
        <span className="mt-0.5 block text-[10px] text-rose-700">
          Formato: CVV o VCC (es. PAO / APR)
        </span>
      ) : null}
    </label>
  );
}
