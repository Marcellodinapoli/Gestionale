import { StatoBadge } from "@/components/ui";
import {
  affidiStatoOperativo,
  type AffidiPraticaStatoInput,
} from "@/lib/affidi/affidiPraticaStatoUi";

/** Come colonna Stato nell’elenco Pratiche. */
export function AffidiPraticaStatoHeaderCell() {
  return <th className="text-xs font-bold">Fase</th>;
}

export function AffidiPraticaStatoRowCell({ pratica }: { pratica: AffidiPraticaStatoInput }) {
  return (
    <td className="text-xs">
      <StatoBadge stato={affidiStatoOperativo(pratica)} />
    </td>
  );
}
