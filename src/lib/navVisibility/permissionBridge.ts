import type { Permission } from "@/lib/permissions";
import type { NavPageId } from "@/lib/navVisibility/catalog";

/**
 * Sezione menu che, se visibile (default ruolo o eccezione utente),
 * autorizza anche a lavorare con il permesso collegato.
 * Non mappare permessi “di base” già tipici del ruolo (es. pratiche:work),
 * altrimenti un’eccezione su una pagina ampia allargherebbe troppo i poteri.
 */
export function navPagesForPermission(permission: Permission): NavPageId[] {
  switch (permission) {
    case "mandanti:manage":
      return ["mandanti"];
    case "import:run":
      return ["import"];
    case "telephony:manage":
      return ["telefonia"];
    case "operatori:manage":
      return ["operatori", "postazioni"];
    case "users:manage":
      return ["configurazione"];
    case "audit:view":
      return ["log"];
    case "legal:view":
      return ["legal"];
    case "recruiting:view":
    case "recruiting:manage":
      return ["recruiting"];
    case "portafogli:view":
    case "portafogli:manage":
      return ["portafogli"];
    case "dialer:manage":
    case "dialer:admin":
      return ["dialer"];
    case "pratiche:assign":
      return ["affidi"];
    case "incassi:list":
    case "incassi:create":
    case "incassi:update":
      return ["incassi"];
    case "report:view":
      return ["report"];
    default:
      return [];
  }
}
