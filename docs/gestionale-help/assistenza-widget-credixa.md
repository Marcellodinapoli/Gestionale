# Assistenza Credixa Suite (chatbot in app)

## Aprire l'assistente di utilizzo

**Scopo:** ottenere istruzioni su come usare Credixa Suite basate sui manuali approvati.

**Percorso:** da qualsiasi pagina dell'app (dopo login), angolo in basso a destra.

**Azione:** pulsante circolare blu con icona help — etichetta accessibilità **Apri assistenza Credixa Suite**.

**Conferma:** si apre il pannello **Assistenza Credixa Suite** (dialog).

**Permessi e limiti:** permesso `assistenza:view` — ruoli: **ADMIN**, **AMMINISTRAZIONE**, **SUPERVISOR**, **BACK_OFFICE**, **OPERATOR**, **MANUTENZIONE**, **LEGAL**. Se il pulsante non compare, l'utente non ha il permesso.

## Porre una domanda

**Scopo:** chiedere come eseguire un'operazione in Credixa Suite.

**Percorso:** pannello **Assistenza Credixa Suite** aperto.

**Compilazione:** campo testo con placeholder **Es. Dove trovo i filtri pratiche?** (massimo 2000 caratteri).

**Azione:** pulsante invio (icona **Invia**, `aria-label` **Invia**) o invio dal form.

**Conferma:** la risposta dell'assistente compare nel pannello; durante l'attesa compare **Elaborazione…**. Messaggio iniziale se la chat è vuota: **Chiedi come usare Credixa Suite. Le risposte si basano sui manuali approvati.**

**Limiti verificati:**

- Non inviare dati di pratiche, debitori o importi nella domanda (il backend rifiuta payload con chiavi sensibili).
- Le risposte usano solo estratti del manuale **autorizzati per il tuo ruolo** (es. un operatore non riceve istruzioni amministrative come creazione account o modifica incassi riservata). Se chiedi una procedura non disponibile per il tuo profilo, l’assistente risponde con un messaggio neutro senza passaggi operativi.
- Prima di ogni risposta, Credixa chiama **`GET /api/assistenza/session`** (ruolo da Neon) e aggiorna token Firebase e Firestore. La Cloud Function **`gestionaleHelp`** chiama a sua volta **`POST /api/assistenza/role-verify`** sul BFF Credixa (autenticazione server-to-server) per leggere il ruolo corrente su Neon; se la verifica fallisce, l'account è disattivato o `assistenza:view` è revocato, la richiesta viene rifiutata senza usare un ruolo precedente. Il manuale è filtrato per permesso (non in base al testo della domanda).
- Se il servizio non risponde: **Impossibile ottenere una risposta. Riprova tra poco.** con link **Riprova** durante errori di collegamento (**Collegamento…** in caricamento).

## Chiudere il pannello

**Azione:** pulsante **Chiudi** (icona X nell'intestazione del pannello).

**Conferma:** ritorno al solo pulsante flottante **Apri assistenza Credixa Suite**.

## Quando il chatbot non basta

**Scopo:** capire come ottenere supporto umano se l’assistente non risponde.

**Percorso:** contatta l’**amministratore del tenant** o il referente interno indicato dalla tua azienda.

**Nota:** il messaggio standard dell'assistente backend, se la documentazione non basta, invita a rivolgersi all’amministratore (senza descrivere procedure riservate).

## Aprire un ticket assistenza Credixa (solo ADMIN)

<!-- assistenza-acl: admin_ticket -->

**Scopo:** inviare una richiesta al supporto Credixa Suite tramite l’area **Ticket**.

**Percorso:** menu amministrazione → **Ticket** (baseline: solo ruolo **ADMIN**).

**Nota:** vedi capitolo **Ticket assistenza Credixa Suite** per i passaggi operativi.
