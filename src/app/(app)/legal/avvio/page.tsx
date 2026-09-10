import { redirect } from "next/navigation";

/** Avvio non è più nell’hub Legal: si apre solo dalla pratica. */
export default function LegalAvvioRedirectPage() {
  redirect("/legal");
}
