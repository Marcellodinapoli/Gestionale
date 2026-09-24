import Link from "next/link";
import {
  Briefcase,
  Calculator,
  FileText,
  Lock,
  ScanLine,
  Smartphone,
  StickyNote,
  UserCheck,
} from "lucide-react";
import { requireNavPage } from "@/lib/guard";
import { usersDbFromUser } from "@/lib/usersRepo";
import { can } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import { CollegaCreditCalcButton } from "@/components/creditcalc/CollegaCreditCalcButton";

const FUNZIONI = [
  {
    icon: Briefcase,
    title: "Pratiche in affido",
    text: "Vede solo le pratiche caricate a lui: elenco, stato, residuo, debitore e mandante.",
  },
  {
    icon: FileText,
    title: "Scheda pratica",
    text: "Apre il dettaglio: recapiti, garanti, rate, incassi, fatture e documenti.",
  },
  {
    icon: StickyNote,
    title: "Note di lavorazione",
    text: "Scrive note sulla pratica. Restano visibili anche in gestionale, come dal PC.",
  },
  {
    icon: Calculator,
    title: "Codice scarico",
    text: "Imposta il codice scarico dalla lavorazione mobile, con lo stesso lock della postazione.",
  },
  {
    icon: Lock,
    title: "Un operatore alla volta",
    text: "Se la pratica è già aperta da un collega, CreditCalc la blocca in sola lettura.",
  },
  {
    icon: Smartphone,
    title: "Lavoro fuori sede",
    text: "Il consulente esterno lavora dal telefono senza accedere al gestionale desktop.",
  },
];

export default async function CreditCalcPage() {
  const user = await requireNavPage("creditcalc");
  let creditCalcEnabled = false;
  try {
    const me = await usersDbFromUser(user).findUnique({
      where: { id: user.id },
      select: { creditCalcEnabled: true },
    });
    creditCalcEnabled = Boolean(me?.creditCalcEnabled);
  } catch {
    creditCalcEnabled = false;
  }
  const puoGestireOperatori = can(user, "operatori:manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title="CreditCalc"
        subtitle="L’app mobile collegata al gestionale: pratiche in affido, note e scarico anche fuori dalla postazione."
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--navy)] text-white">
            <Calculator className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-2">
            <h2 className="text-base font-semibold text-[var(--navy)]">Cos’è</h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              CreditCalc è l’app per consulenti esterni e operatori sul campo. Si collega
              all’azienda con un QR: l’identità è quella dell’utente gestionale, senza
              configurare server o password extra. Non mostra il totale delle pratiche
              dell’azienda: solo quelle affidate a lui.
            </p>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Cosa può fare
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FUNZIONI.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title}>
                <div className="flex gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--navy)]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--navy)]">{f.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{f.text}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Come si collega">
          <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed text-[var(--muted)]">
            <li>
              Amministrazione abilita il profilo{" "}
              <span className="font-medium text-[var(--navy)]">consulente esterno</span> e la
              spunta <span className="font-medium text-[var(--navy)]">CreditCalc</span> sulla
              scheda operatore.
            </li>
            <li>
              L’operatore genera un QR da Account (o da questa pagina, se è abilitato).
            </li>
            <li>
              Nell’app: <span className="font-medium text-[var(--navy)]">Impostazioni → Collegamenti</span>{" "}
              e scansione del QR. Il collegamento è personale e temporaneo.
            </li>
          </ol>
          {puoGestireOperatori ? (
            <p className="mt-3 text-sm">
              <Link href="/operatori" className="font-semibold text-[var(--navy)] underline">
                Apri Operatori
              </Link>{" "}
              per abilitare un consulente.
            </p>
          ) : null}
        </Card>

        <Card title="Chi può usarla">
          <div className="flex gap-3">
            <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--navy)]" />
            <div className="space-y-2 text-sm leading-relaxed text-[var(--muted)]">
              <p>
                L’app è per gli operatori abilitati come consulenti esterni. Questa pagina
                invece è visibile a tutti, così ciascuno sa a cosa serve CreditCalc.
              </p>
              <p>
                Senza abilitazione l’app non apre le pratiche. Il QR si genera solo sul
                proprio utente, da{" "}
                <Link href="/account" className="font-semibold text-[var(--navy)] underline">
                  Account
                </Link>
                .
              </p>
            </div>
          </div>
        </Card>
      </div>

      {creditCalcEnabled ? (
        <Card title="Collega la tua app">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3 text-sm leading-relaxed text-[var(--muted)]">
              <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-[var(--navy)]" />
              <p>
                Sei abilitato. Genera un QR e scansionarlo da CreditCalc → Impostazioni →
                Collegamenti.
              </p>
            </div>
            <CollegaCreditCalcButton label="Genera QR collegamento" />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
