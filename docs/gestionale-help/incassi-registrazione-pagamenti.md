# Incassi e registrazione pagamenti

## Elenco incassi (menu Incassi)

**Scopo:** consultare gli incassi registrati nel tenant con filtri.

**Percorso:** menu **Incassi** (modulo **incassi** attivo; permesso `incassi:list`).

**Intestazione:** **Incassi** — prima del filtro: **Imposta i filtri e clicca Filtra per vedere l'elenco**.

**Filtro veloce (barra):** campi tra cui **Mandato**, **Mese**, **Operatore**, **Verificato / provv.** → pulsante **Filtra**; **Tutti i filtri** apre modale **Tutti i filtri · Incassi** con **Applica filtri**; **Annulla filtri** se attivi.

**Conferma:** card **Elenco incassi** con tabella (colonne: Data, Pratica, Cliente, Mandato, …, Importo, …). Link sul numero pratica apre `/pratiche/[id]`.

**Messaggio se nessun filtro:** *Nessun elenco caricato. Scegli mandato, mese o altri filtri e premi **Filtra**.*

## Registrare incasso da scheda pratica (popup)

**Scopo:** registrare un pagamento o un piano effetti senza uscire dalla pratica.

**Percorso:** scheda pratica → pulsante **Inserisci/modifica incasso** (barra strumenti).

**Permessi:** pulsante visibile solo se `canShowIncassoPopup` — **non** per ruoli **OPERATOR** e **SUPERVISOR** (anche se altri permessi incasso). Richiede lock pratica (`canWork`) per altre azioni correlate; il popup segue la visibilità ruolo.

**Modale:** **Inserisci/modifica incasso / piano effetti**.

**Fatture insolute:** in cima alla modale, prima di **Incassi registrati** (se presente), specchietto **Fatture insolute** (solo lettura).

**Modificare incassi già registrati (nello stesso popup):** se hai permesso `incassi:update` e lock pratica, compare la tabella **Incassi registrati** con **Modifica** / **Elimina** e form **Salva modifiche** (stesso comportamento di F8 e anteprima contabile). Chi può solo registrare non vede questa sezione. Colonna **Registrato da**: utente che ha inserito o salvato la riga (non l’operatore con la pratica in affido; le provvigioni seguono il titolare/assegnatario come in fondo al capitolo).

### Tab Incasso singolo

**Selettore tab:** **Incasso singolo** (default).

**Campi:**

- **Importo totale pagato** (obbligatorio)
- **Metodo** (tendina da `METODI_INCASSO`)
- **Data**
- **Esito** (provvigioni; avviso *Non conteggiato nelle provvigioni* su alcune opzioni)
- **Fattura insoluta** (— Seleziona fattura — / nessuna)
- **Causale**
- Sezione **Riparto incasso**: Capitale, Mora, Spese, Spese di recupero — pulsante **Ricalcola automatico** (ordine: capitale, poi mora, poi spese, poi spese di recupero sui residui)

**Azioni:** **Annulla**, **Registra** (in attesa **Registrazione…**).

**Conferma:** incasso salvato; chiusura modale; aggiornamento pagina.

### Tab Piano cambiali / assegni

**Selettore tab:** **Piano cambiali / assegni**.

**Campi principali:** **Numero effetti**, importi/metodo effetti (cambiali/assegni), testo guida sul piano in UI.

**Azione:** **Registra [N] effetti** (o **Registrazione piano…**).

**Permessi creazione:** permesso `incassi:create` — ruoli **ADMIN**, **BACK_OFFICE**, **AMMINISTRAZIONE** (mappa permessi).

## Registrare incasso da F8 (pagina Incassi registrati)

**Scopo:** alternativa full-page con elenco incassi della pratica.

**Percorso:** scheda pratica → tasto **F8** (**Incassi registrati**) → `/pratiche/[id]/incassi`.

**Se autorizzato** (`canWork` e `incassi:create`): form in fondo con campi **Importo**, tendine **Metodo** ed **Esito**, date, **Fattura insoluta…**, **Causale**, pulsante **Registra incasso**.

**Se non autorizzato:** messaggio *Solo back office e admin possono registrare gli incassi.*

## Modificare o eliminare un incasso registrato

<!-- assistenza-acl: incasso_update -->

**Scopo:** correggere o rimuovere un incasso già salvato su una pratica.

**Permessi:** `incassi:update` — ruoli **ADMIN** e **AMMINISTRAZIONE**; richiede lock pratica (`canWork`) come per la registrazione.

**Percorso:** scheda pratica → **F8** (**Incassi registrati**) oppure popup **Inserisci/modifica incasso**; sezione tabella **Incassi registrati**. L’anteprima contabile sulla scheda (tab **Incassi registrati**) è solo consultazione.

**Modificare:**

1. Colonna **Azioni** → pulsante **Modifica** sulla riga.
2. Compila i campi del form (importo, **Metodo**, **Esito**, date, **Fattura insoluta…**, **Causale**).
3. Pulsante **Salva modifiche** (attesa **Salvataggio…**).
4. Per uscire senza salvare: **Chiudi** sulla stessa riga.

**Eliminare:**

1. Colonna **Azioni** → **Elimina**.
2. Conferma nel dialog *Eliminare questo incasso registrato?*

**Conferma:** tabella aggiornata; totale in fondo ricalcolato.

**Nota:** gli operatori e il supervisor non vedono **Modifica** / **Elimina** (`canShowIncassoPopup` e `canEditIncassiRegistrati`).

## Provvigioni e incassato operatore

Alla **registrazione** o **salvataggio** di un incasso il gestionale crea (o rigenera) la riga in **Provvigioni** con operatore creditato così:

- **Titolare principale** della pratica (`operatoreTitolareId`, oppure `assegnatarioId` se non c’è affido temporaneo): riceve provvigione e incassato anche se l’incasso è registrato da un altro utente o da un operatore in **affido temporaneo** sulla pratica.
- **Affido definitivo** a un altro operatore: il nuovo titolare vale per gli incassi registrati da quel momento (e per le righe rigenerate in modifica incasso).
- **Pratica senza titolare/assegnatario:** la provvigione va all’**operatore** o **supervisor** che registra l’incasso (sessione corrente). Registrazioni da **admin** / **amministrazione** / **back office** senza titolare sulla pratica **non** generano provvigione finché la pratica non è affidata.

L’**incassato mese** in Affidi/Provvigioni segue lo stesso operatore della riga provvigione, non il solo campo audit `UserId` quando il titolare è valorizzato.

**Esito incasso:** solo **ve — Verificato** genera importo provvigione; **np — Non provvigioneabile** ha provvigione e % a zero (resta visibile in elenco come «Non provv.»). Totali mese e provvigioni perimetro escludono gli importi **np**.

## Riepilogo permessi incasso

| Azione | Chi (verificato in codice) |
|--------|----------------------------|
| Vedere menu **Incassi** | `incassi:list` + modulo incassi |
| Popup **Inserisci/modifica incasso** | Ruolo ≠ OPERATOR e ≠ SUPERVISOR |
| Creare incasso | `incassi:create` (ADMIN, BACK_OFFICE, AMMINISTRAZIONE) + lock pratica dove richiesto |
| Modificare/eliminare incassi registrati | `incassi:update` (ADMIN, AMMINISTRAZIONE) |
