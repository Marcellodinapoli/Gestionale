import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { CollaboratorProgressView } from "@/components/formazione/supervisor/CollaboratorProgressView";

export default async function CollaboratorProgressPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const user = await requirePermission("formazione:view");
  if (user.role !== "SUPERVISOR" && user.role !== "ADMIN") {
    redirect("/formazione/progressi");
  }

  const { uid } = await params;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
      <CollaboratorProgressView firebaseUid={uid} />
    </div>
  );
}
