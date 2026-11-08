# Recruiting — modulo commerciale e profilo tenant

## Due modalità di vendita

| Modalità | Pacchetto Back Office | Moduli tenant | Menu operativo |
|----------|----------------------|---------------|----------------|
| **Credixa Suite / full** | `credixa-full` (o base + altri add-on) | Include `recruiting` tra le sezioni | Menu completo recupero + voce **Recruiting** |
| **Recruiter standalone** | Solo `recruiting` | `core` + `recruiting` (senza `recovery`) | **Recruiting** + **Account**; amministrazione (Operatori, Configurazione, …) resta raggiungibile |

Il modulo tecnico è sempre `recruiting` (id piattaforma). Il pacchetto commerciale in Back Office si chiama **Recruiter**.

## Attivazione tenant

1. In Platform / configurazione tenant: pacchetto **Recruiter** oppure **Credixa full**.
2. La lista moduli deriva da `platform.packages` → `modulesFromPackages` (vedi registry in codice).
3. Tenant **solo Recruiter**: all’apertura di **Home** (senza `recovery`) redirect a `/recruiting`.

## Accesso e permessi

- **Modulo:** gate `hasModule(..., "recruiting")` sulle pagine sotto `/recruiting`.
- **Permessi baseline:** `recruiting:view`, `recruiting:manage` — ruoli **ADMIN**, **AMMINISTRAZIONE**, **RECRUITER** (matrice **Default pagine per ruolo**: pagina **recruiting**).
- **Visibilità menu:** come le altre sezioni (`navVisibility` / pagina **recruiting**).

## Tenant solo Recruiter (come Legal AI)

- **Menu operativo:** **Recruiting** + **Account** (senza pratiche/recovery).
- **Operatori:** in creazione/modifica è ammesso **solo** il ruolo **RECRUITER** (stessi campi standard: nome, cognome, email, password, sede, …).
- **Invito Platform (Back Office tenant):** POST `/api/platform/v1/tenants/{id}/invites` con `sendEmail: true` — ruolo **RECRUITER**, email di attivazione via Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `CREDIXA_PUBLIC_URL`).
- Sul tenant **Credixa full**, gli utenti **RECRUITER** vedono comunque solo **Recruiting** e **Account** nel menu baseline (senza area pratiche).

## Cosa non dipende dal recupero crediti

Offerte, candidature, colloqui e receiver CV usano dati **Recruiting** (SQL dedicato / repository modulo). Non serve il modulo **recovery** per il flusso recruiting.

## Tenant storici con recovery

I tenant senza config v2 esplicita restano sul default che include anche **recruiting** tra le sezioni ex-core. Per vendere Recruiter **solo** ad un nuovo cliente usare pacchetto **Recruiter** (senza Credixa base), non il default recovery.
