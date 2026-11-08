# Postazioni: configurazione e assegnazione

## Gestire le postazioni (amministratori)

<!-- assistenza-acl: operatori_manage -->

**Scopo:** creare postazioni fisiche/logiche usate al login e in sessione.

**Percorso:** menu amministrazione → **Postazioni**.

**Intestazione:** **Postazioni** — *Crea e gestisci le postazioni disponibili al login degli operatori*.

**Permessi:** `operatori:manage` (stesso accesso di **Operatori** / **Postazioni** in baseline).

**Azione in testata:** **Crea nuova postazione**.

## Creare una nuova postazione (amministrazione)

**Scopo:** aggiungere una postazione al tenant per il login operatori.

**Percorso:** menu **Postazioni** → pulsante **Crea nuova postazione**.

**Modale:** **Nuova postazione**.

**Compilazione:** **Nome / Codice *** , **Sede *** (**Seleziona sede…**); opzionali **Interno**, **Email postazione**, **Numero fisso**, **Fax**, **WhatsApp**, **Note**.

**Azione:** **Crea postazione** (attesa **Salvataggio…**).

**Conferma:** nuova riga in tabella con occupante **Libera**.

### Filtrare l’elenco

**Campo:** **Filtra sede** (tutte le sedi o una sede).

**Azione:** **Applica**.

**Tabella colonne:** Postazione, Interno, Email, Numero fisso, Fax, WhatsApp, Note, Sede, Occupante, Stato, azioni (le **Note** compaiono come **—** se vuote; in modifica inline si possono aggiungere o cambiare).

### Creare una postazione

**Percorso:** **Crea nuova postazione**.

**Modale:** **Nuova postazione**.

**Campi obbligatori:** **Nome / Codice *** , **Sede *** (tendina **Seleziona sede…**).

**Campi opzionali:** **Interno**, **Email postazione**, **Numero fisso**, **Fax**, **WhatsApp**, **Note**.

**Azione:** **Crea postazione** (**Salvataggio…**). **Annulla** chiude.

**Conferma:** riga in tabella; occupante inizialmente **Libera**.

**Problema:** se nessuna sede attiva — messaggio *Crea prima almeno una sede attiva.*

### Modificare, attivare/disattivare, eliminare

**Modifica:** icona matita sulla riga → campi editabili inline (inclusi **Note**) → **Salva** (icona check) o **X** annulla.

**Stato:** pulsante **Attiva** / **Disattivata** (toggle).

**Elimina:** icona cestino → conferma *Eliminare la postazione "[nome]"?*

**Occupante:** badge **Tu** o nome operatore se postazione in uso.

## Assegnazione al login

**Scopo:** legare la sessione a una postazione libera.

**Percorso:** dopo login, pagina **Seleziona la tua postazione** (vedi capitolo Accesso).

**Azione:** selezione card postazione → **Conferma postazione**; opzionale **Usa sempre questa postazione** per ruoli abilitati.

**Permessi:** dipende da policy postazione per ruolo; amministratori possono **Entra comunque senza postazione** in casi limite (vedi Accesso).

## Cambiare postazione da Account

**Scopo:** aggiornare postazione di sessione (o fissarla) senza passare da **Postazioni** admin — **non** per operatore/supervisore (solo al login).

**Percorso:** menu **Account** → card **Postazione** (ruoli amministrativi con tendina; operatore/supervisore vedono solo i dati in lettura).

**Campi:** tendina **Postazione** (**Seleziona postazione**; opzioni occupate disabilitate salvo postazione corrente).

**Opzionale:** checkbox **Usa sempre questa postazione** (ruoli ADMIN, BACK_OFFICE, AMMINISTRAZIONE).

**Azione:** **Salva postazione** (**Salvo…**).

**Conferma:** messaggio **Postazione aggiornata**.

**Testo guida:** *La postazione determina interno e email associati alla tua sessione di lavoro.*

## Collegamento con Operatori

**Consultazione:** in **Gestione operatori**, colonne **Postazione** e **Interno** mostrano lo stato corrente (sola lettura in tabella).

**Assegnazione operativa:** operatore/supervisore al login (**Conferma postazione**); altri ruoli anche da **Account** (**Salva postazione**). La sede si modifica solo in questa pagina admin.
