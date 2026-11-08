# Documentazione assistenza Credixa Suite

Questa cartella contiene i **manuali approvati** usati dall'assistente integrato in Credixa Suite.

## Come aggiungere contenuti

1. Crea file `.md` per area funzionale (es. `pratiche/filtri.md`), usando sezioni `##` per spezzare gli argomenti.
2. Per associare **screenshot autentici**, inserisci immagini già presenti in `public/help/screenshots/`:

   ```markdown
   ![Didascalia descrittiva](/help/screenshots/nome-file.png)
   ```

3. Non includere dati reali di pratiche, debitori o importi negli esempi.
4. Dopo aver aggiornato i manuali, rigenera l'indice per le Cloud Functions:

   ```bash
   cd credit-calc-store/functions && npm run build
   ```

## Stato attuale

Capitoli operativi testuali in questa cartella (file `.md` escluso questo README). Dopo ogni modifica, rigenerare l'indice con `npm run build` in `credit-calc-store/functions`.

Per supporto umano (tenant ADMIN): sezione **Ticket** nel gestionale.
