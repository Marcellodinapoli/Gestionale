import { ProgressCourseDetail } from "@/components/formazione/ProgressCourseDetail";

export default async function FormazioneProgressoCorsoPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ label?: string; category?: string }>;
}) {
  const { courseId } = await params;
  const sp = await searchParams;
  return (
    <ProgressCourseDetail
      courseId={courseId}
      courseLabel={sp.label ?? ""}
      catalogCategory={sp.category}
    />
  );
}
