/** Torna alla pagina precedente nel browser; fallback se non c'è cronologia. */
export function navigateBack(
  router: { back: () => void; push: (href: string) => void },
  fallbackHref?: string | null
) {
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
    return;
  }
  if (fallbackHref) {
    router.push(fallbackHref);
  }
}
