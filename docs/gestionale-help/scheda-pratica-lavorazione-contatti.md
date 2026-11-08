# Scheda pratica e lavorazione contatti

## Aprire la scheda pratica

**Scopo:** consultare anagrafica, importi, registro note e strumenti operativi su una singola pratica.

**Percorso:** menu **Pratiche** → imposta filtri e **Filtra** → clic sul link **Numero** in elenco (vedi capitolo Pratiche: filtri).

**Conferma:** URL `/pratiche/[id]` con intestazione debitore, sezioni **Anagrafica debitore**, **Registro note e lavorazioni** e barra funzioni (tasti F1–F12 e strumenti).

**Permessi e limiti:** accesso alla pratica soggetto a `canAccessPratica` (ambito tenant/gruppo). Modifica note e contatti richiede possesso del lock pratica (`canWork`); altrimenti banner **Pratica bloccata — in lavorazione da [nome]. Puoi solo consultare in lettura.**

## Navigare tra le pratiche in coda

**Scopo:** passare alla pratica successiva/precedente mantenendo i filtri dell’elenco.

**Percorso:** in fondo alla scheda, barra paginazione.

**Azioni (etichette verificate):** **Pratica precedente**, **Pratica successiva**, **Prima pratica**, **Ultima pratica** (se elenco collegate: **Pratica intestata precedente** / **successiva**, ecc.).

**Conferma:** cambio pratica nella stessa coda URL.

**Link utile:** **Elenco** (freccia indietro) torna all’elenco **Pratiche** con i filtri della coda.

## Modali (popup) in scheda e in gestionale

**Spostamento:** tutte le finestre modali con barra del titolo (F1, F5, incasso, filtri, ecc.) si **trascinano** tenendo premuto il titolo (cursore a mano); **X** o **Esc** chiudono; click sull’area scura esterna chiude (dove previsto).

## Barra funzioni (tasti rapidi)

**Percorso:** fascia grigia sotto i dati mandante, etichetta accessibilità implicita dai tooltip.

| Controllo | Tooltip / titolo modale |
|-----------|-------------------------|
| **F1** | Ricerca pratica → modale **F1 · Ricerca pratica** |
| **F2** | Agenda |
| **F12** | Messaggi |
| **F5** / **NT** | Nota registro / esito → **F5 · Nota registro / esito** |
| **F6** | Fatture insolute → `/pratiche/[id]/fatture` |
| **F7** | Estratto conto → `/pratiche/[id]/estratto` |
| **F8** | Incassi registrati → `/pratiche/[id]/incassi` |
| **F9** | In lavorazione e nuove (stessa mandante) |
| **F10** | Altre collegate (altre mandanti, scadute, chiuse) |
| **F11** | Stampa pratica → `/pratiche/[id]/stampa` |
| **Esc** | Anagrafica (solo se sei su sotto-pagina contabile F6–F8) |

**Strumenti (pulsanti testo):** **Piano di rientro**, **Saldo a stralcio**, **Calcolatrice**; opzionale **Avvia giudiziale** o stato **Giudiziale avviato**; **Inserisci/modifica incasso** (vedi capitolo Incassi).

**Permessi:** con pratica bloccata o senza `canEditNotes`, i tasti F2, F5, F12, piano di rientro e registrazione chiamata sono disabilitati (`azioniBloccate`).

## Inviare messaggi ai colleghi (F12)

**Scopo:** inviare un messaggio interno a un collega o a un gruppo, eventualmente collegato alla pratica aperta.

**Percorso:** scheda pratica → tasto **F12** (tooltip **Messaggi**).

**Modale:** **F12 · Messaggi** — intestazione form **Messaggio al collega**.

**Destinatario:**

1. Opzionale: **Solo operatori**, **Solo back office** o **Elenco aziendale** (o **Chiudi elenco**).
2. Campo **Cerca per nome…** e selezione collega, oppure voce **TUTTI** + gruppo (es. *Tutti gli operatori*).

**Collegamento pratica (se aperta da scheda):** radio **Collegata alla pratica** o **Messaggio indipendente**.

**Compilazione:** campo **Testo del messaggio**.

