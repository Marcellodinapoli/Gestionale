# Operatori: creazione, modifica, ruoli e permessi

## Aprire la gestione operatori

**Scopo:** amministrare account, ruoli, accesso e password del tenant.

**Percorso:** menu amministrazione → **Operatori**.

**Intestazione:** **Gestione operatori** — sottotitolo *Anagrafica, condizione economica, accesso, sede e password*.

**Permessi:** `operatori:manage` — ruoli **ADMIN** e **AMMINISTRAZIONE**; voce menu anche legata a permesso e modulo.

**Azioni in testata:** **Cerca** (filtri elenco), **Default pagine per ruolo** (link a visibilità menu), **Crea nuovo operatore**.

## Creare un operatore

**Percorso:** **Operatori** → **Crea nuovo operatore**.

**Modale:** **Nuovo operatore**.

**Campi principali:**

- **Nome**, **Cognome**, **Email**, **Password**
- **Acronimo** (campo dedicato con suggerimento da nome/cognome)
- **Accesso:** **Completo** o **Solo formazione**
- Se completo: **Ruolo** (opzioni da `ruoliCreabiliDa` del creatore), **Supervisor** (opzionale), **Sede** (obbligatoria)
- Per **OPERATOR**: **Condizione economica**, eventuale **Importo fisso (€/mese)**
- **Codice fiscale** + campi anagrafica extra
- Per OPERATOR: checkbox **Consulente esterno**, **Abilita accesso CredixaApp** (se modulo attivo)
- Sezione **Visibilità pagine (questo utente)** (checkbox pagine menu)

**Azione:** **Crea** (in attesa **Creazione…**). **Annulla** chiude.

**Conferma:** operatore in tabella; modale chiusa.

**Ruoli creabili (esempi verificati):**

- **ADMIN:** OPERATOR, BACK_OFFICE, SUPERVISOR, AMMINISTRAZIONE, LEGAL, RECEPTION, **AVVOCATO**
- **AMMINISTRAZIONE:** stesso set
- **BACK_OFFICE:** solo **OPERATOR**

**Account solo formazione:** testo in form — accesso limitato a Formazione (nessuna postazione/pratiche/Strumenti AI).

**Tenant prodotto Predictive standalone** (solo pacchetto Predictive, senza recovery): in creazione compaiono solo **SUPERVISOR** e **OPERATOR** (ADMIN → entrambi; SUPERVISOR → solo OPERATOR); nessuna tendina **Accesso** (né solo formazione). Vedi capitolo **Predictive — modulo commerciale e profilo tenant**.

## Resettare la password di un operatore

<!-- assistenza-acl: operatori_manage -->

**Scopo:** impostare una nuova password per un account esistente (azione amministrativa, non la propria password).

**Percorso:** menu **Operatori** → tabella **Gestione operatori** → colonna **Password** sulla riga dell’utente.

**Azione:**

1. Pulsante **Reset** (icona chiave).
2. Campo **Nuova pwd** (rispetta i requisiti mostrati sotto il campo).
3. Pulsante **OK**.

**Conferma:** messaggio **Resettata!**; il campo si chiude dopo l’aggiornamento.

**Permessi:** `operatori:manage` (**ADMIN**, **AMMINISTRAZIONE**). Non usare **Account** → cambio password per reimpostare la password di un altro operatore.

## Modificare un operatore (modale)

**Percorso:** riga operatore → **Modifica**.

**Modale:** **Modifica — [Nome Cognome]**.

**Campi:** come creazione dove applicabile (nome, email, sede, supervisor per OPERATOR, condizione economica, CF, CredixaApp, **Visibilità pagine** con eccezioni utente).

**Azione:** **Salva modifiche** (**Salvataggio…**).

**Nota:** il **Ruolo** non si cambia nel modale; si usa la tendina **Ruolo** nella tabella (vedi sotto).

## Azioni rapide in tabella

**Ruolo:** tendina nella colonna **Ruolo** (salvataggio immediato via `updateRuoloAction`) — opzioni = `ruoliCreabiliDa` + ADMIN se l’utente è già ADMIN.

**Accesso:** tendina **Completo** / **Solo formazione** (non per ADMIN, AMMINISTRAZIONE, LEGAL).

**Sede:** tendina sedi.

**Acronimo:** icona modifica → conferma **Check** / annulla **X**.

**Password:** pulsante **Reset** → campo **Nuova pwd**, **OK** → messaggio **Resettata!**

**Elimina:** **Elimina** → conferma browser *Eliminare [nome]?*

## Permessi di menu per utente

**Nel form creazione/modifica:** blocco **Visibilità pagine (questo utente)** — checkbox con etichette menu in ordine alfabetico (es. **Affidi**, **Pratiche**, **Import**).

**Pulsante opzionale:** **Salva come default per tutti i [Ruolo]** (aggiorna default ruolo tenant).

**Link:** **Preferenze visibilità** → `/configurazione/visibilita` (capitolo dedicato).

**Eccezioni:** contatore *N eccezioni rispetto al default del ruolo* in UI.

## Cosa non è gestito da questa pagina

- **MANUTENZIONE:** non compare nella matrice ruoli standard; gestione separata.
- Dettaglio di ogni permesso applicativo (`pratiche:work`, `legal:view`, `legal-ai:view`, …) oltre alla visibilità menu: non esposto come matrice in **Operatori** (solo flag pagine + ruolo in `permissions.ts`).
