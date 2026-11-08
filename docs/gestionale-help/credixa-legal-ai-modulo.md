# Credixa Legal AI (modulo e accesso)

## Cos’è e come si distingue da Legal

**Credixa Legal AI** è un modulo commerciale separato (id tecnico `legal-ai`), distinto dall’area **Legal** del recupero crediti (modulo `legale`, menu **Legal**, percorso `/legal`).

| | Legal (recupero) | Credixa Legal AI |
|--|------------------|------------------|
| Modulo tenant | `legale` | `legal-ai` |
| Menu | **Legal** | **Credixa Legal AI** |
| Percorso | `/legal` | `/legal-ai` |
| Permesso baseline | `legal:view` | `legal-ai:view` |
| Ruolo tipico | **LEGAL** | **AVVOCATO** |

Il modulo **Legal** del gestionale recupero crediti non cambia con l’introduzione di Credixa Legal AI.

## Attivazione per azienda (Back Office)

**Pacchetti commerciali** (catalogo piattaforma):

- Add-on **Credixa Legal AI** (`legal-ai`) — attiva solo questo modulo (oltre al core).
- **Credixa full** — include anche `legal-ai` insieme alle altre sezioni.

I tenant senza `legal-ai` nella configurazione moduli **non** vedono la voce menu e **non** possono aprire `/legal-ai` (redirect verso **Account**).

Il default storico del recupero crediti **non** accende `legal-ai` automaticamente: serve l’add-on o Credixa full.

## Accesso utente

**Login:** stesso accesso Credixa Suite (nessun secondo sistema di autenticazione).

**Permesso:** `legal-ai:view` — baseline per **ADMIN**, **AMMINISTRAZIONE**, **AVVOCATO**.

**Nota:** il ruolo **LEGAL** (area pratiche/recupero) **non** riceve automaticamente `legal-ai:view`.

**Menu:** voce **Credixa Legal AI** (icona dedicata) se modulo tenant attivo, permesso e visibilità pagina lo consentono.

## Home e tenant solo Legal AI

Se l’azienda **non** ha il modulo recupero crediti (`recovery`) ma ha **legal-ai**, l’apertura di **Home** reindirizza verso `/legal-ai` (prima delle altre sezioni add-on).

**Profilo tenant solo Legal AI** (add-on `legal-ai` senza `recovery`):

- **Menu principale** per gli utenti operativi: solo **Credixa Legal AI** e **Account** (niente Pratiche, Incassi, …).
- **Account riservati al ruolo Avvocato:** in creazione e modifica utente ( **Operatori** ) e negli inviti Platform è ammesso **solo** il ruolo **AVVOCATO**; stessi campi della procedura standard (nome, cognome, email, password, sede, …).
- **Back office / amministrazione** che gestisce il tenant può aprire **Operatori** dal menu amministrazione (modulo core) per creare altri avvocati con la stessa procedura; il ruolo nel form è fissato su **Avvocato**.
- **Invito Platform** (prima attivazione): su tenant solo Legal AI l’invito crea un utente **AVVOCATO** (non Admin recupero crediti).

Sul tenant **Credixa full** (recovery + legal-ai), gli utenti con ruolo **AVVOCATO** vedono comunque solo **Credixa Legal AI** e **Account** nel menu, senza area pratiche.

## Interfaccia — assistente redazione atti

**Percorso principale:** `/legal-ai` (voce menu **Credixa Legal AI**).

**Layout:** resta il menu Credixa (AppShell); sotto l’intestazione compare la **navigazione interna** del modulo (tab), con badge **Modulo Legal AI**.

**Obiettivo del modulo:** assistente professionale per la redazione di atti legali (giudiziari e stragiudiziali). Non include gestione fascicoli, anagrafiche clienti, archivio documentale interno, agenda o impostazioni studio.

**Sezioni** (percorsi verificati nel codice):

| Sezione | Percorso |
|---------|----------|
| Home | `/legal-ai` |
| Nuovo atto | `/legal-ai/nuovo-atto` |
| Redazione | `/legal-ai/redazione` |
| Ricerca | `/legal-ai/ricerca` |
| Revisione | `/legal-ai/revisione` |
| Esportazione | `/legal-ai/esportazione` |

**Home (`/legal-ai`):** titolo e descrizione del modulo, pulsante **Avvia nuova redazione** (verso **Nuovo atto**). Le sezioni del flusso si raggiungono solo dal **menu tab** sotto l’intestazione Credixa (Home, Nuovo atto, Redazione, …).

**Nuovo atto:** griglia di tipologie di atto (giudiziario/stragiudiziale); la scelta resta nel **browser di questo PC** (localStorage, per utente e tenant).

**Redazione:** questionario compilabile; **Genera bozza**; **Archivia bozza** aggiunge una copia all’archivio locale. Il lavoro in corso si aggiorna automaticamente nel browser.

**Archivio locale:** elenco in **Revisione** e **Esportazione** — bozze salvate solo su questo dispositivo (**Apri**, **Elimina**; in Esportazione anche **Word** / **PDF** per ogni voce). Non visibile ad altri PC né sui server Credixa.

**Nuova redazione** (banner): azzera solo il **lavoro in corso**; l’archivio locale resta.

**Redazione:** questionario (**Oggetto**, **Sintesi dei fatti**, **Richieste**) compilabile; pulsante **Genera bozza** (motore locale sostituibile con API); area bozza modificabile. Sezione **Carica documento da file**: **Scegli file** (.txt, .md, .html, .rtf, .docx, max 1,5 MB) — il testo entra nella bozza solo nel browser; **Anteprima per l'AI**; campo istruzione e **Modifica con AI** (motore locale sostituibile). Senza tipologia atto si può comunque caricare un file e proseguire in **Revisione**.

**Revisione:** testo da bozza modificabile; pulsante **Analizza bozza** con suggerimenti in elenco (motore sostituibile). Stessa sezione **Ricarica file e modifica con AI** (caricamento, anteprima, **Modifica con AI**).

**Ricerca:** campo query e pulsante **Esegui ricerca**; risultati segnaposto in sessione fino al provider giuridico esterno.

**Esportazione:** pulsanti **Esporta Word (.doc)** e **Esporta PDF** attivi se c’è testo in bozza; download solo sul computer dell’utente.

**Banner «Redazione in corso»:** compare solo se c’è lavoro in corso (tipologia, bozza o file caricato); **Nuova redazione** azzera la sessione locale.

**Navigazione tra passi:** usa i tab in alto (Home, Nuovo atto, Redazione, …).

**Accesso:** invariato (`requireLegalAiPageAccess`: modulo `legal-ai`, permesso `legal-ai:view`, visibilità pagina **legalAi**).

## Ruolo Avvocato

In **Operatori**, gli amministratori (**ADMIN**, **AMMINISTRAZIONE**) possono creare utenti con ruolo **Avvocato** (**AVVOCATO**), visibile nelle etichette ruolo e nella matrice **Default pagine per ruolo** (pagina **legalAi** / **Credixa Legal AI**).
