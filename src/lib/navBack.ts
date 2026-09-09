/** Torna alla destinazione indicata; se manca, usa la cronologia del browser. */
export function navigateBack(
  router: { back: () => void; push: (href: string) => void },
  fallbackHref?: string | null
) {
  if (fallbackHref) {
    router.push(fallbackHref);
    return;
  }
  if (typeof window !== "undefined" && window.history.length > 1) {
    router.back();
  }
}
