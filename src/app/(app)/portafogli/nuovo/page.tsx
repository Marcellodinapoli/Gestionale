import { requireWritablePermission } from "@/lib/guard";
import { Card, PageHeader } from "@/components/ui";
import { PortafoglioForm } from "@/components/portafogli/PortafoglioForm";

export default async function NuovoPortafoglioPage() {
  await requireWritablePermission("portafogli:manage");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Nuovo portafoglio"
        subtitle="Valutazione o acquisto di un book. Le pratiche si agganciano dopo, dalla scheda."
      />
      <Card>
        <PortafoglioForm />
      </Card>
    </div>
  );
}
