# Credixa

Nucleo operativo ispirato a **CG32** e **Ulisse**: pratiche, affidi, lavorazione telefonica, incassi, ruoli con limiti.

**Database: solo Firebase (Firestore).** Niente SQLite, Postgres o Neon.

## Avvio

1. Copia `.env.example` → `.env` e imposta service account + `NEXT_PUBLIC_FIREBASE_*`.
2. Seed demo su Firestore:

```powershell
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

Codice azienda: **demo** (anche **alfa**).

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

## Nota tecnica

`src/lib/firebase/schema.prisma` serve **solo** a generare tipi TypeScript per l’adapter Firestore. Non c’è database locale.