**Azione:** pulsante **Invia**, **Invia a tutti**, **Invia agli operatori** o **Invia al back office** (etichetta dipende dal destinatario).

**Conferma:** messaggio *Messaggio inviato a [destinatario]*.

**Permessi:** richiede pratica non bloccata e `canEditNotes` (come gli altri tasti F2/F12 nella barra).

## Registrare nota e codice scarico operatore (F5)

<!-- assistenza-acl: f5_operatore -->

**Scopo:** annotare la lavorazione e aggiornare il **codice scarico operatore**.

**Percorso:** scheda pratica → tasto **F5** (o **NT**) oppure clic sul riepilogo in basso (**Cod. scarico:** … · tooltip **Apri F5 nota / esito**) oppure tasto **F5** da tastiera.

**Modale:** **F5 · Nota registro / esito**.

**Compilazione:**

1. **Inserisci nota** (area testo; placeholder operativo in UI).
2. Sezione **Codice scarico**: tendina **Codice scarico**; per codici con dettagli pagamento: **Data promessa** (obbligatoria), **Importo da pagare**, **Modalità di pagamento**.
3. Se esistono altre pratiche collegate aperte (stesso debitore e stessa mandante, come in **F9**), compare la spunta opzionale **Aggiorna anche le pratiche collegate dello stesso debitore**; altrimenti non è visibile.

**Azione:** **Salva** (in attesa **Salvataggio…**). **Annulla** chiude senza salvare.

**Conferma:** nuova riga in **Registro note e lavorazioni**; codice aggiornato nel riepilogo in basso.

**Permessi:** richiede pratica non bloccata e permessi di modifica note (`canEditNotes`).

## Codice bk off e svuotamento codici da F5

<!-- assistenza-acl: codice_scarico_bk -->

**Scopo:** compilare o svuotare **Cod. bk off** e, se consentito, azzerare i codici scarico dalla modale F5.

**Percorso:** scheda pratica → **F5 · Nota registro / esito** → sezione **Codice scarico**.

**Campi aggiuntivi (se abilitati al tuo ruolo):** tendina **Cod. bk off**; opzione **—** per svuotare codici quando la policy lo consente.

**Permessi:** non disponibile per **OPERATOR** e **SUPERVISOR** (`canEditCodiceScaricoBk`, `canClearCodiceScarico` in Credixa). Lista codici dipende dal perimetro mandante.

**Nota:** sulla scheda principale il selettore **Cod. scarico** con **Applica stato** (`StatoPraticaBar`) è disattivato (`canEditStato={false}`).

## Contattare il debitore (telefono, email, SMS)

**Percorso:** sezione **Anagrafica debitore** → recapiti in **AnagraficaRecapiti**.

**Telefono (se `canEditNotes`):**

- **Doppio clic** sul numero: avvia chiamata e sessione (**Chiamata [numero]** in barra funzioni).
- **Tasto destro** sul numero: menu SMS (testi preimpostati mandante, non elencati qui).

**Email:** **Clic** sul recapito email → apertura client mail (registrazione azione lato app).

**Conferma chiamata (barra verde sotto strumenti):**

- Checkbox **BK OFF** (evidenza back office).
- Modalità manuale: **Conferma REC** (messaggio **Registrazione confermata**), **Termina** senza registrare.
- Altra modalità: **Termina e registra**.

**Permessi:** registrazione telefonata solo se pratica non bloccata e `canEditNotes`; richiede interno configurato per OPERATOR (`richiedeInternoPerChiamata`).

## Registro note (consultazione)

**Percorso:** metà inferiore scheda, titolo **Registro note e lavorazioni**.

**Contenuto:** note fissate in evidenza; elenco scrollabile; messaggio **Nessuna nota registrata.** se vuoto.

**Modifica note esistenti:** non documentata in questo capitolo (componente `NotaRiga` con **Salva modifiche** per utenti con permesso edit/sblocco).

**Sblocco note:** ruoli ADMIN, SUPERVISOR, BACK_OFFICE, AMMINISTRAZIONE, LEGAL hanno flag `canSblocca` nel registro.
