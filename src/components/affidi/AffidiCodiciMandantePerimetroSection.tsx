import { CodiciMandantePerimetroTable } from "@/components/home/CodiciMandantePerimetroTable";
import type {
  RigaCodiciMandantePerimetro,
  RigaCodiciMandantePerimetroOperatore,
} from "@/lib/codiciMandantePerimetroUi";
import type { SessionUser } from "@/lib/permissions";

export function AffidiCodiciMandantePerimetroSection({
  user,
  righe,
  righePerOperatore,
}: {
  user: SessionUser;
  righe: RigaCodiciMandantePerimetro[];
  righePerOperatore: RigaCodiciMandantePerimetroOperatore[];
}) {
  const titolo =
    user.role === "OPERATOR"
      ? "Codici scarico"
      : "Codici scarico per mandante e perimetro";

  return (
    <div className="min-w-0 rounded-xl border border-[var(--line)] bg-white p-4">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {titolo}
      </h2>
      <p className="mb-3 text-xs text-[var(--muted)]">
        Stesso riepilogo della Home: portafoglio del gruppo (pratiche affidate ai membri), non
        limitato al mandato/perimetro scelto sopra.
      </p>
      <CodiciMandantePerimetroTable
        righe={righe}
        righePerOperatore={
          user.role === "SUPERVISOR" || user.role === "BACK_OFFICE"
            ? righePerOperatore
            : undefined
        }
      />
    </div>
  );
}
