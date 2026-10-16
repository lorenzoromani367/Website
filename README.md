# Lorenzo Romani — Photography

Sito statico, zero dipendenze, zero build. Apri `index.html` col doppio click oppure servilo con un qualsiasi server statico.

## Struttura

```
index.html              shell della pagina, carica css/js
css/style.css            tutto lo stile (font, colori, layout, viewer)
js/content.js            CONTENUTO + DIMENSIONI: nomi progetti, testi, didascalie, immagini, LAYOUT
js/app.js                LOGICA: router, viewer con autoplay/frecce
js/state-merge.js        fusione delle modifiche tra browser e file su disco (vedi "Salvataggio")
js/recovered-captions.js didascalie ritrovate dalla cronologia (vedi "Didascalie")
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

**Foto ingrandita = galleria ferma.** Mentre una foto è ingrandita la galleria dietro sta ferma (anche se stava scorrendo a metà) e riparte da dove era quando chiudi: così la foto ingrandita torna esattamente sulla miniatura che avevi ingrandito e non "insegue" lo scorrimento. Lo fanno `holdGallery` / `releaseGallery` in `app_v58.js`, avvisate da `makeZoomable` con gli eventi `zoom-opened` / `zoom-closed`; l'animazione di ingrandimento (FLIP) non è toccata. Con la foto aperta anche le frecce della tastiera non muovono la galleria.

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

## Salvataggio delle modifiche e pubblicazione (aggiornato)

- **Modalità modifica solo sul tuo computer.** I pulsanti ⇲ / ⇩ / anteprima mobile compaiono solo su `localhost` (o con `?edit` in fondo all'indirizzo). Chi visita il sito pubblicato non li vede. Con `?visitor` su localhost vedi il sito esattamente come lo vede un visitatore.
- **`js/site-state.js` = tutte le modifiche fatte in modalità modifica** (posizioni, misure, voci tolte dalla home, parole dell'archivio, didascalie scritte a mano...). Lo scrive il server locale (`server.js`, endpoint `/api/sync-state`) mentre lavori: non si modifica a mano. Va pubblicato insieme al resto (commit + push). I visitatori leggono solo questo file; non usano la memoria del loro browser.
- **Le modifiche si fondono, non si sovrascrivono** (`js/state-merge.js`, usato sia dal sito sia dal server). Prima, se il browser e il file su disco non coincidevano (un altro browser, Safari/Vivaldi, aveva salvato altro; oppure si era lavorato a server spento), uno dei due veniva buttato via per intero: così sono sparite delle didascalie. Adesso si confronta voce per voce con com'era il file l'ultima volta che questo browser l'ha letto: una modifica fatta qui e una fatta altrove si sommano, quella fatta su una voce diversa non cancella mai le altre, e se togli davvero qualcosa (es. svuoti una didascalia) la rimozione vale. Solo se la stessa voce è stata cambiata in due posti insieme vince l'ultima salvata (e la versione persa resta nelle copie di sicurezza). Niente più domande tipo "salvare queste modifiche al posto di quelle del progetto?". Se il file `site-state.js` non si legge (es. righe `<<<<<<<` lasciate da un conflitto in GitHub Desktop) il server lo ricrea dallo stato del browser, tenendo una copia del file rovinato.
- **Copie di sicurezza** in `.state-backups/` (solo sul tuo computer, non pubblicate): le ultime 40 versioni; una al giorno per 90 giorni (`giornaliere/`); e, quando un salvataggio toglie molte voci tutte insieme, la versione di prima (`prima-di-togliere-molto/`) — il Terminale avvisa con una riga che inizia con `[!]`. Per recuperare qualcosa: copia il file scelto sopra `js/site-state.js` e riavvia.
- **Nel codice non usare mai `localStorage` direttamente: si usa `siteStore`** (stessi metodi: `getItem` / `setItem` / `removeItem`), definito in cima a `js/app_v58.js`.
- **`js/images-data.js` è generato** (elenco foto, misure vere delle foto, elenco testi): lo tiene aggiornato il server locale ogni secondo, e la pubblicazione lo rigenera (`node watch_images.js --once`). Le foto in `images/` e i file in `testi/` devono avere lo stesso nome — maiuscole comprese — in `content.js` e sul disco (su GitHub Pages `rock.jpg` e `rock.JPG` sono file diversi; il server locale lo segnala).
- **La misura di una foto in pagina viene dalle sue proporzioni vere** (`IMAGE_SIZES`), mai da `zoomBox`, che è solo la misura dell'ingrandimento.
- **Pubblicazione** (`.github/workflows/deploy-pages.yml`): prepara la cartella `_site` (solo i file del sito) e scrive il codice della versione dentro `index.html` (`?v=` e `SITE_VERSION`), così i browser riscaricano i file solo quando c'è qualcosa di nuovo.

## Didascalie

- **Scrivile pure dal browser** (modalità modifica ⇲ → clicca sotto la foto): si salvano da sole, e adesso non spariscono più (vedi "Le modifiche si fondono", qui sopra). **Non serve** rinominare i file con la didascalia.
- Sono **legate alla foto** (al suo file), non alla sua posizione nell'elenco: aggiungere, togliere o rinominare altre foto nella cartella non le sposta più sotto la foto sbagliata (la chiave salvata è `project.<progetto>.captionText.@<cartella>/<file>`, tutto minuscolo; prima era un numero d'ordine, e al primo avvio quelle vecchie passano da sole alla foto che stava in quel posto). Se **rinomini** un file, la sua didascalia scritta a mano non lo segue (per il sito è un'altra foto): riscrivila, oppure dai al file il nome giusto (vedi sotto).
- **Cosa compare sotto una foto**, in quest'ordine: 1) il testo scritto a mano nel browser (se lo svuoti, resta "nessuna didascalia"); 2) una didascalia della lista `js/recovered-captions.js` (ritrovate o corrette, vedi sotto); 3) la `caption` in `content.js`; 4) **il nome del file**, se somiglia a un titolo.
- **Il nome del file diventa la didascalia** se somiglia a un titolo scritto da una persona: si toglie l'estensione e un eventuale numero d'ordine davanti (`3 field.jpg` → "field", `upside down.JPG` → "upside down", `sunset-over-water.jpg` → "sunset over water", `pot and bowl copia.jpg` → "pot and bowl"). Non lo fa per nomi automatici: `stills-13.jpg`, `lines-1-8.JPG`, `IMG_0412.JPG`, `senza titolo-1.JPG`, `Schermata 2026-10-12…`, né per nomi che finiscono con un numero (`paris 2.jpg`). Il titolo scritto *dentro* il file (Lightroom, Foto di macOS) non viene letto: conta solo il nome del file. La regola è `captionFromFileName` in `app_v58.js`.
- **Didascalie ritrovate e corrette** (`js/recovered-captions.js`): le didascalie che avevi scritto a mano il 9 ottobre e che il salvataggio sbagliato aveva cancellato (23 su foto che oggi non ne avevano nessuna, più 7 che sostituiscono quelle di `content.js`: wine sales negotiations, barns, construction, cigarettes, tie saint laurent, ionia porcelain set, vintage perfume bottle), recuperate dalla cronologia di GitHub, più alcune correzioni di inglese (`tablecloth`, `self-portrait`, `untitled (part of a series)`, `Tea Set`). Valgono **al posto** di quella in `content.js`; quella che scrivi tu nel browser vale più di tutte. Quando vuoi puoi scrivere una didascalia in `content.js` e toglierla da quel file.

## Core Archive

- La pagina è un **elenco verticale di parole** (`ARCHIVE.pages[0].images` in `content.js`), allineato al bordo sinistro del titolo "core archive". Ogni voce è `{ type: "word", text, uid, linkedImageSrc, linkedImageProject }` oppure `{ type: "break", uid }` (una riga vuota tra due gruppi). L'ordine dell'array è l'ordine in pagina.
- Le parole hanno **la stessa scrittura delle didascalie** delle foto (regola unica in `style_v58.css`, insieme a `.caption-input`).
- Cliccando una parola si apre la foto collegata; accanto compare il **progetto a cui la foto appartiene** (`archiveImageProject` in `app_v58.js`: progetto salvato nella parola, cartella della foto, copia identica in un progetto — vedi `IMAGE_TWINS` in `images-data.js` —, stesso nome di file, prefisso del nome file). Cliccando quel nome si apre il progetto.
- Quel nome (`.lightbox-project-label`) **non è una didascalia**: ha il carattere dei nomi della home (stessa famiglia, grandezza, peso e spessore), è scritto come in home (maiuscola compresa) e ha il colore del foglio beige (`--paper`). Distanza dalla foto: `LIGHTBOX_LABEL_GAP` (di lato su computer, `LIGHTBOX_LABEL_GAP_MOBILE` sotto la foto su telefono).
- La foto ingrandita (`makeZoomable`, chiavi `archive.…`) su computer sta nei **tre quarti di sinistra** dello schermo, centrata lì dentro, con il nome del progetto a destra. Ha la **misura che hai scelto tu per quella foto** (vedi "Misura delle foto ingrandite"); se è più grande dei tre quarti la foto parte dal margine sinistro e può allargarsi finché a destra c'è posto per il nome. Senza una misura scelta, sta nei tre quarti (alta al massimo l'82% dello schermo). Mentre la ridimensioni con le maniglie resta al suo posto (non salta al centro dello schermo). L'animazione di ingrandimento (FLIP) è la stessa di tutto il sito: cambia solo il punto di arrivo.
- In modalità modifica: 🔗 collega a una foto, × toglie, ⠿ riordina, "+ Parola" / "+ Spazio" aggiungono in fondo. Si salva da solo (`site-state.js` e `content.js`).
- **Parole aggiunte una tantum** (`addRestoredWordsToArchive` in `app_v58.js`, solo sul tuo computer, mai per chi visita il sito): al primo avvio dopo l'aggiornamento "tie, saint laurent" diventa "tie saint laurent" e in fondo, in un gruppo a parte, si aggiungono le parole delle didascalie rimesse il 12 ottobre — wine sales negotiations, barns, construction, cigarettes, vintage perfume bottle — ciascuna legata alla sua foto. Se per quella foto c'è già una parola (come "porcelain" per "ionia porcelain set") non se ne aggiunge un'altra. Sono parole normali: si cambiano, si spostano e si tolgono dal browser, e se ne togli una non ricompare (lo ricorda il flag `site-archive-words-added-v1`). Per metterle online fai commit e push di `site-state.js` e `content.js` come sempre.

## Misura delle foto ingrandite

- **Una misura per foto, uguale in tutto il sito.** La scegli tu trascinando le maniglie sulla foto ingrandita (apri la foto, premi ⇲, trascina). Vale ovunque la foto si ingrandisca: pagina del progetto e Core Archive. Una copia della foto nella cartella `core archive` conta come la foto del progetto (`IMAGE_TWINS` in `images-data.js`, che il server locale e la pubblicazione generano).
- Si salva in due posti: nello stato del sito (`js/site-state.js`, chiave `zoom:<percorso della foto>` dentro `site-size-overrides-v1:d`: è quello che leggono i visitatori) e, se la foto sta in un progetto, nel suo `zoomBox` in `content.js`. Per ricavare la misura di una foto (`makeZoomable`) si cerca nell'ordine: quella salvata per la foto → quella del punto del sito in cui la apri (chiave `project.<nome>.zoom.<n>`, come prima) → il `zoomBox` di `content.js`.
- Il riquadro in basso a destra della foto diventa verde con "✓ Salvato" **solo dopo** che la misura è davvero finita su disco (`siteStore.flushNow()`); se no è rosso. Il server (`/api/save-image-props`) risponde `updated: true` solo se ha trovato e riscritto la foto in `content.js` (cerca la voce `src: "…"` di un progetto, senza badare alle maiuscole, e non scambia per foto i collegamenti delle parole del Core Archive).

## Fluidità delle animazioni

Cosa si muove e come (le velocità e le curve sono quelle di sempre: `AUTOPLAY_DELAY`/`TRANSITION_MS`/`--transition-ms`, `MARQUEE_PX_PER_SEC`, i 850 ms e i 550 ms dello zoom):

- **Scorrimento tra le foto, zoom in/out delle foto, sfondo scuro**: si animano solo `transform` e `opacity`, che il browser fa girare sulla scheda grafica senza ricalcolare la pagina; non risentono di quello che fa il resto del sito in quel momento.
- **Testo scorrevole**: sta su un livello grafico a parte (`will-change: transform`) e a ogni fotogramma si sposta di 0,1 px (6 px al secondo esatti): è sempre un movimento continuo, mai a salti di un pixel.
- **Prima apertura dello zoom** (`makeZoomable`): lo sfondo scuro e il riquadro che vola si creano a pagina ferma (non al primo clic) e la foto grande si decodifica in anticipo, appena il puntatore arriva sulla foto o la tocca (`warmLightboxPhoto`). Prima, solo alla prima apertura dopo aver caricato il sito, lo sfondo compariva di colpo e la foto con 1-2 fotogrammi di ritardo (un lampo scuro). L'ingrandimento parte comunque subito (al massimo 250 ms di attesa se il file non fosse pronto).
- **Fine dello zoom-out**: la miniatura ricompare nell'istante stesso in cui sparisce la foto che volava. Prima la sua dissolvenza di 0,3 s (pensata per il caricamento) faceva sparire la foto per un attimo a fine chiusura e poi la faceva riapparire sfumando.
- **Altezza del riquadro foto** (`updateViewportHeight`): se la foto in arrivo è più bassa, la barra con le frecce sale piano con lo scorrimento (transizione di `style_v58.css`, 6 s); se è più alta, prima scendeva di colpo (anche di 100 px, nello stesso istante in cui parte lo scorrimento): ora scende in modo continuo in 0,8 s (`VIEWPORT_GROW_MS`), frenando alla fine. Trascinare una didascalia, ridimensionare una foto o la finestra continuano ad adeguare l'altezza subito. È l'unica parte che si anima cambiando il layout invece di `transform`: costa poco (circa 0,2 ms a fotogramma) ma non è gratis.

## Telefono e computer

- **La soglia è 700 px** (`MOBILE_BREAKPOINT` in `app_v58.js`, uguale al `@media (max-width: 700px)` di `style_v58.css`). Sotto: layout telefono (testi 2pt più piccoli, margini di 20 px, valori di `LAYOUT.galleryMobile` e `mobile: {…}` delle singole foto in `content.js`; posizioni e misure trascinate si salvano a parte, chiavi `…:m`). Sopra — anche iPad e telefoni in orizzontale da 701 px in su — layout computer. La parte che dipende dalla soglia viene decisa quando la pagina si disegna.
- **Cambio di formato senza ricaricare** (`redrawWhenFormatChanges`, in fondo al router): se la finestra attraversa i 700 px (telefono ruotato, finestra del computer ridimensionata) la pagina si ridisegna. Prima restava un misto di versione telefono e versione computer (testo stretto nel foglio largo, titolo fuori dallo schermo, in un caso la pagina più larga dello schermo di 62 px). Con una **foto ingrandita aperta** la foto si rimette a misura dello schermo nuovo da sola (`zoomRefit`, che riusa `fitTarget`, lo stesso calcolo dell'apertura) e la pagina dietro si ridisegna quando la chiudi; il pannello del **testo ingrandito** si chiude (è istantaneo) e la pagina si ridisegna.
- **La pagina non è mai più larga dello schermo**: la "scatola" del titolo è larga quanto tutta la riga e viene spostata di 60 px (telefono) o 120 px (computer); la sua parte vuota usciva dal bordo destro e allargava la pagina (su ogni telefono di 2 px: striscia scura a destra e pagina che "balla" di lato; su iPad in verticale fino a 42 px). Per chi visita il sito la barra in alto ritaglia ciò che esce di lato (`body:not(.edit-mode) .topbar { overflow-x: clip }`); in modalità modifica il ritaglio è spento, perché le maniglie di spostamento stanno fuori dai bordi del foglio.
- **Contatti, About e pagina "non trovata"** (`renderSimplePage`) hanno larghezza e posizione di partenza del testo di un progetto, anche su telefono (`pickLayout` con i valori di `LAYOUT.galleryMobile`). Prima su telefono avevano il testo più largo e 40 px più in basso, e aprendolo (zoom del testo) saltava di 40 px.
- **Foto ingrandita su telefono, con il nome del progetto sotto** (Core Archive, foto con collegamento; `fitTarget` in `makeZoomable`): se la scritta non ci sta sotto la foto (foto alte, schermi bassi, telefono in orizzontale sotto i 701 px) la foto si rimpicciolisce solo quanto serve e il gruppo foto + scritta si centra; prima la scritta finiva sotto il bordo dello schermo e non si poteva toccare. Le foto che hanno già posto restano dove erano. Solo il punto di arrivo cambia: l'animazione (FLIP) è la stessa.
- **Tocco**: dopo un tocco il browser inventa anche `mouseenter` e non manda mai `mouseleave` finché non si tocca altrove, quindi la pausa "al passaggio del mouse" lasciava la galleria (dopo un tocco sul margine) o il testo scorrevole (dopo aver chiuso lo zoom del testo con la tastiera) fermi per sempre: `isTouchEcho` ignora il `mouseenter` che arriva subito dopo un tocco (sul computer non cambia nulla). Uno **swipe** cambia foto solo se il movimento è più orizzontale che verticale (scorrere la pagina col pollice, con un po' di deriva laterale, cambiava la foto per errore); `touchcancel` fa ripartire la galleria. Il pannello del testo ingrandito usa `100dvh` (l'altezza davvero visibile su iPhone, dove `100vh` comprende la zona sotto la barra del browser).
- **Core Archive**: il numero in fondo ("0") su computer sta fuori dal foglio (spostato di −180 px, sul fondo scuro dove non si legge); su telefono finiva dentro la pagina, da solo in basso a sinistra: ora si nasconde (in modalità modifica resta, per poterlo spostare).
- **Foto messe a sinistra su computer** (le pagine senza testo: Tower, Michelin, Paper tape, Beach, Plastic, Hair, Fluoxetine, Licking, Moon, Compression, Pile, Sofa, Whitening; in `content.js` hanno `align: "left"`, `width` e `offset: { x: 0, y: 52 }`): su telefono prendono la stessa disposizione **in scala** (`phoneLayoutFromDesktop` in `app_v58.js`) — a sinistra, con la stessa parte di foglio occupata (circa la metà) e, in proporzione, la stessa distanza dal titolo (43 px invece di 175). Prima su telefono avevano la larghezza piena e stavano il doppio più in basso, perché `width` e `offset` di `content.js` sono valori da computer e il telefono li ignorava. Larghezza e spostamento si calcolano da quelli del computer × (larghezza dello schermo − 40) / 660. Se una foto ha un suo `mobile: {…}` in `content.js`, o l'hai regolata a mano sul telefono (chiavi `…:m`), vale quello. Le altre pagine non cambiano.
- **Tasto "torna alla home" (le tre lineette) su telefono**: disegno più grande (24 px di larghezza invece di 14, 2 px di spessore) e area sensibile al tocco di 50 × 44 px (prima 22 × 22); bordo destro, centro verticale e resto della pagina restano dove erano. In modalità modifica e su computer non cambia.
- **Regolare a mano sul telefono** (⇲ modifica dentro l'anteprima mobile, o schermo stretto): si salva in `js/site-state.js` (chiavi `…:m`: valgono per chi guarda da telefono e vanno pubblicate come il resto) e **non si scrive più in `content.js`**. Prima trascinare o ridimensionare una foto nell'anteprima mobile riscriveva in `content.js` anche `width` e `offset` del COMPUTER con i valori del telefono (`makeMovableFree`, `makeResizable`, `makeZoomResizable`, uscita dalla modifica). Inoltre il salvataggio in `content.js` (`/api/save-image-props` in `server.js`, funzione `removeTopLevel`) ora toglie e sostituisce solo le proprietà **al primo livello** della voce di una foto: prima toglieva anche `height` dentro `zoomBox` e dentro `mobile` (è così che la foto `mediality-3.jpg` ha perso l'altezza del suo ingrandimento: oggi `zoomBox: { width: "915.969px" }`, in origine `{ width: "915.969px", height: "916.76px" }`). Il pulsante "Ripristina questa pagina" del pannello di esportazione continua a cancellare dal browser le misure di entrambe le versioni; la sua parte su `content.js` fallisce da sempre con un errore del server (valori `null`) e non è stata toccata.
- **Lasciato com'era di proposito**: il testo scorrevole si può trascinare col dito (`touch-action: none` sul riquadro: toccando lì la pagina non scorre, si sposta il testo — è la funzione "trascinabile a mano"); una didascalia non è mai più larga della sua foto, quindi su telefono con foto strette qualcuna va a capo (5 su 92 vanno a capo solo su telefono: Cement foto 6, Sospension foto 1, 2, 5 e 6; altre 6 vanno a capo anche su computer: Stills foto 1, Cement foto 3 e 5, Sospension foto 8, 9 e 10); le misure salvate dell'ingrandimento valgono solo sul computer (su telefono la foto ingrandita va quasi a filo schermo).
- **Non verificato** (nessun iPhone/Safari/Android a disposizione, solo Chromium con schermo e tocco simulati): il comportamento con la barra del browser che si nasconde, il riconoscimento automatico del numero di telefono in Contacts su iPhone, l'effetto `:hover` che resta dopo un tocco.

## Testo scorrevole

- Ogni pagina con testo scorrevole (progetti con un file in `testi/`, About) ha il testo **due volte in una striscia** che scende in loop dentro il suo riquadro (`.description`). All'apertura la **prima riga del testo parte esattamente dal bordo alto del riquadro**; `measureMarqueeLoop` in `app_v58.js` misura il giro (differenze tra rettangoli, non `offsetTop`) e il punto di partenza, ed è usata sia da `renderGallery` sia da `renderSimplePage`: la partenza è identica ovunque.
- Uscendo dalla modifica (la seconda copia era nascosta e il testo può essere cambiato) lo scorrimento si rimisura e riparte da capo.
- Lo spazio tra la fine e il ricominciare del testo è almeno `MARQUEE_MIN_GAP`.

