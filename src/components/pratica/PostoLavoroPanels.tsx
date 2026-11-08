import type { ReactNode } from "react";
import {
  AnagraficaField,
  AnagraficaNomeRiga,
  anagraficaDatiRecapitiGridClassName,
  anagraficaSplitCellClass,
} from "@/components/pratica/anagraficaUi";

type Recapito = { tipo: string; valore: string; stato?: string | null };

type PersonaPostoLavoro = Record<string, unknown> & {
  nome?: string;
  cognome?: string;
  recapiti?: Recapito[];
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function cittaLavoroLine(persona: PersonaPostoLavoro): string {
  const cap = str(persona.capLavoro) ?? str(persona.CapLavoro);
  const citta = str(persona.cittaLavoro) ?? str(persona.CittaLavoro);
  const provincia = str(persona.provinciaLavoro) ?? str(persona.ProvinciaLavoro);
  const parts = [cap, citta, provincia].filter(Boolean);
  return parts.join(" ") || "—";
}

function telefoniLavoro(persona: PersonaPostoLavoro): string[] {
  const out: string[] = [];
  const principale =
    str(persona.telefonoLavoro) ??
    str(persona.TelefonoLavoro) ??
    str(persona.telLavoro) ??
    str(persona.TelLavoro);
  if (principale) out.push(principale);

  for (const r of persona.recapiti ?? []) {
    const tipo = r.tipo.trim().toUpperCase();
    if (
      tipo === "LAVORO_TELEFONO" ||
      tipo === "TELEFONO_LAVORO" ||
      tipo === "LAVORO"
    ) {
      const v = str(r.valore);
      if (v) out.push(v);
    }
  }

  return [...new Set(out)];
}

export function postoLavoroDaPersona(persona: PersonaPostoLavoro) {
  const ragioneSociale =
    str(persona.ragioneSocialeLavoro) ??
    str(persona.RagioneSocialeLavoro) ??
    str(persona.nomeLavoro) ??
    str(persona.NomeLavoro) ??
    str(persona.datoreLavoro) ??
    str(persona.DatoreLavoro) ??
    str(persona.aziendaLavoro) ??
    str(persona.AziendaLavoro) ??
    str(persona.azienda) ??
    str(persona.Azienda);

  const indirizzo =
    str(persona.indirizzoLavoro) ??
    str(persona.IndirizzoLavoro) ??
    str(persona.sedeLavoro) ??
    str(persona.SedeLavoro) ??
    "—";

  const citta = cittaLavoroLine(persona);
  const telefoni = telefoniLavoro(persona);

  return { ragioneSociale, indirizzo, citta, telefoni };
}

const LABEL_LAVORO_CLS =
  "px-0.5 py-px text-[9px] font-semibold uppercase leading-tight tracking-wide bg-[#eef2f6] text-[#4a5568]";

function TelefonoLavoroCell({
  label,
  value,
  row,
}: {
  label: string;
  value: string;
  row: 1 | 2 | 3;
}) {
  return (
    <div className={anagraficaSplitCellClass(row, 2)}>
      <div className="flex h-full min-h-0 flex-col">
        <div className={LABEL_LAVORO_CLS}>{label}</div>
        <div
          className="flex min-h-[20px] flex-1 items-center truncate border border-[var(--line)] bg-white px-0.5 py-px text-[11px] leading-snug tabular-nums"
          title={value !== "—" ? value : undefined}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function RecapitiTelefoniciLavoroRighe({ numeri }: { numeri: string[] }) {
  const [primo, secondo, ...altri] = numeri;
  const riga2 =
    secondo ?? (altri.length ? altri.join(" · ") : "—");
  const riga1 = primo ?? "—";

  return (
    <>
      <TelefonoLavoroCell label="Telefono" value={riga1} row={1} />
      <TelefonoLavoroCell label="Altri recapiti" value={riga2} row={2} />
      <div
        className={`${anagraficaSplitCellClass(3, 2)} hidden sm:block`}
        aria-hidden
      />
    </>
  );
}

function PostoLavoroCorpo({
  persona,
  titoloRiga,
}: {
  persona: PersonaPostoLavoro;
  titoloRiga?: string;
}) {
  const pl = postoLavoroDaPersona(persona);
  const vuoto =
    !pl.ragioneSociale &&
    pl.indirizzo === "—" &&
    pl.citta === "—" &&
    !pl.telefoni.length;

  if (vuoto) {
    return (
      <p className="px-1 py-1.5 text-[11px] italic leading-snug text-[var(--muted)]">
        Nessun dato sul posto di lavoro
      </p>
    );
  }

  const titoloNome = pl.ragioneSociale || titoloRiga || "—";

  return (
    <div className="px-1 pb-1">
      <div className={anagraficaDatiRecapitiGridClassName}>
        <AnagraficaNomeRiga>{titoloNome}</AnagraficaNomeRiga>
        <div className={anagraficaSplitCellClass(2, 1)}>
          <AnagraficaField
            wide
            compact
            stretch
            label="Indirizzo"
            value={pl.indirizzo}
          />
        </div>
        <div className={anagraficaSplitCellClass(3, 1)}>
          <AnagraficaField wide compact stretch label="Città" value={pl.citta} />
        </div>
        <RecapitiTelefoniciLavoroRighe numeri={pl.telefoni} />
      </div>
    </div>
  );
}

function PostoLavoroSottoSezione({
  titolo,
  children,
}: {
  titolo: string;
  children: ReactNode;
}) {
  return (
    <section className="shrink-0 border-t border-[var(--line)] bg-[#f8fafc]">
      <h3 className="border-b border-[var(--line)] bg-[#eef2f6] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1a365d]">
        {titolo}
      </h3>
      {children}
    </section>
  );
}

export function PostoLavoroDebitoreBlock({
  debitore,
}: {
  debitore: PersonaPostoLavoro;
}) {
  return (
    <PostoLavoroSottoSezione titolo="Posto di lavoro">
      <PostoLavoroCorpo persona={debitore} />
    </PostoLavoroSottoSezione>
  );
}

export function PostoLavoroGarantiBlock({
  garanti,
}: {
  garanti: Array<PersonaPostoLavoro & { id: string }>;
}) {
  return (
    <PostoLavoroSottoSezione titolo="Posto di lavoro">
      {garanti.length === 0 ? (
        <p className="px-2 py-1.5 text-[11px] italic text-[var(--muted)]">
          Nessun garante registrato
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {garanti.map((g, i) => (
            <li key={g.id}>
              <PostoLavoroCorpo
                persona={g}
                titoloRiga={`${i + 1}. ${g.cognome ?? ""} ${g.nome ?? ""}`.trim()}
              />
            </li>
          ))}
        </ul>
      )}
    </PostoLavoroSottoSezione>
  );
}
