# Accesso a Credixa Suite

## Accedere al gestionale (login)

**Scopo:** entrare in Credixa Suite con le credenziali della propria azienda.

**Percorso:** apri l'URL di login dell'installazione (pagina titolo **Accedi**, intestazione **Credixa Suite**).

**Compilazione:**

1. Campo **Codice azienda** (`tenantSlug`).
2. Campo **Email**.
3. Campo **Password**.

**Azione:** pulsante **Entra** (durante l'invio mostra **Accesso…**).

**Conferma:** in caso di successo il browser viene reindirizzato (es. home, cambio password obbligatorio o scelta postazione). In caso di errore compare un messaggio (es. **Credenziali non valide**).

**Permessi e limiti:** tutti gli utenti con account attivo. Dopo l'accesso possono applicarsi redirect automatici (password scaduta → `/cambia-password`; scelta postazione → `/seleziona-postazione`; account solo formazione → area Formazione).

## Cambiare la password

**Scopo:** aggiornare la password o soddisfare il obbligo di rinnovo se scaduta.

**Percorso:** pagina **Cambia password** (redirect automatico se la password è scaduta) oppure sezione password nella pagina **Account** (menu **Account**).

**Compilazione (tre campi obbligatori):**

1. **1 · Password attuale**
2. **2 · Nuova password** (rispetta i requisiti indicati in pagina)
3. **3 · Conferma nuova password**

**Azione:** pulsante **Cambia password** (in attesa: **Aggiorno…**).

**Conferma:** messaggio **Password aggiornata** o messaggio di errore in pagina (es. conferma non coincidente, password uguale alla precedente).

**Permessi e limiti:** ogni utente autenticato per il proprio account.

## Uscire da Credixa Suite (logout)

**Scopo:** terminare la sessione.

**Percorso:** barra superiore dell'app (layout principale dopo il login).

**Azione:** pulsante **Esci** (icona con tooltip **Esci**).

**Conferma:** ritorno al flusso di logout lato server (sessione chiusa).

## Selezionare la postazione al login

**Scopo:** associare la sessione a una postazione telefonica/di lavoro quando richiesto dalla policy aziendale.

**Percorso:** pagina **Seleziona la tua postazione** (`/seleziona-postazione`), mostrata dopo il login se previsto per il ruolo.

**Azione:**

1. Clic sulla card della postazione desiderata (non selezionabile se occupata da altri).
2. Opzionale (solo per ruoli abilitati): spunta **Usa sempre questa postazione**.
3. Pulsante **Conferma postazione** (in attesa: **Caricamento...**).

**Conferma:** redirect alla home (`/`).

**Permessi e limiti:** dipende da `requiresPostazione` / `mustChoosePostazioneAlLogin` per ruolo. Alcuni ruoli vedono **Entra comunque senza postazione** se non ci sono postazioni o sono tutte occupate. Pulsante **Esci e torna al login** sempre disponibile nelle schermate di errore elenco postazioni.

**Problemi comuni (verificati in interfaccia):**

- **Tutte le postazioni sono occupate**: messaggio che invita ad attendere o contattare l'amministratore; link testuale a **Gestione → Postazioni** nel messaggio di sistema.
- **Nessuna postazione configurata**: stesso tipo di messaggio con invito a creare postazioni in **Gestione → Postazioni**.
