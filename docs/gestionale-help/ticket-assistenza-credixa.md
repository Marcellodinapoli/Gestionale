# Ticket assistenza Credixa Suite

## Accedere ai ticket

**Scopo:** aprire e seguire richieste di supporto verso Credixa Suite.

**Percorso:** menu laterale (gruppo amministrazione) → **Ticket**.

**Intestazione:** titolo **Ticket assistenza**, sottotitolo **Apri e segui le richieste di supporto Credixa Suite**.

**Permessi e limiti:**

- Voce menu **Ticket** visibile in baseline solo per ruolo **ADMIN**.
- La pagina esegue `requireNavPage("ticket")` e, se il ruolo non è **ADMIN**, reindirizza a **Account** (`/account`).
- Altri ruoli devono usare canali esterni o un amministratore tenant; non è documentato un percorso in-app alternativo per non-ADMIN.

## Aprire un nuovo ticket

**Scopo:** inviare una richiesta al Back Office Credixa.

**Percorso:** **Ticket** → pulsante **Apri ticket** (in alto a destra nell'area contenuto).

**Compilazione:**

- **Oggetto** (obbligatorio; placeholder es. **Problema accesso operatori**)
- **Messaggio** (obbligatorio; placeholder **Descrivi il problema…**)

**Azione:** pulsante **Invia ticket** (in attesa **Invio…**). Per annullare la compilazione: **Annulla** sullo stesso pulsante toggle (**Apri ticket** / **Annulla**).

**Conferma:** il ticket compare nell'elenco; stato badge **Aperto** (verde) o **Chiuso** (grigio) se già chiuso dal supporto.

**Testo guida in pagina:** *Apri un ticket verso l'assistenza Credixa Suite. Le risposte compareanno qui e nel Back Office.*

## Rispondere a un ticket aperto

**Percorso:** **Ticket** → scheda ticket nell'elenco (stato **Aperto**).

**Compilazione:** campo con placeholder **Scrivi un aggiornamento…**

**Azione:** pulsante **Rispondi**.

**Conferma:** il messaggio compare nel thread con mittente **Tu**; le risposte del supporto con mittente **Assistenza**. La pagina si aggiorna automaticamente circa ogni 5 secondi quando la scheda browser è visibile.

## Modificare un ticket aperto

**Percorso:** ticket **Aperto** → icona **Modifica** (titolo **Modifica**).

**Compilazione:** form **Modifica ticket** con **Oggetto** e **Messaggio iniziale**.

**Azione:** **Salva** o **Annulla**.

## Eliminare un ticket

**Percorso:** icona **Elimina** (titolo **Elimina**) sul ticket.

**Azione:** conferma nel dialog di sistema (*Eliminare definitivamente il ticket «…»? L'operazione non è annullabile.*).

**Conferma:** ticket rimosso dall'elenco.

## Stato vuoto

Se non ci sono ticket: messaggio **Nessun ticket ancora inviato**.
