# Affidi — monitoraggio e assegnazioni

## Accesso

**Percorso:** menu **Affidi**.

**Chi vede la pagina:** ruoli **ADMIN**, **SUPERVISOR** e **BACK_OFFICE** (modulo e permessi di navigazione). Altri profili: **Accesso non disponibile per questo profilo.**

Supervisor e back office vedono la **stessa interfaccia dell’admin**: monitoraggio con card **Allerte**, filtri carico/incassi, **Pratiche per operatore**, **Affida / riaffida pratiche** su tutto il tenant.

## Gruppo di lavoro

La gestione del gruppo (operatori, mandanti e perimetri del team) è in **Home** (**Crea nuovo gruppo** / **Gestisci gruppo** per il supervisor), non in Affidi. In **Home**, il **supervisor** (come il back office) può scegliere il **Gruppo** da monitorare se nel tenant ci sono più supervisor: di default vede il proprio; con **Mostra** e il parametro `gruppo` in URL aggiorna KPI e sintesi sul team selezionato. **Gestisci gruppo** modifica il gruppo attualmente selezionato nel filtro (nome, operatori, mandanti e perimetri), non solo il proprio; **Crea nuovo gruppo** resta disponibile solo sul proprio profilo supervisor. Nella sezione **Altri gruppi di lavoro** del modale, **Apri in Home e gestisci** imposta lo stesso filtro `gruppo` in Home. Per ogni mandante il supervisor deve selezionare **almeno un perimetro** (commessa); senza mandante e perimetro salvati con **Salva mandanti** il gruppo non è configurato per gli affidi.

## Allerte (in cima alla pagina)

**Supervisor** e **admin**: tre card (**Da affidare**, **In lavorazione**, **In scadenza 7 gg**).

**Back office**: le stesse tre card più **In fase giudiziale** (attività giudiziale sul fascicolo, pratiche su lotto **solo giudiziale**, o stragiudiziale **scaduto** su lotto con fase giudiziale) e **Giudiziali da affidare** (stesso perimetro, senza affidatario).

Le card sono sempre visibili in cima. **Supervisor** e **admin**: i conteggi seguono **mandato** e **perimetro** in URL quando impostati (dopo **Filtra**), altrimenti l’ambito dell’elenco Affidi. **Back office**: di default i numeri sono su **tutto il tenant**; dopo **Filtra** con mandato/perimetro si restringono a quel filtro. Ogni card apre l’elenco **Affida / riaffida** con gli stessi parametri in URL.

Le prime tre card contano solo il **portafoglio stragiudiziale in lavorazione** (stato operativo *In lavorazione*, escluse scadenza stragiudiziale superata e fascicoli giudiziali):

- **Da affidare** = senza affidatario, non scadute stragiudiziali, non in gestione legale (come in Home).
- **In lavorazione** / **In scadenza 7 gg** = affidate in fase stragiudiziale attiva; la scadenza dei 7 giorni è la data mandato.

Le pratiche **scadute stragiudiziali** da affidare in giudiziale (o già in attività giudiziale senza affidatario) compaiono nelle card **Giudiziali da affidare** / **In fase giudiziale**, non nelle prime tre.

## Monitoraggio operativo

1. Scegli **Mandato** e **Perimetro** (opzionale).
2. Premi **Filtra** per caricare l’elenco in **Affida / riaffida** e aggiornare le allerte (back office: restringe i conteggi in cima; supervisor/admin: come già con filtro in URL).

La card **Pratiche per operatore** compare solo con i filtri **carico/incassi** (mese e mandato/perimetro carico), non sotto il monitoraggio operativo.

Dopo **Filtra** (o click su una card **Allerte**), sotto **Monitoraggio operativo**, per **SUPERVISOR** e **BACK_OFFICE** compare il riepilogo **Codici scarico per mandante e perimetro**: tabella per operatore con Affidate, Scadute, In lavorazione e codici PTC/PPC/… I totali usano il **portafoglio del gruppo**, indipendentemente dal mandato/perimetro scelto nei filtri del monitoraggio. Senza **Filtra** la sezione non è visibile.

Senza **Filtra** o click su allerta, **Affida / riaffida pratiche** mostra il messaggio che invita a usare il monitoraggio o le allerte.

## Affida / riaffida

Elenco delle pratiche secondo i filtri del monitoraggio; operatori disponibili: tutti **OPERATOR** e **SUPERVISOR** attivi del tenant.

Su perimetri con conferimento **Stragiudiziale e giudiziale**, dal **giorno dopo** la scadenza stragiudiziale effettiva (data passaggio a giudiziale se impostata, altrimenti scadenza mandato) la pratica **perde l’affidatario** in automatico (nessun operatore assegnato, come un’affida a «nessuno»). L’aggiornamento avviene al primo accesso al gestionale del giorno.

Le tabelle **Affida / riaffida** e **Pratiche per operatore** usano le **stesse colonne** dell’elenco **Pratiche** (da **Debitore** a **Garante**, inclusi importi, date e **Stato** con badge operativo). Clic sull’intestazione di colonna: ordine crescente / decrescente (icona ⇅, ▲ o ▼); l’ordinamento resta nei parametri `affidaSort` e `affidaDir` nell’URL. Scorri orizzontalmente nella tabella per vedere tutte le colonne (barra di scorrimento in basso).

Per il **SUPERVISOR**, nell’elenco **Affida / riaffida** non compaiono le pratiche **scadute** (mandato scaduto o scadenza stragiudiziale già passata, oltre alle già in gestione legale). La card **Da affidare** conta solo le pratiche aperte **senza affidatario** e **non scadute**; restano visibili anche quelle **in lavorazione** non scadute, su qualsiasi mandato. In **Home**, il totale e il dettaglio **Pratiche da affidare** (per perimetro del gruppo) usano la stessa regola: niente scadute né pratiche in gestione legale. In Home, **supervisor** e **back office** (con filtro **Gruppo**) vedono le stesse cinque card KPI: affidate, scadute, in lavorazione, che scadono, da affidare.
