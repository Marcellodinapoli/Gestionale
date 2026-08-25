import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/guard";
import { CollaboratorCourseDetailView } from "@/components/formazione/supervisor/CollaboratorCourseDetailView";

export default async function CollaboratorCoursePage({
  params,
}: {
  params: Promise<{ uid: string; courseId: string }>;
}) {
  const user = await requirePermission("formazione:view");
  if (user.role !== "SUPERVISOR" && user.role !== "ADMIN") {
    redirect("/formazione/progressi");
  }

  const { uid, courseId } = await params;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm sm:p-6">
      <CollaboratorCourseDetailView firebaseUid={uid} courseId={courseId} />
    </div>
  );
}
