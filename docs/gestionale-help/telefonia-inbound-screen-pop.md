# Popup chiamata in entrata (screen pop)

## Cosa compare

**Scopo:** mostrare dati utili quando arriva una chiamata da un numero collegato a una pratica.

**Chi lo vede:** solo utenti con ruolo **Operatore** o **Supervisor** (altri ruoli non ricevono il popup né possono usare il lookup inbound).

**Posizione:** in **alto a destra** dell'app. Ogni chiamata inbound apre un popup dedicato; se arrivano più chiamate insieme, i popup sono **impilati uno sotto l'altro** (dall'alto verso il basso). Ogni popup si chiude con la X senza influire sulle altre chiamate.

**Contenuto (se il numero è trovato):**

- Numero chiamante
- **Cliente** (debitore)
- **Mandato** (codice e ragione sociale)
- **Stato operativo** (es. In lavorazione, Nuova, Scaduta; indica se la pratica è in lavorazione o meno)
- **Debito residuo** e **Netto da pagare** (come in scheda pratica)
- Pulsante **Apri** (numero pratica) nell’**intestazione**: se la scheda operatore non è disponibile (es. stragiudiziale scaduta, sezione legale), al posto del 404 si apre una pagina con **Fase attuale** e il messaggio esplicativo al centro

Se più pratiche condividono lo stesso recapito, compaiono tab con i numeri pratica.

Se nessuna pratica è collegata al numero, il messaggio indica che non c’è match su debitore/recapiti.

## Simulazione (sviluppo)

**Percorso:** menu **Telefonia** → sezione **Simulazione chiamata in entrata** (solo ambiente di sviluppo).

**Anteprima demo (dati fittizi):** pulsante **Anteprima demo** nella stessa sezione, oppure in basso a destra **Demo popup inbound** (visibile solo in sviluppo), oppure URL `?demoInboundPop=1` (opzionale `&numero=3321000274`). Non apre una pratica reale.

**Lookup reale:** inserire un numero presente su debitore o recapiti e premere **Lookup reale**.

**Alternativa URL:** `simulateInbound=NUMERO` (es. `?simulateInbound=3331234567`); il valore viene conservato in sessione se si passa dal login.

## Postazioni e “squilla solo su alcune postazioni”

**Oggi nel gestionale:** la **postazione** (login, interno, numero fisso) **non** filtra il popup. Non esiste ancora una tabella “numero inbound → postazioni ammesse”. Il watcher è montato su **ogni** sessione **Operatore/Supervisor** loggata: il popup compare solo se **quel browser** riceve l’evento `gestionale:inbound-call-screen-pop` (simulazione, demo, o integrazione futura sul PC dell’operatore).

**Centralino reale (CounterPath oggi):** il provider telefonia **non** invia eventi di chiamata in entrata al browser (`onCallEvent` è ancora vuoto). Chi squilla è deciso dal **PBX** (coda, interno, skill); il gestionale non lo replica.

**Comportamento atteso quando l’integrazione sarà attiva:** il popup deve comparire **solo** sulla postazione/estensione che sta effettivamente squillando (evento dal softphone su quel PC, oppure notifica server filtrata per `interno` / `postazioneId` della sessione). Se si inviasse lo stesso evento a tutti gli operatori del tenant, vedrebbero il popup anche **senza** squillo — da evitare.

## Due modelli aziendali (routing + ambito dati)

### Modello A — Numeri dedicati per gruppo/mandato (consigliato)

Molte aziende organizzate usano **numeri inbound diversi** (DID) per i gruppi che gestiscono mandati diversi. Il **centralino** instrada ogni DID verso le **code / interni / postazioni** previste: solo chi deve squillare riceve la chiamata.

In questo modello:

1. **Chi squilla** = regola PBX (numero chiamato → coda → postazioni). Il gestionale emette il popup **solo sul browser della postazione che squilla** (evento dal softphone su quel PC).
2. **Cosa mostrare** = lookup sul **numero del chiamante** (CLI), con filtro di sicurezza lato server sull’**ambito del gruppo** (mandati/perimetri del supervisor di riferimento). Il **numero chiamato** (DID), se disponibile dall’integrazione, può restringere ulteriormente i match al mandato collegato a quel DID (configurazione futura DID → gruppo/mandato).

Il gestionale **non** replica il routing del centralino: si affida al PBX per la consegna. L’API `inbound-lookup` applica l’**ambito gruppo/mandati** (`inboundScreenPopScopeWhere`): con perimetri configurati sul supervisor del gruppo, operatore e supervisor vedono solo pratiche di quei mandati/perimetri; altrimenti vale il portafoglio abituale (`praticaWhere`).

**Supervisor:** popup solo se la chiamata arriva alla loro sessione (squillo reale) e i match passano l’ambito **del loro gruppo** (mandati/perimetri configurati sul supervisor).

**Operatore:** stesso squillo/postazione; match limitati ai **mandati/perimetri del gruppo** (non l’intero tenant).

### Modello B — Un solo numero (o routing non per gruppo)

Se l’azienda **non** separa i numeri per gruppo e molte postazioni squillano sullo stesso inbound, il PBX da solo **non** distingue i mandati. In questo caso il gestionale fa da filtro principale:

- Popup **solo** sulla postazione che squilla (sempre).
- Lookup con ambito obbligatorio: **supervisor** = pratiche del proprio gruppo; **operatore** = mandati/perimetri del gruppo (non tutto il tenant).

Senza numeri dedicati, è normale che due gruppi non vedano popup su pratiche di altri mandati anche se condividessero lo stesso centralino.

### Integrazione centralino (contratto stabile)

Evento client (es. `gestionale:inbound-call-screen-pop`):

- **Obbligatorio:** `numero` = CLI (chiamante).
- **Opzionale:** `numeroChiamato` / DID, `callId` (più chiamate in parallelo).

L’API `GET /api/telephony/inbound-lookup` usa la **sessione** dell’utente loggato e applica l’ambito gruppo/mandati (modello A come rete di sicurezza, modello B come filtro principale). Stesso endpoint per simulazione, softphone e webhook futuri: nessuna logica duplicata nel PBX oltre al routing delle chiamate.
