"use client";

/**
 * Disabilitato: su pagehide (submit form, refresh, HMR in dev) inviava
 * /api/auth/logout e cancellava il cookie — admin usciva a ogni salvataggio.
 * Logout e rilascio postazione restano su «Esci» / cambio account.
 */
export function SessionEndOnUnload() {
  return null;
}
