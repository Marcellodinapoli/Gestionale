# Import CSV (pratiche e incassi)

## Aprire Import

**Scopo:** caricare file CSV di pratiche o incassi in massa.

**Percorso:** menu amministrazione → **Import**.

**Intestazione:** titolo **Import CSV**, sottotitolo **Carichi massivi di pratiche e incassi (back office)**.

**Permessi e limiti:** permesso `import:run` — ruoli **ADMIN** e **BACK_OFFICE**; modulo **recovery**; voce menu visibile secondo permessi e visibilità pagina.

## Avviare un import pratiche

**Percorso:** pagina **Import CSV** → pannello card **Pratiche**.

**Azione:** pulsante **Importa pratiche** (apre il flusso di upload/configurazione del pannello; i campi specifici del wizard non sono elencati in questo capitolo).

**Conferma:** nuovo batch in elenco **Import effettuati** sotto la pagina (componente **ImportBatchList**).

## Avviare un import incassi

**Percorso:** pagina **Import CSV** → card **Incassi massivi**.

**Azione:** pulsante **Importa incassi**.

**Conferma:** come sopra, in **Import effettuati**.

**Nota:** per integrazioni da batch esistenti può essere usato il parametro URL `integra` (dettaglio campi precompilati non documentato qui).
