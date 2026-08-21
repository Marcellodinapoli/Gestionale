export const CALL_SESSION_START = "gestionale:call-session-start";
export const CALL_SESSION_END = "gestionale:call-session-end";

export type CallSessionDetail = {
  numero: string;
};

export function avviaSessioneChiamata(numero: string) {
  const trimmed = numero.trim();
  if (typeof window === "undefined" || !trimmed) return;
  window.dispatchEvent(
    new CustomEvent<CallSessionDetail>(CALL_SESSION_START, {
      detail: { numero: trimmed },
    })
  );
}

export function terminaSessioneChiamata() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CALL_SESSION_END));
}
