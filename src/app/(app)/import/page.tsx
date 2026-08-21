import { requirePermission } from "@/lib/guard";
import { PageHeader, Card } from "@/components/ui";
import { ImportForm } from "@/components/ImportForm";
import { importCsvAction, importIncassiCsvAction } from "@/actions/core";
import { prisma } from "@/lib/prisma";
import { parsePerimetri } from "@/lib/mandantePerimetri";
import { isManutenzione } from "@/lib/permissions";

export default async function ImportPage() {
  const user = await requirePermission("import:run");

  const mandantiRaw = isManutenzione(user)
    ? []
    : await prisma.mandante.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { codice: "asc" },
        select: {
          id: true,
          codice: true,
          ragioneSociale: true,
          perimetri: true,
        },
      });

  const mandanti = mandantiRaw.map((m) => ({
    id: m.id,
    codice: m.codice,
    ragioneSociale: m.ragioneSociale,
    perimetri: parsePerimetri(m.perimetri).map((p) => ({
      id: p.id,
      nome: p.nome,
    })),
  }));

  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <PageHeader
          title="Import CSV"
          subtitle="Carichi massivi di pratiche e incassi (back office)"
        />
      </div>
      <Card title="Pratiche">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Seleziona mandante, perimetro, lotto e data affido, poi carica il CSV.
          Separatore punto e virgola. Colonne: nome;cognome;cf;telefono;citta;capitale;interessi;spese
        </p>
        <a
          className="mb-4 inline-block text-sm text-[var(--accent)] underline"
          href="/esempio-pratiche.csv"
        >
          Scarica esempio
        </a>
        <ImportForm
          action={importCsvAction}
          buttonLabel="Importa pratiche"
          mandanti={mandanti}
        />
      </Card>
      <Card title="Incassi massivi">
        <p className="mb-3 text-sm text-[var(--muted)]">
          Stessi campi (mandante, perimetro, lotto, affido): gli incassi si
          applicano solo alle pratiche di quel lotto affidato in quella data.
          Colonne CSV: numero;importo (opzionali: data;metodo;causale;modo).
        </p>
        <a
          className="mb-4 inline-block text-sm text-[var(--accent)] underline"
          href="/esempio-incassi.csv"
        >
          Scarica esempio
        </a>
        <ImportForm
          action={importIncassiCsvAction}
          buttonLabel="Importa incassi"
          mandanti={mandanti}
        />
      </Card>
    </div>
  );
}
