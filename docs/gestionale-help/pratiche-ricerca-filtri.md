# Pratiche: filtri, elenco e apertura

## Aprire la sezione Pratiche

**Scopo:** cercare e consultare le pratiche del tenant (o del proprio ambito).

**Percorso:** menu laterale → **Pratiche**.

**Intestazione pagina:** titolo **Pratiche**. Sottotitolo iniziale: **Imposta i filtri e clicca Filtra per vedere l'elenco** finché non è attivo un elenco filtrato.

**Permessi e limiti:** richiede modulo **recovery** e voce menu visibile; non disponibile per account **solo formazione**. Gli operatori non vedono il filtro stato **In lavorazione / Nuove / Tutti** nella barra veloce (comportamento dedicato al ruolo OPERATOR).

## Filtro veloce

**Scopo:** impostare i criteri principali senza aprire il modale completo.

**Percorso:** menu **Pratiche** → sezione etichettata **Filtro veloce** (sopra la barra campi).

**Campi principali (barra veloce):**

- **Cerca anagrafica…** (campo testo `q`)
- **Stato operativo** (tendina; opzioni documentate: **— Seleziona —**, **In lavorazione**, **Nuove**, **Tutti** — nascosta per OPERATOR salvo ricerca anagrafica)
- **Perimetro**
- **Cod. operatore**
- **Cod. scarico**
- **Cod. bk off**
- Intervallo date **Dal** / **al** (lavorazioni) e tendina fascia oraria con prima opzione **Tutta la giornata**

**Azione:** pulsante **Filtra** (invio del form GET verso `/pratiche`).

**Conferma:** la pagina si ricarica con i parametri in URL; se i filtri sono validi compare l'elenco tabellare; il sottotitolo mostra il conteggio risultati.

**Riepilogo codici scarico:** tra **Filtri attivi** e la tabella, per tutti i ruoli con accesso a Pratiche (supervisor, admin, back office, legal, amministrazione, operatore), quando l'elenco è caricato e non è attiva la ricerca anagrafica. Per **supervisor** e ruoli con visione ampia compare dopo **Filtra** con **Cod. operatore** impostato; per **operatore** compare su ogni elenco filtrato (portafoglio personale, senza obbligo di selezionare il proprio codice). Badge per codice (es. **DRI**, **LPT**) con conteggio; eventuali **Senza codice**; a destra il totale pratiche del filtro. Se il risultato è vuoto il blocco resta visibile con messaggio esplicativo.

**Comportamento verificato:** se compili **Cerca anagrafica…** e invii, lo stato viene forzato a **Tutti** e il filtro operatore viene azzerato (logica client sul submit del filtro veloce).

## Tutti i filtri (modale)

**Scopo:** usare filtri anagrafici, contabili e codici aggiuntivi.

**Percorso:** menu **Pratiche** → pulsante **Tutti i filtri** (icona cursori).

**Intestazione modale:** **Tutti i filtri**.

**Sezioni nel modale (titoli verificati):**

- **Filtri anagrafica** (campi es. **Debitore**, **Città**, **Prov.**, **Telefono**, **CAP da / a**, …)
- Altre sezioni per filtri contabili e codici (stessa modale)

**Azione:** pulsante **Applica filtri** in fondo al modale.

**Conferma:** chiusura modale e elenco aggiornato su `/pratiche`.

## Annullare i filtri

**Percorso:** menu **Pratiche**, visibile solo se ci sono filtri attivi.

**Azione:** link **Annulla filtri**.

**Conferma:** navigazione a `/pratiche` senza parametri di filtro.

## Aprire una pratica dall'elenco

**Scopo:** entrare nel dettaglio operativo di una posizione.

**Percorso:** menu **Pratiche** → dopo **Filtra** (o filtri equivalenti) → tabella risultati.

**Azione:** clic sul valore nella colonna **Pratica n.** (link sottolineato). Le colonne **Debitore** e **Pratica n.** restano visibili scorrendo la tabella orizzontalmente.

**Ordinamento elenco:** intestazioni con freccia (es. **Ultima lavorazione**, **Ora lav.** subito dopo) — clic per alternare ordine crescente e decrescente; **Ora lav.** mostra solo l’orario dell’ultima lavorazione registrata sulla pratica.

**Conferma:** apertura della scheda pratica (URL sotto `/pratiche/` con eventuale coda di navigazione). Per lavorazione, note F5 e contatti vedi capitolo **Scheda pratica e lavorazione contatti**.

## Apri pratiche (coda)

**Scopo:** aprire in sequenza le pratiche che corrispondono ai filtri correnti (quando l'azione è disponibile).

**Percorso:** menu **Pratiche** → stessa barra dei filtri, a destra.

**Azione:** pulsante/link **Apri pratiche** (visibile solo quando il sistema calcola un href valido per la coda).

**Conferma:** navigazione alla prima pratica della coda secondo i filtri attivi.

**Permessi e limiti:** la visibilità del pulsante dipende dai filtri e dal contesto utente; se non compare, la documentazione non garantisce una procedura alternativa automatica.

## Filtri speciali da home o link diretti

**Scopo:** riconoscere elenchi pre-filtrati.

**Indicatori in pagina Pratiche:**

- Banner giallo con testo su scadenza stragiudiziale e link **Torna all'elenco completo**.
- Banner azzurro su **attività giudiziale** e link **Torna all'elenco completo**.

**Azione:** link **Torna all'elenco completo** → `/pratiche` senza quel filtro speciale.
