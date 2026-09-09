import { redirect } from "next/navigation";

/** Redirect compatibilità vecchia URL nested. */
export default async function LegacyValutazioneRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/pratiche/${id}/valutazione-legale`);
}
