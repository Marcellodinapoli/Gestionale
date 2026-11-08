# Predictive — modulo commerciale e profilo tenant

## Due modalità di vendita

| Modalità | Pacchetto Back Office | Moduli tenant | Menu operativo |
|----------|----------------------|---------------|----------------|
| **Credixa Suite / full** | `credixa-full` (o base + altri add-on) | Include `dialer` tra le sezioni | Menu recupero + voce **Predictive** |
| **Predictive standalone** | Solo `dialer` | `core` + `dialer` (senza `recovery`) | **Predictive** + **Account**; amministrazione (Operatori, Postazioni, Sedi, Telefonia, Configurazione, …) |

Il pacchetto commerciale in Back Office si chiama **Predictive** (modulo tecnico `dialer`).

## Attivazione tenant

1. In Platform / configurazione tenant: pacchetto **Predictive** (senza Credixa base) oppure Suite/full.
2. Tenant **solo Predictive**: all’apertura di **Home** (senza `recovery`) redirect a `/predictive`.

## Tenant solo Predictive — registrazione e ruoli

- **Invito Platform (Back Office tenant):** invito con `sendEmail: true` — ruolo **ADMIN** (amministratore azienda), email di attivazione come gli altri prodotti standalone.
- **Creazione utenti (Operatori):** dall’**ADMIN** si possono creare **SUPERVISOR** e **OPERATOR**; dal **SUPERVISOR** solo **OPERATOR** (nessun BACK_OFFICE, LEGAL, RECRUITER, …).
- **Supervisor:** può gestire gli operatori del proprio tenant (stesso perimetro Formazione standalone).
- **Postazioni:** obbligatorie al login per supervisor e operatori (a differenza del prodotto Formazione standalone).
- **Accesso solo formazione:** non disponibile su questo tenant.

## Accesso e permessi

- **Modulo:** gate `dialer` sulle pagine sotto `/predictive`.
- **Permessi baseline:** `dialer:operate`, `dialer:manage` — ruoli **ADMIN**, **SUPERVISOR**, **OPERATOR** (campagne e monitor secondo permessi e visibilità menu).

## Mix di pacchetti senza recovery

Se il tenant ha **più add-on** attivi (es. Predictive + Formazione), non si applica il profilo **Predictive standalone puro**; restano le regole del prodotto escluso o del tenant misto già definito per gli altri moduli.
