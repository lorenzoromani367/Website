# Lorenzo Romani — Photography

Sito statico, zero dipendenze, zero build. Apri `index.html` col doppio click oppure servilo con un qualsiasi server statico.

## Struttura

```
index.html              shell della pagina, carica css/js
css/style.css            tutto lo stile (font, colori, layout, viewer)
js/content.js            CONTENUTO + DIMENSIONI: nomi progetti, testi, didascalie, immagini, LAYOUT
js/app.js                LOGICA: router, viewer con autoplay/frecce
fonts/                   i file font (vedi fonts/README.md)
images/                  qui andranno le foto vere, organizzate per progetto
.github/workflows/       pubblicazione automatica su GitHub Pages
```

Rispetto all'idea iniziale di un unico `index.html`, ho separato **contenuto** (`content.js`) da **logica** (`app.js`) e **stile** (`style.css`) in file distinti. Resta comunque un sito "zero build": nessuna dipendenza da installare, nessun compilatore, funziona aprendo il file o con un server statico qualsiasi. Il vantaggio è che per aggiungere o modificare una galleria lavori solo in `content.js`, senza toccare mai la logica o rischiare di rompere qualcosa.

## Come funziona

### Router (`js/app.js`, sezione 7)
Legge `location.hash` e disegna la vista giusta dentro `#app`:

| Hash | Vista |
|---|---|
| `#/` o vuoto | home (lista progetti, ferma) |
| `#/project/<slug>` | galleria del progetto |
| `#/archive` | core archive (variante "polaroid", curata a mano) |
| `#/contacts` | pagina contatti |
| `#/about` | pagina about |

### Home
Lista statica (nessuna animazione): i nomi dei progetti stanno fermi, click su uno → apre la galleria corrispondente. Le dimensioni del blocco lista si impostano in `content.js` → `LAYOUT.home` (vedi sezione "Dimensioni" più sotto).

### Viewer di galleria
Ogni galleria (progetti + core archive) è uno scroll **sempre verticale** di foto con didascalia — mai orizzontale. Sopra c'è la descrizione del progetto; sotto ogni foto la sua didascalia. In automatico avanza di una foto ogni **5 secondi** (`AUTOPLAY_DELAY`) con uno scroll fluido di **2 secondi** (`TRANSITION_MS`) — entrambe le costanti sono in cima a `app.js`. Le frecce ← → in basso permettono di navigare manualmente e resettano il timer dell'autoplay. Muovere il mouse sopra le foto mette in pausa l'autoplay.

### Hamburger
L'icona ☰ in alto a destra, in ogni pagina di galleria/contatti/about, è semplicemente un link che **torna alla home** — niente overlay/menu a comparsa.

### Dimensioni (quanto è grande un blocco di testo o una foto)
Tutto configurabile in `content.js`, in qualsiasi unità CSS (`px`, `%`, `vw`, `vh`, `auto`):

- `LAYOUT.home.listWidth` / `listHeight` — dimensioni del blocco con l'elenco progetti in home.
- `LAYOUT.gallery.descriptionWidth` — larghezza di default del testo sopra le foto (sovrascrivibile per singolo progetto con `descriptionBox: { width, height }`).
- `LAYOUT.gallery.imageWidth` / `imageHeight` — dimensioni di default di ogni foto (sovrascrivibili per singola immagine aggiungendo `width`/`height` a quella voce in `images: [...]`).

Se dai un'altezza fissa a una foto, l'immagine viene ritagliata (`object-fit: cover`) per riempire esattamente quel riquadro; se lasci `"auto"`, mantiene le proporzioni naturali.

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

`core archive` è una selezione curata a mano nell'oggetto `ARCHIVE` in `content.js` (stessa struttura di un progetto: `description` + `images`) — aggiungi/togli/riordina le foto che vuoi mostrare lì direttamente in quell'array.

## Font

Vedi `fonts/README.md`. In breve: il font in uso ora è quello che mi hai dato (`TeXGyreHerosCn-Regular`), collegato in `css/style.css` via `@font-face` — nota che è la variante **condensed** ("Cn"), più stretta della "TeX Gyre Heros" normale vista negli screenshot di riferimento iniziali. Se vuoi la larghezza normale, mandami il file `TeXGyreHeros-Regular` (senza "Cn") e sostituisco i due file in `fonts/`.

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
