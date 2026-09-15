import { redirect } from "next/navigation";
import { requireNavPage } from "@/lib/guard";
import { CollaboratorsList } from "@/components/formazione/supervisor/CollaboratorsList";
export default async function FormazioneCollaboratoriPage() {
  const user = await requireNavPage("formazione");
  if (user.role !== "SUPERVISOR" && user.role !== "ADMIN") {
    redirect("/formazione/progressi");
  }

  return (
    <CollaboratorsList />
  );
}
