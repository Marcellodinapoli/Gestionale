# Navigazione e visibilità del menu

## Struttura del menu laterale (aree operative)

<!-- assistenza-acl: nav_operativo -->

**Scopo:** raggiungere le aree funzionali di Credixa Suite visibili al proprio profilo.

**Percorso:** dopo il login, menu laterale (sidebar) nell'app shell.

**Voci operative (etichette letterali)** — ciascuna compare solo se modulo tenant, permessi del ruolo e visibilità pagina lo consentono:

| Etichetta menu | Area |
|----------------|------|
| Home | Dashboard |
| Pratiche | Elenco e lavorazione pratiche |
| Incassi | Incassi |
| Affidi | Affidi |
| Agenda | Agenda |
| Messaggi | Messaggi |
| Statistiche | Statistiche |
| Provvigioni | Provvigioni |
| Registrazioni | Report registrazioni |
| Rubrica | Rubrica |
| Lavorazione | Coda lavorazione |
| Predictive | Predictive dialer |
| Account | Profilo utente (sempre visibile se loggati) |
| CredixaApp | CredixaApp |
| Formazione | Corsi e formazione |
| Strumenti AI | Strumenti AI collegati a formazione |
| Legal | Area legale (recupero crediti, modulo `legale`) |
| Credixa Legal AI | Modulo autonomo redazione atti (`legal-ai`, percorso `/legal-ai`) |

**Nota:** **Legal** e **Credixa Legal AI** sono moduli distinti; vedi capitolo **Credixa Legal AI (modulo e accesso)**. Un amministratore può modificare i default per ruolo (capitolo **Visibilità pagine**) o eccezioni per singolo operatore; il menu effettivo può differire dalla baseline. Le voci del gruppo **amministrazione** sono descritte nelle sezioni seguenti, ciascuna limitata ai profili con il permesso indicato.

## Statistiche (menu operativo)

<!-- assistenza-acl: nav_statistiche -->

**Permesso baseline:** `statistiche:view` (**ADMIN**, **SUPERVISOR**, **OPERATOR**, **BACK_OFFICE**, **AMMINISTRAZIONE**).

| Etichetta menu | Area |
|----------------|------|
| Statistiche | Statistiche gruppo / tenant |

**Back office:** in pagina le statistiche usano il **gruppo di lavoro** di un supervisor (come in Home): parametro URL `gruppo` se presente, altrimenti il primo supervisor attivo del tenant. Non ha la vista «tutti i gruppi» dell’amministrazione.

## Menu amministrazione: Import CSV

<!-- assistenza-acl: nav_import -->

**Permesso baseline:** `import:run` (**ADMIN**, **BACK_OFFICE**).

| Etichetta menu | Area |
|----------------|------|
| Import | Import CSV |

## Menu amministrazione: Mandanti

<!-- assistenza-acl: nav_mandanti -->

**Permesso baseline:** `mandanti:manage` (**ADMIN**, **BACK_OFFICE**, **AMMINISTRAZIONE**).

| Etichetta menu | Area |
|----------------|------|
| Mandanti | Mandanti |

## Menu amministrazione: Portafogli

<!-- assistenza-acl: nav_portafogli -->

**Permesso baseline:** `portafogli:view` (**ADMIN**, **AMMINISTRAZIONE**, **BACK_OFFICE**, **SUPERVISOR**).

| Etichetta menu | Area |
|----------------|------|
| Portafogli | Portafogli |

## Menu amministrazione: Recruiting

<!-- assistenza-acl: nav_recruiting -->

**Permesso baseline:** `recruiting:view` (**ADMIN**, **AMMINISTRAZIONE**).

Su tenant **solo Recruiter** (modulo `recruiting` senza `recovery`) il menu principale mostra solo **Recruiting** e **Account**; le voci amministrazione (Operatori, Configurazione, …) restano disponibili per chi ha i permessi. Vedi capitolo *Recruiting — modulo commerciale e profilo tenant*.

| Etichetta menu | Area |
|----------------|------|
| Recruiting | Recruiting |

## Menu amministrazione: Telefonia

<!-- assistenza-acl: nav_telefonia -->

**Permesso baseline:** `telephony:manage` (solo **ADMIN**).

| Etichetta menu | Area |
|----------------|------|
| Telefonia | Telefonia |

## Menu amministrazione: Operatori e postazioni

<!-- assistenza-acl: nav_operatori -->

**Permesso baseline:** `operatori:manage` (**ADMIN**, **AMMINISTRAZIONE**).

| Etichetta menu | Area |
|----------------|------|
| Operatori | Operatori |
| Postazioni | Postazioni |

## Menu amministrazione: Sedi

<!-- assistenza-acl: nav_sedi -->

**Permesso baseline:** gestione sedi (**ADMIN**, **AMMINISTRAZIONE**).

| Etichetta menu | Area |
|----------------|------|
| Sedi | Sedi |

## Menu amministrazione: Configurazione sistema

<!-- assistenza-acl: nav_configurazione -->

**Permesso baseline:** `users:manage` (solo **ADMIN**).

| Etichetta menu | Area |
|----------------|------|
| Configurazione | Configurazione sistema |

## Menu amministrazione: Log audit

<!-- assistenza-acl: nav_log -->

**Permesso baseline:** `audit:view` (**ADMIN**, **AMMINISTRAZIONE**).

| Etichetta menu | Area |
|----------------|------|
| Log audit | Log audit |

## Menu amministrazione: Avvisi e Ticket Credixa Suite

<!-- assistenza-acl: nav_avvisi_ticket -->

**Baseline:** voci **Avvisi** e **Ticket** visibili solo al ruolo **ADMIN** (altri ruoli: redirect a **Account** se la voce fosse visibile per errore).

| Etichetta menu | Area |
|----------------|------|
| Avvisi | Comunicazioni Back Office Credixa |
| Ticket | Ticket assistenza Credixa Suite |

**MANUTENZIONE:** in baseline vede tutte le pagine del catalogo menu (senza dati operativi).

## Barra superiore: uscita

**Percorso:** layout principale.

**Azione:** pulsante **Esci** — vedi capitolo Accesso.

## Account solo formazione

**Scopo:** capire perché alcune voci mancano.

**Verifica:** utenti `formazioneOnly` hanno accesso limitato a `/account`, `/creditcalc` e percorsi sotto `/formazione`; tentativi di aprire altre URL vengono reindirizzati verso **I miei progressi** in Formazione.
