# Credixa

Nucleo operativo ispirato a **CG32** e **Ulisse**: pratiche, affidi, lavorazione telefonica, incassi, ruoli con limiti.

L’app English (Alinea) non è toccata. Questo è un progetto separato.

## Avvio

```powershell
cd "C:\Users\271\Desktop\Marcello\Esiti test\Gestionale"
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Apri [http://localhost:3001](http://localhost:3001)

## Accessi demo (password `Demo123!`)

| Ruolo | Email |
| --- | --- |
| Amministratore | admin@gestionale.local |
| Supervisor | supervisor@gestionale.local |
| Back office | backoffice@gestionale.local |
| Operatore | operatore@gestionale.local |
| Operatore 2 | operatore2@gestionale.local |
| Manutenzione (UI senza dati) | manutenzione@gestionale.local |

## Limiti

- **Operatore**: solo pratiche affidate a lui; esiti/note/agenda; niente import, affidi, incassi, utenti.
- **Back office**: mandanti, import CSV, incassi (singoli e massivi), affidi definitivi e temporanei; niente coda telefonica / utenti / log.
- **Supervisor**: portafoglio del team, affidi, report; niente creazione admin / cancellazione mandanti.
- **Amministratore**: tutto, incluso log e utenti.
- **Manutenzione**: vede tutte le schermate del gestionale, ma senza dati operativi (pratiche, anagrafiche, incassi, log). Non può scrivere.

## Import CSV

Separatore `;`

`mandante;nome;cognome;cf;telefono;citta;capitale;interessi;spese`

Esempio in `public/esempio-pratiche.csv`.
