import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { CollaboratorsList } from "@/components/formazione/supervisor/CollaboratorsList";
export default async function FormazioneCollaboratoriPage() {
  const user = await requirePermission("formazione:view");
  if (user.role !== "SUPERVISOR" && user.role !== "ADMIN") {
    redirect("/formazione/progressi");
  }

  return (
    <CollaboratorsList />
  );
}
