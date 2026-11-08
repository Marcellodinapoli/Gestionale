# Formazione e Strumenti AI

## Modalità commerciale (Suite e prodotto autonomo)

| Modalità | Pacchetto Back Office | Moduli tenant | Menu operativo |
|----------|----------------------|---------------|----------------|
| **Credixa Suite / full** | `credixa-full` (o base + add-on) | Include **formazione** e **strumenti** | Menu recupero + **Formazione** e **Strumenti AI** |
| **Formazione standalone** | Solo pacchetto **Formazione** | `core` + `formazione` + `strumenti` (senza `recovery`) | Barra in alto: **Formazione**, **Strumenti AI**, **Account** (+ **Gestione** per admin); niente **Postazioni** |

**Attivazione primo admin (Back Office tenant):** POST `/api/platform/v1/tenants/{id}/invites` con `sendEmail: true` — ruolo **ADMIN**, email di registrazione (come Suite/recovery).

**Tenant solo Formazione — operatori:**

- **ADMIN** crea **SUPERVISOR** e **OPERATOR**.
- **SUPERVISOR** crea **OPERATOR** (da **Operatori**); l’operatore creato dal supervisor resta collegato a quel supervisor.
- Nessuna **postazione** da selezionare al login su questo prodotto.
- L’accesso **Solo formazione** (flag account) non è disponibile su tenant prodotto Formazione standalone.

## Aprire Formazione

**Scopo:** accedere a corsi, warm-up, role play e progressi.

**Percorso:** menu laterale → **Formazione**.

**Permessi e limiti:** permesso `formazione:view` e modulo tenant **formazione** (ruolo **OPERATOR** incluso). Gli account **solo formazione** usano quest'area come percorso principale (home su **I miei progressi**).

All’accesso, il gestionale collega l’utente a CreditForm (Firebase) e carica **I miei progressi** e **Corsi**; se il collegamento client non è disponibile, elenco e progressi restano leggibili tramite il server.

## Schede interne Formazione

**Percorso:** area **Formazione** → barra schede in alto.

**Voci (etichette letterali):**

- **Collaboratori** — solo se l'utente può monitorare i collaboratori (`canMonitor`); altrimenti non compare.
- **I miei progressi** → `/formazione/progressi`
- **Corsi** → `/formazione/corsi`
- **Warm-up** → `/formazione/warm-up`
- **Role Play** → `/formazione/roleplay`

**Azione:** clic sulla scheda desiderata.

**Nota:** è presente un controllo per tornare indietro nella navigazione formazione (icona freccia); il dettaglio dei singoli corsi non è documentato in questo capitolo.

## Aprire Strumenti AI

**Scopo:** usare strumenti AI collegati al modulo formazione (es. ricerca normativa).

**Percorso:** menu laterale → **Strumenti AI** (redirect iniziale verso **Ricerca normativa**).

**Permessi e limiti:** modulo **formazione**, permesso `strumenti:view`, voce menu visibile; account **solo formazione** vengono reindirizzati alla home formazione se tentano l'accesso.

## Schede Strumenti AI

**Percorso:** area **Strumenti AI** → navigazione etichettata **Sezioni Strumenti AI**.

**Voci:**

- **Ricerca normativa** → `/strumenti/ricerca-normativa`
- **Analisi Strategica Pre-Contatto** → `/strumenti/analisi-pre-contatto`

**Azione:** clic sulla scheda.

**Conferma:** contenuto della sezione selezionata sotto la barra schede (procedure interne di ciascun strumento non coperte da questo capitolo base).
