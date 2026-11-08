# Visibilità pagine per ruolo

## Aprire la matrice visibilità

**Scopo:** definire quali voci di menu sono visibili di default per un tipo di account (ruolo).

**Percorso (verificato):**

1. Menu **Operatori** (gruppo amministrazione).
2. Pulsante/link **Default pagine per ruolo** → `/configurazione/visibilita`.

**Alternativa:** da editor operatore, link **Visibilità pagine (questo utente)** punta alla stessa area con parametro ruolo.

**Intestazione pagina:** **Visibilità pagine** — sottotitolo *Scegli quali pagine vede di default ogni tipo di account (es. Operatore). Vale per tutti gli utenti con quel ruolo.*

**Permessi e limiti:** permesso `users:manage` (ruolo **ADMIN** in mappa permessi) e accesso a **Configurazione** / gestione operatori. Il ruolo **MANUTENZIONE** non compare nella tendina ruoli della matrice (vede tutto in baseline).

## Modificare e salvare i default

**Percorso:** pagina **Visibilità pagine**.

**Compilazione:**

1. Tendina **Tipo account** (ruoli configurabili, in ordine alfabetico per etichetta: Admin, Amministrazione, Back office, Legal, Operatore, Reception, Supervisor).
2. Checkbox per ogni pagina in **ordine alfabetico crescente**, riempiendo **dall’alto verso il basso nella prima colonna**, poi la seconda, la terza (layout a colonne; tag **main** o **admin** su ogni voce), inclusa **CredixaApp**. **Account** resta sempre attivo (non in elenco). La voce **Ticket** non è modificabile in matrice (esclusa dall'editor). Dopo **Salva default ruolo**, menu e accesso alle route seguono i flag (serve aggiornare la pagina o un nuovo accesso se stai provando con lo stesso account).

**Azioni ausiliarie:** **Seleziona tutte**, **Deseleziona tutte**.

**Azione principale:** pulsante **Salva default ruolo** (in attesa **Salvataggio…**).

**Conferma:** messaggio **Preferenze ruolo salvate.**

**Nota in pagina:** *Flag = pagina visibile di default per tutti gli account [ruolo selezionato].*

## Configurazione sistema (distinta)

**Scopo:** parametri operativi tenant (non visibilità menu).

**Percorso:** menu **Configurazione** → titolo **Configurazione sistema**.

**Permessi:** `users:manage` (**ADMIN**). Il dettaglio dei singoli parametri non è documentato in questo manuale.
