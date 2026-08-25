import { CourseTraining } from "@/components/formazione/CourseTraining";

export default async function FormazioneCorsoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ label?: string; category?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  return (
    <CourseTraining
      courseId={id}
      courseLabel={sp.label ?? ""}
      catalogCategory={sp.category}
    />
  );
}
