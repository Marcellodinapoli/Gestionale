# Account e profilo utente

## Aprire la pagina Account

**Scopo:** consultare e aggiornare dati del proprio utente (email, interno, postazione, password).

**Percorso:** menu laterale → **Account** (sempre visibile se autenticati).

**Permessi e limiti:** ogni utente per il proprio profilo; alcune card (es. postazione) compaiono solo se il ruolo richiede o consente la gestione postazione. **Formazione** e **Strumenti AI** si aprono dal menu in alto, non da pulsanti in questa pagina.

## Cambiare password da Account

**Scopo:** aggiornare la password senza scadenza forzata.

**Percorso:** **Account** → sezione con form **Cambio password** (stessi campi della pagina dedicata).

**Azione:** pulsante **Cambia password** — vedi capitolo **Accesso a Credixa Suite**, sezione cambio password.

**Conferma:** messaggio **Password aggiornata** o errore in pagina.

## Postazione da Account

**Scopo:** consultare la postazione di sessione; cambiarla da Account solo per ruoli amministrativi (non operatore/supervisore).

**Percorso:** **Account** → card **Postazione**.

**Operatore e supervisore:** card **Postazione** con tutti i **Dati postazione** in sola lettura (nome, **sede**, interno, email, numeri, note); **nessuna tendina** per cambiare postazione. Per cambiare postazione: schermata **Seleziona la tua postazione** al login.

**Altri ruoli** (con `gestiscePostazione`): tendina **Postazione** → **Salva postazione**; opzionale **Usa sempre questa postazione**.

**Dati mostrati:** tutti i campi configurati in Gestione → Postazioni (nome, sede, interno, email, numero fisso, fax, WhatsApp, note). La **sede** e l’anagrafica postazione si modificano solo in **Gestione → Postazioni** (`operatori:manage`).

**Dettaglio completo:** capitolo **Postazioni: configurazione e assegnazione**.

**Se al login:** **Seleziona la tua postazione** — capitolo Accesso.

## CredixaApp — collegamento da Account

**Scopo:** associare l’app mobile CredixaApp al proprio utente gestionale (stesso operatore, stessa azienda).

**Permessi e limiti:** visibile solo se l’utente è **consulente esterno**, ha **Abilita accesso CredixaApp** attivo in anagrafica operatore e il tenant ha il modulo CredixaApp attivo in back office.

**Percorso:** **Account** → sezione **CredixaApp**.

**Stato collegamento:** in pagina compare **App collegata** (con nome azienda) se esiste un collegamento attivo; sotto compare **Collegato il** con data e ora (fuso locale del browser). Altrimenti **Nessun collegamento attivo**.

**Generare il QR:** pulsante **Genera QR collegamento** → modale **Collega CredixaApp** con conto alla rovescia (~10 minuti). Azioni: **Nuovo QR**, **Revoca**. Messaggio **Collegamento completato** quando l’app ha consumato il QR.

**Sull’app:** menu **Aziende** (barra in basso) — ogni azienda collegata mostra **Collegato il** con data e ora locale del telefono. Stesso percorso da **Impostazioni → Collegamenti gestionale** per **Scansiona QR gestionale**. Il QR contiene l’URL del gestionale (`…/creditcalc/pair/{id}`); l’app memorizza l’indirizzo del server e crea il collegamento permanente.

**Dopo il collegamento:** in CredixaApp → **Itinerario → Pratiche in affido** compaiono le pratiche affidate all’operatore, con scheda e funzioni consentite dai permessi CredixaApp (nessun accesso a dati oltre il profilo collegato).

**Sviluppo / rete locale:** non serve un deploy pubblico se il cellulare è sulla **stessa rete Wi‑Fi** del PC. Il QR non deve contenere `localhost`: in assenza di `CREDIXA_BFF_PUBLIC_URL` il server prova a inserire l’IP LAN del PC; in caso di dubbio impostare `CREDIXA_BFF_PUBLIC_URL` o `CREDIXA_BFF_LAN_HOST` (es. `http://192.168.x.x:3100`) e rigenerare il QR. Su Windows consentire il traffico in entrata sulla porta del dev server se il telefono non raggiunge il PC.

**Produzione / fuori sede:** pubblicare il gestionale (es. Netlify) e impostare `CREDIXA_BFF_PUBLIC_URL` con l’URL HTTPS del sito.

**Scollegare:** in **Account** → sezione CredixaApp, pulsante **Scollega CredixaApp** (revoca il collegamento sul server; l’app sul telefono dovrà rifare il pairing con un nuovo QR). In alternativa dall’app: **Aziende → Scollega**.
