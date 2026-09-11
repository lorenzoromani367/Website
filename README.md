# Lorenzo Romani — Photography

Sito statico, zero dipendenze, zero build. Apri `index.html` col doppio click oppure servilo con un qualsiasi server statico.

## Struttura

```
index.html              shell della pagina, carica css/js
css/style.css            tutto lo stile (font, layout, marquee, viewer, menu)
js/content.js            CONTENUTO: nomi progetti, testi, didascalie, immagini
js/app.js                LOGICA: router, marquee, viewer con autoplay, menu
fonts/                   qui vanno i file di TeX Gyre Heros (vedi fonts/README.md)
images/                  qui andranno le foto vere, organizzate per progetto
.github/workflows/       pubblicazione automatica su GitHub Pages
```

Rispetto all'idea iniziale di un unico `index.html`, ho separato **contenuto** (`content.js`) da **logica** (`app.js`) e **stile** (`style.css`) in file distinti. Resta comunque un sito "zero build": nessuna dipendenza da installare, nessun compilatore, funziona aprendo il file o con un server statico qualsiasi. Il vantaggio è che per aggiungere o modificare una galleria lavori solo in `content.js`, senza toccare mai la logica o rischiare di rompere qualcosa.

## Come funziona

### Router (`js/app.js`, sezione 8)
Legge `location.hash` e disegna la vista giusta dentro `#app`:

| Hash | Vista |
|---|---|
| `#/` o vuoto | home (marquee + lista progetti) |
| `#/project/<slug>` | galleria del progetto |
| `#/archive` | core archive (variante "polaroid") |
| `#/contacts` | pagina contatti |
| `#/about` | pagina about |

### Marquee (home)
La lista dei 21 nomi è duplicata e fatta scorrere verso il basso in loop continuo, a velocità costante indipendente dal numero di voci (`MARQUEE_SPEED_PX_S` in cima a `app.js`). Il mouse sopra la ferma (`mouseenter`/`mouseleave`); su touch si ferma al tocco. Click su un nome → apre la galleria corrispondente.

### Viewer di galleria
Ogni galleria (progetti + core archive) è uno scroll verticale di foto con didascalia. Sopra c'è la descrizione del progetto; sotto ogni foto la sua didascalia. In automatico avanza di una foto ogni **5 secondi** (`AUTOPLAY_DELAY`) con uno scroll fluido di **2 secondi** (`TRANSITION_MS`) — entrambe le costanti sono in cima a `app.js`. Le frecce ← → in basso permettono di navigare manualmente e resettano il timer dell'autoplay. Muovere il mouse sopra le foto mette in pausa l'autoplay, come nel marquee.

### Menu (hamburger)
Nelle pagine di galleria/contatti/about, l'icona ☰ in alto a destra apre un overlay con l'elenco completo dei progetti + i link del footer, per saltare da una galleria all'altra senza tornare alla home.

## Aggiungere contenuti

Tutto in `js/content.js`:

```js
{
  slug: "lines",              // usato nell'URL: #/project/lines
  name: "Lines",               // testo mostrato nel marquee/menu
  description: ["paragrafo 1", "paragrafo 2"],
  images: [
    { caption: "winery, sicily", src: "images/lines/01.jpg" },
    { caption: "mountain pasture", src: null }, // null = placeholder automatico
  ],
}
```

Finché `src` è `null`, il sito genera da solo un'immagine segnaposto colorata (funzione `placeholderImg()` in `app.js`) così puoi vedere subito il sito completo con tutte le 21 gallerie prima di avere le foto definitive. Quando hai un file reale, mettilo in `images/<slug>/nomefile.jpg` e scrivi quel percorso in `src`.

Ho già inserito i testi reali di **Lines** (presi dai tuoi screenshot); le altre 20 gallerie hanno testo segnaposto — mandami foto e testi progetto per progetto e li inserisco.

`core archive` al momento è generata automaticamente prendendo la prima foto di ciascun progetto (vedi `renderArchive()` in `app.js`); dimmi se preferisci una selezione curata a mano e la sostituisco con un array dedicato.

## Font — TeX Gyre Heros

Vedi `fonts/README.md`. In breve: metti `TeXGyreHeros-Regular.woff2` (e/o `.ttf`) dentro `fonts/` con quel nome esatto — è già collegato in `css/style.css` via `@font-face`. Finché non ci sono quei file, il sito usa Helvetica/Arial come fallback (esteticamente molto vicino, essendo TeX Gyre Heros un clone metrico di Helvetica).

## Pubblicazione (GitHub Pages)

Il workflow `.github/workflows/deploy-pages.yml` pubblica automaticamente il sito a ogni push su `main`.

Passi una tantum su GitHub:
1. **Settings → Pages → Source**: seleziona "GitHub Actions".
2. Fai il merge di questo branch su `main` (o pusha direttamente su `main`): il workflow parte da solo e in 1-2 minuti il sito è online su `https://<tuo-utente>.github.io/<nome-repo>/`.

### Dominio personalizzato
Quando hai il dominio:
1. Dal registrar (Namecheap, OVH, ecc.) crea un record DNS che punta a GitHub Pages: un `CNAME` verso `<tuo-utente>.github.io` (per un sottodominio come `www.tuodominio.com`) oppure i 4 record `A` di GitHub Pages per il dominio apex — le istruzioni aggiornate sono su https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site.
2. Crea un file `CNAME` (senza estensione) nella root del repository con dentro solo il dominio, es. `www.tuodominio.com`.
3. In **Settings → Pages** inserisci lo stesso dominio nel campo "Custom domain" e abilita "Enforce HTTPS" (il certificato viene emesso automaticamente da GitHub, gratis).

## Costi annuali

- **Hosting (GitHub Pages)**: **0 €/anno**, sia con repository pubblica sia — sul piano GitHub Free personale — con repository privata.
- **Dominio personalizzato**: unico costo reale, a carico del registrar che scegli. Indicativamente **10–20 €/anno** per `.com`/`.it`, di più per estensioni particolari (es. `.photography`, `.gallery` spesso 20–40 €/anno).
- **Certificato HTTPS**: incluso gratis da GitHub Pages, nessun costo aggiuntivo.

Totale realistico: **circa 10–20 €/anno**, solo per il rinnovo del dominio — l'hosting in sé resta gratuito.
