/* ==========================================================================
   APP.JS
   ==========================================================================
   Router + rendering + comportamento: viewer galleria a scorrimento
   orizzontale, lightbox per ingrandire una foto, e modalità modifica per
   ridimensionare i blocchi trascinando invece di scrivere numeri. Il
   contenuto e le dimensioni di default vivono in content.js (PROJECTS,
   ARCHIVE, LAYOUT).

   Indice:
     1. Costanti regolabili
     2. Helpers generici
     3. Dimensioni regolabili a trascinamento (localStorage + export)
     4. Lightbox (clic su una foto per ingrandirla)
     5. Placeholder immagini (SVG generato al volo)
     6. Render: HOME (lista statica, nessuna animazione)
     7. Render: GALLERY (progetti + core archive) — slide orizzontale
     8. Render: CONTACTS / ABOUT
     9. Router (con gestione errori)
   ========================================================================== */

/* -------------------------------------------------------------------------
   1. Costanti regolabili
   ------------------------------------------------------------------------- */
const AUTOPLAY_DELAY = 6000;   // ms di pausa su ogni foto prima di avanzare
const TRANSITION_MS = 6000;    // durata dello slide orizzontale tra le foto (già coerente con --transition-ms in style.css)
const GRID_SIZE = 20;          // px: passo della griglia di allineamento in modalità modifica (resize/spostamenti si agganciano a questo)

/* -------------------------------------------------------------------------
   2. Helpers generici
   ------------------------------------------------------------------------- */
const app = document.getElementById("app");

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function findProject(slug) {
  return PROJECTS.find((p) => p.slug === slug) || null;
}

function isEditMode() {
  return document.body.classList.contains("edit-mode");
}

// Arrotonda un valore in px al multiplo di GRID_SIZE più vicino — usato da
// resize, riordino e spostamento libero così che, agganciandosi tutti alla
// stessa griglia, foto e blocchi diversi finiscono per allinearsi tra loro
// invece di fermarsi su misure leggermente diverse l'uno dall'altro.
function snapToGrid(value) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

// Tiene traccia degli event listener/timer/observer della vista corrente,
// così il router può ripulirli prima di disegnare la vista successiva.
let currentTeardown = null;
function teardownCurrentView() {
  if (typeof currentTeardown === "function") currentTeardown();
  currentTeardown = null;
}

/* -------------------------------------------------------------------------
   3. Dimensioni regolabili a trascinamento
   ------------------------------------------------------------------------- */
const SIZE_STORE_KEY = "site-size-overrides-v1";

function loadSizeOverrides() {
  try {
    return JSON.parse(localStorage.getItem(SIZE_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveSizeOverride(key, size) {
  const all = loadSizeOverrides();
  all[key] = size;
  try {
    localStorage.setItem(SIZE_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la dimensione resta comunque applicata per questa sessione */
  }
}

function clearSizeOverride(key) {
  const all = loadSizeOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    localStorage.setItem(SIZE_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la modifica resta comunque applicata per questa sessione */
  }
}

/* -------------------------------------------------------------------------
   Ordine regolabile a trascinamento (riordinare i progetti in home, o le
   foto dentro una galleria) — stessa logica di salvataggio delle dimensioni,
   store separato.
   ------------------------------------------------------------------------- */
const ORDER_STORE_KEY = "site-order-overrides-v1";

function loadOrderOverrides() {
  try {
    return JSON.parse(localStorage.getItem(ORDER_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveOrderOverride(key, order) {
  const all = loadOrderOverrides();
  all[key] = order;
  try {
    localStorage.setItem(ORDER_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: l'ordine resta comunque applicato per questa sessione */
  }
}

// L'ordine dei progetti in home (e quindi anche dei "progetto precedente/
// successivo" nelle frecce), se è stato cambiato trascinando; altrimenti
// l'ordine originale di content.js.
// Sequenza COMBINATA della lista in home: nomi di progetto E parole
// aggiunte con "+", intrecciati nell'ordine in cui li vedi — una riga per
// voce, ognuna taggata "p:slug" (progetto) o "w:id" (parola). Prima c'erano
// due meccanismi separati: un ordine "solo progetti" (riordino a
// trascinamento) e un posizionamento libero a pixel per le parole — così
// una parola non poteva mai inserirsi TRA due nomi (poteva solo
// sovrapporsi, mai spostare gli altri per fare spazio). Un'unica lista,
// un solo meccanismo di riordino (la stessa maniglia blu ⠿ di sempre),
// risolve il problema alla radice: trascinare una riga qualunque, parola
// compresa, sposta davvero le altre.
const HOME_ROWS_KEY = "home.rows";

function getHomeRows() {
  const orderOverrides = loadOrderOverrides();
  const projectSlugs = PROJECTS.map((p) => p.slug);
  const projectSlugSet = new Set(projectSlugs);
  const wordIds = extraTextFor("home").map((w) => w.id);
  const wordIdSet = new Set(wordIds);

  const saved = orderOverrides[HOME_ROWS_KEY];
  let rows;
  if (saved) {
    rows = saved.filter((tag) => {
      const id = tag.slice(2);
      return tag.startsWith("p:") ? projectSlugSet.has(id) : wordIdSet.has(id);
    });
  } else {
    // Migrazione una tantum dal vecchio ordine "solo progetti".
    const legacyOrder = orderOverrides["home.order"];
    rows = (legacyOrder && legacyOrder.length ? legacyOrder : projectSlugs)
      .filter((slug) => projectSlugSet.has(slug))
      .map((slug) => `p:${slug}`);
  }
  projectSlugs.forEach((slug) => {
    if (!rows.includes(`p:${slug}`)) rows.push(`p:${slug}`); // progetti nuovi in content.js, non ancora in "rows"
  });
  wordIds.forEach((id) => {
    if (!rows.includes(`w:${id}`)) rows.push(`w:${id}`); // parole appena aggiunte con "+"
  });
  return rows;
}

function getOrderedProjects() {
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
  return getHomeRows()
    .filter((tag) => tag.startsWith("p:"))
    .map((tag) => bySlug.get(tag.slice(2)))
    .filter(Boolean);
}

// L'ordine delle foto di una galleria (progetto o archivio), come array di
// indici ORIGINALI di content.js — es. [2,0,1] mostra prima la terza foto.
function currentImageOrder(key, length) {
  const stored = loadOrderOverrides()[key];
  if (stored && stored.length === length) return stored.slice();
  return Array.from({ length }, (_, i) => i);
}

/* -------------------------------------------------------------------------
   Eliminare una foto ("×") o aggiungerne una nuova ("+") in modalità
   modifica: il sito è statico, quindi non c'è modo di toccare per davvero
   content.js da qui — sono solo due salvataggi nel browser, esportabili
   come tutto il resto (vedi pannello "Esporta modifiche"). Una foto
   ORIGINALE di content.js non si può cancellare per davvero: eliminarla
   segna solo il suo id come "nascosto" (reversibile solo tramite "Reset
   modifiche", che azzera però anche ogni altra personalizzazione). Una
   foto AGGIUNTA con "+" invece non è mai esistita in content.js: è solo
   un segnaposto (stesso placeholder colorato che vedi quando "src" è
   null) con una didascalia, in attesa che tu carichi il file vero e lo
   riporti in content.js — eliminarla la toglie del tutto dalla lista.
   ------------------------------------------------------------------------- */
const REMOVED_STORE_KEY = "site-removed-images-v1";

function loadRemovedOverrides() {
  try {
    return JSON.parse(localStorage.getItem(REMOVED_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function removedIdsFor(key) {
  return loadRemovedOverrides()[key] || [];
}

function markImageRemoved(key, uid) {
  const all = loadRemovedOverrides();
  const list = all[key] || [];
  if (!list.includes(uid)) list.push(uid);
  all[key] = list;
  try {
    localStorage.setItem(REMOVED_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la rimozione resta comunque applicata per questa sessione */
  }
}

const EXTRA_IMAGES_STORE_KEY = "site-extra-images-v1";

function loadExtraImagesOverrides() {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_IMAGES_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function extraImagesFor(key) {
  return loadExtraImagesOverrides()[key] || [];
}

// Id leggibile e sicuramente diverso da un indice numerico di content.js
// (che userebbe solo cifre), così le due categorie non si confondono mai
// nelle chiavi di posizione/dimensione/didascalia che riusano questo id.
// La didascalia NON si salva qui: riusa CAPTION_STORE_KEY esattamente come
// le foto originali (stessa chiave "...captionText.<id>"), quindi un solo
// posto da cui leggerla, non due copie che potrebbero disallinearsi.
function addExtraImage(key) {
  const all = loadExtraImagesOverrides();
  const list = all[key] || [];
  const id = `new-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  list.push({ id });
  all[key] = list;
  try {
    localStorage.setItem(EXTRA_IMAGES_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la foto aggiunta resta comunque per questa sessione */
  }
  return id;
}

function removeExtraImage(key, id) {
  const all = loadExtraImagesOverrides();
  all[key] = (all[key] || []).filter((img) => img.id !== id);
  try {
    localStorage.setItem(EXTRA_IMAGES_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la rimozione resta comunque applicata per questa sessione */
  }
  // Una foto aggiunta con "+" non esiste in content.js: una volta
  // eliminata, il suo id (generato a caso) non si riuserà mai più — ripulisce
  // quindi anche didascalia/posizione/dimensione salvate per lei, altrimenti
  // resterebbero per sempre nello storage, orfane, senza nessuna foto reale
  // ad usarle (e comparirebbero comunque nel pannello "Esporta modifiche").
  clearCaptionOverride(`${key}.captionText.${id}`);
  clearPositionOverride(`${key}.captionPos.${id}`);
  clearPositionOverride(`${key}.imagePos.${id}`);
  clearSizeOverride(`${key}.image.${id}`);
  clearUploadedImage(key, id);
}

function isExtraImageId(id) {
  return typeof id === "string" && id.startsWith("new-");
}

/* -------------------------------------------------------------------------
   Foto caricate dal computer (click su "+" su un placeholder, o su una
   voce senza foto vera): il sito è statico, non c'è un server a cui
   mandarle, quindi la foto scelta viene ridotta (vedi
   downscaleImageFile) e tenuta come data-URL solo nel browser di chi
   l'ha caricata — una VERA anteprima, non solo un segnaposto colorato,
   ma visibile solo a te finché non prendi il file vero (vedi il pulsante
   "Scarica" nel pannello "Esporta modifiche") e lo carichi tu nel
   repository al posto del placeholder.
   ------------------------------------------------------------------------- */
const UPLOADED_IMAGE_STORE_KEY = "site-uploaded-images-v1";

function loadUploadedImages() {
  try {
    return JSON.parse(localStorage.getItem(UPLOADED_IMAGE_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function uploadedImagesFor(key) {
  return loadUploadedImages()[key] || {};
}

function saveUploadedImage(key, photoId, dataUrl) {
  const all = loadUploadedImages();
  all[key] = all[key] || {};
  all[key][photoId] = dataUrl;
  try {
    localStorage.setItem(UPLOADED_IMAGE_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    alert("La foto è troppo grande (o lo spazio del browser è pieno): riprova con un file più leggero.");
  }
}

function clearUploadedImage(key, photoId) {
  const all = loadUploadedImages();
  if (!all[key] || !(photoId in all[key])) return;
  delete all[key][photoId];
  try {
    localStorage.setItem(UPLOADED_IMAGE_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la rimozione resta comunque applicata per questa sessione */
  }
}

// Ridimensiona/comprime l'immagine scelta prima di salvarla come data-URL:
// una foto originale (anche 10+ MB) supererebbe rapidamente lo spazio che
// il browser concede a localStorage (in genere 5-10 MB in tutto, condiviso
// con OGNI altra modifica salvata su questo sito) e romperebbe l'intero
// meccanismo di salvataggio, non solo la foto stessa.
function downscaleImageFile(file, maxDim = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Lettura del file fallita"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("File non è un'immagine valida"));
      img.onload = () => {
        let { naturalWidth: width, naturalHeight: height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Un solo <input type="file"> nascosto, riusato per ogni "+": evita di
// crearne uno diverso per ogni foto della galleria.
let sharedUploadInput = null;
function promptImageUpload(onDone) {
  if (!sharedUploadInput) {
    sharedUploadInput = el("input", { type: "file", accept: "image/*" });
    sharedUploadInput.style.display = "none";
    document.body.appendChild(sharedUploadInput);
  }
  sharedUploadInput.value = ""; // permette di riselezionare subito lo stesso file
  sharedUploadInput.onchange = async () => {
    const file = sharedUploadInput.files[0];
    if (!file) return;
    try {
      const dataUrl = await downscaleImageFile(file);
      onDone(dataUrl);
    } catch (e) {
      alert("Non sono riuscito a leggere questa immagine. Prova con un altro file.");
    }
  };
  sharedUploadInput.click();
}

// Uno <span> condiviso, invisibile, mai rimosso dal DOM: misura la
// larghezza ESATTA (in pixel, con lo stesso font) di un testo, per dare a
// un <input> — che a differenza di un <a> non si allarga mai da solo al
// contenuto — la larghezza giusta per non tagliare mai il testo scritto.
let sharedMeasureSpan = null;
function measureTextWidth(text, font) {
  if (!sharedMeasureSpan) {
    sharedMeasureSpan = document.createElement("span");
    sharedMeasureSpan.style.cssText = "position:absolute; visibility:hidden; white-space:pre; top:-9999px; left:-9999px;";
    document.body.appendChild(sharedMeasureSpan);
  }
  sharedMeasureSpan.style.font = font;
  sharedMeasureSpan.textContent = text;
  return sharedMeasureSpan.offsetWidth;
}

// Applica a "input" la larghezza esatta del testo che contiene (o del
// placeholder, se è vuoto) — chiamata sia alla creazione sia ad ogni
// tasto premuto.
function syncWordInputWidth(input) {
  const cs = getComputedStyle(input);
  const text = input.value || input.getAttribute("placeholder") || "";
  const textWidth = measureTextWidth(text, cs.font);
  const extra =
    parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + 4;
  input.style.width = `${Math.max(textWidth + extra, 24)}px`;
}

/* -------------------------------------------------------------------------
   Parole extra in home page ("+ aggiungi una parola"): blocchi di testo
   liberi, indipendenti dalla lista progetti, per aggiungere qualunque
   scritta (una frase, una data, una firma...) senza toccare content.js —
   si trascinano ovunque (maniglia verde, stesso meccanismo di tutto il
   resto) e si scrivono in un <input> sempre visibile. A differenza delle
   foto aggiunte, qui non c'è una "voce di content.js" preesistente da
   rinominare: il testo stesso è il contenuto, quindi si salva
   direttamente in questo store invece di riusare CAPTION_STORE_KEY.
   ------------------------------------------------------------------------- */
const EXTRA_TEXT_STORE_KEY = "site-extra-text-v1";

function loadExtraTextOverrides() {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_TEXT_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function extraTextFor(key) {
  return loadExtraTextOverrides()[key] || [];
}

function addExtraText(key) {
  const all = loadExtraTextOverrides();
  const list = all[key] || [];
  const id = `word-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  list.push({ id, text: "" });
  all[key] = list;
  try {
    localStorage.setItem(EXTRA_TEXT_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la parola aggiunta resta comunque per questa sessione */
  }
  return id;
}

function saveExtraTextContent(key, id, text) {
  const all = loadExtraTextOverrides();
  const item = (all[key] || []).find((w) => w.id === id);
  if (!item) return;
  item.text = text;
  try {
    localStorage.setItem(EXTRA_TEXT_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: il testo resta comunque applicato per questa sessione */
  }
}

function removeExtraText(key, id) {
  const all = loadExtraTextOverrides();
  all[key] = (all[key] || []).filter((w) => w.id !== id);
  try {
    localStorage.setItem(EXTRA_TEXT_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la rimozione resta comunque applicata per questa sessione */
  }
  clearPositionOverride(`${key}.wordPos.${id}`);
}

// Migrazione una tantum: "bar", "fluoxetine", "licking", "moon",
// "plastic", "tower" e "compression", scritte a mano come parole in home,
// sono ora vere pagine progetto (foto caricate nel repository, vedi
// PROJECTS in content.js) — la vecchia "parola" con lo stesso nome
// (confronto senza maiuscole/spazi) diventerebbe un doppione che punta
// alla pagina-parola vuota invece che al progetto vero. La toglie una
// sola volta, per nome, senza toccare nessun'altra parola scritta.
(function removeWordsPromotedToProjectsOnce() {
  const FLAG_KEY = "site-words-promoted-v1";
  try {
    if (localStorage.getItem(FLAG_KEY)) return;
    const promotedNames = new Set(["bar", "fluoxetine", "licking", "moon", "plastic", "tower", "compression"]);
    extraTextFor("home").forEach((word) => {
      if (promotedNames.has(word.text.trim().toLowerCase())) removeExtraText("home", word.id);
    });
    localStorage.setItem(FLAG_KEY, "1");
  } catch (e) {
    /* storage non disponibile: non c'è nulla da migrare */
  }
})();

/* -------------------------------------------------------------------------
   Posizione libera a trascinamento (per ora solo le didascalie: si spostano
   indipendentemente dalla loro foto, non seguono l'ordine/resize della
   foto). A differenza di makeReorderable, qui non si scambia posto con un
   fratello: l'elemento si sposta liberamente di quanto trascinato.
   ------------------------------------------------------------------------- */
const POSITION_STORE_KEY = "site-position-overrides-v1";

function loadPositionOverrides() {
  try {
    return JSON.parse(localStorage.getItem(POSITION_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function savePositionOverride(key, pos) {
  const all = loadPositionOverrides();
  all[key] = pos;
  try {
    localStorage.setItem(POSITION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la posizione resta comunque applicata per questa sessione */
  }
}

function clearPositionOverride(key) {
  const all = loadPositionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    localStorage.setItem(POSITION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile */
  }
}

/* -------------------------------------------------------------------------
   Testo delle didascalie, se diverso da quello in content.js — scritto in
   un <input> dentro il rettangolo trascinabile della didascalia (vedi
   .caption-box/.caption-input più sotto).
   ------------------------------------------------------------------------- */
const CAPTION_STORE_KEY = "site-caption-overrides-v1";

function loadCaptionOverrides() {
  try {
    return JSON.parse(localStorage.getItem(CAPTION_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCaptionOverride(key, text) {
  const all = loadCaptionOverrides();
  all[key] = text;
  try {
    localStorage.setItem(CAPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: il testo resta comunque applicato per questa sessione */
  }
}

function clearCaptionOverride(key) {
  const all = loadCaptionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    localStorage.setItem(CAPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile */
  }
}

// Migrazione una tantum (gira una sola volta per browser, mai più dopo):
// le didascalie sono state ricostruite da zero, ma la posizione trascinata
// usa la stessa chiave ("...captionPos.N") delle versioni precedenti
// (prima col trascinamento libero poi tolto, poi rimesso). Chi aveva
// trascinato una didascalia in una di quelle versioni si ritroverebbe il
// nuovo rettangolo esattamente in quel punto — magari fuori dallo schermo
// visibile, sembrando "sparito". Si riparte puliti: posizione a zero per
// tutte, il testo che hai già scritto resta.
(function resetStaleCaptionPositionsOnce() {
  const FLAG_KEY = "site-caption-rebuild-v1";
  try {
    if (localStorage.getItem(FLAG_KEY)) return;
    const all = loadPositionOverrides();
    let changed = false;
    Object.keys(all).forEach((key) => {
      if (/\.captionPos\.\d+$/.test(key) || /\.caption\.\d+$/.test(key)) {
        delete all[key];
        changed = true;
      }
    });
    if (changed) localStorage.setItem(POSITION_STORE_KEY, JSON.stringify(all));
    localStorage.setItem(FLAG_KEY, "1");
  } catch (e) {
    /* storage non disponibile: non c'è nulla da migrare */
  }
})();

// Rende "node" spostabile liberamente (in alto/basso/sinistra/destra) con
// una maniglia verde dedicata, indipendente da resize. "key" identifica
// l'elemento (es. "project.lines.caption.0", indice ORIGINALE della foto,
// così la didascalia/foto resta legata alla foto giusta anche se le foto
// vengono riordinate altrove). Usata sia per le didascalie sia per le
// foto stesse: a differenza di makeReorderable (pensata per liste dove
// TUTTI i fratelli sono visibili fianco a fianco, come la lista home),
// qui non c'è alcun concetto di "ordine tra fratelli" — l'elemento si
// sposta di preciso dove lo trascini e resta lì, punto. Per le foto della
// galleria è la scelta giusta anche perché lì i fratelli non sono
// visibili tutti insieme (si vede una foto alla volta): un riordino
// "a soglia" richiederebbe di trascinare per centinaia di pixel prima di
// avere un effetto, e senza aver raggiunto la soglia l'elemento tornava
// sempre al punto di partenza — sembrava "magnetico"/rotto. Qui invece
// qualunque trascinamento, anche piccolo, sposta la foto esattamente lì
// e ce la lascia.
function makeMovableFree(node, key, title = "Trascina per spostare", { onMove, defaultOffset, dualHandles, alwaysVisible } = {}) {
  if (!node.style.position) node.style.position = "relative";

  // "defaultOffset" è la posizione di partenza quando non hai ancora
  // trascinato nulla TU in QUESTO browser (es. LAYOUT.gallery.imageOffset,
  // o l'"offset"/"captionOffset" di una singola voce di "images" in
  // content.js) — un trascinamento salvato la sovrascrive sempre.
  const pos = Object.assign({ x: 0, y: 0 }, defaultOffset, loadPositionOverrides()[key]);
  if (pos.x || pos.y) node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

  let dragState = null;
  let activeHandle = null;

  // "dualHandles" aggiunge una seconda maniglia speculare (a sinistra,
  // classe "move-handle-left" per il posizionamento CSS) — utile per le
  // didascalie, dove a seconda di dove le trascini quella di destra può
  // finire scomoda da raggiungere. Le due maniglie condividono lo stesso
  // trascinamento: quale delle due parte non fa differenza.
  function createHandle(extraClass) {
    const classes = `move-handle free-move${alwaysVisible ? " always-visible" : ""}${extraClass ? ` ${extraClass}` : ""}`;
    const h = el("div", { class: classes, title });
    node.appendChild(h);
    // Se "node" è (o sta dentro) un link — l'hamburger, es. — un clic sulla
    // maniglia senza spostamento (o al rilascio dopo un trascinamento)
    // farebbe comunque scattare la navigazione di default del link, dato
    // che pointerdown.preventDefault() non annulla anche il "click" che
    // arriva dopo. Va annullato qui, sul click stesso.
    h.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    h.addEventListener("pointerdown", (e) => {
      if (!alwaysVisible && !isEditMode()) return;
      // Se dentro "node" c'è un testo in modifica (es. la didascalia) con
      // ancora il cursore attivo, va salvato ORA: il preventDefault() qui
      // sotto impedisce anche lo sfocamento naturale che cliccando altrove
      // lo salverebbe da solo, quindi iniziare subito a trascinare senza
      // prima aver cliccato via avrebbe perso quello che hai appena scritto.
      if (document.activeElement && document.activeElement !== h && node.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      e.preventDefault();
      e.stopPropagation();
      activeHandle = h;
      dragState = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
      h.classList.add("is-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
    return h;
  }

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    pos.x = snapToGrid(dragState.baseX + (e.clientX - dragState.startX));
    pos.y = snapToGrid(dragState.baseY + (e.clientY - dragState.startY));
    node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    if (onMove) onMove();
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    if (activeHandle) activeHandle.classList.remove("is-dragging");
    activeHandle = null;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    dragState = null;
    savePositionOverride(key, { x: pos.x, y: pos.y });
  }

  createHandle();
  if (dualHandles) createHandle("move-handle-left");

  return {
    reset() {
      // Torna alla posizione di DEFAULT (LAYOUT/content.js), non a (0,0):
      // con un "defaultOffset" impostato, (0,0) non è affatto "nessuno
      // spostamento", è un punto arbitrario come un altro.
      const base = Object.assign({ x: 0, y: 0 }, defaultOffset);
      pos.x = base.x;
      pos.y = base.y;
      node.style.transform = pos.x || pos.y ? `translate(${pos.x}px, ${pos.y}px)` : "";
    },
  };
}

// Rende "item" trascinabile per riordinarlo tra i suoi fratelli dentro
// "container", lungo l'asse "axis" ('y' per la lista verticale della
// home — l'unico caso che la usa: le foto in galleria usano invece
// makeMovableFree, vedi lì il perché).
function makeReorderable(item, { container, axis, onReorder, handleParent }) {
  if (!item.style.position) item.style.position = "relative";
  const handle = el("div", { class: "move-handle", title: "Trascina per riordinare" });
  const anchor = handleParent || item;
  if (!anchor.style.position) anchor.style.position = "relative";
  anchor.appendChild(handle);

  let dragState = null;

  handle.addEventListener("pointerdown", (e) => {
    if (!isEditMode()) return;
    e.preventDefault();
    e.stopPropagation();
    dragState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPos: axis === "x" ? e.clientX : e.clientY,
      targetIndex: Array.from(container.children).indexOf(item),
    };
    item.classList.add("is-dragging-item");
    handle.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const pointerPos = axis === "x" ? e.clientX : e.clientY;
    const siblings = Array.from(container.children);
    item.style.transform = `translate(${e.clientX - dragState.startX}px, ${e.clientY - dragState.startY}px)`;

    dragState.targetIndex = siblings.filter((sib) => {
      if (sib === item) return false;
      const rect = sib.getBoundingClientRect();
      const mid = axis === "x" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
      return mid < pointerPos;
    }).length;
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    item.style.transform = "";
    item.classList.remove("is-dragging-item");
    handle.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);

    const fromIndex = Array.from(container.children).indexOf(item);
    const toIndex = dragState.targetIndex;
    dragState = null;
    if (toIndex != null && toIndex !== fromIndex) onReorder(fromIndex, toIndex);
  }
}

// Guide di allineamento in stile Photoshop: due "righelli" (in alto e a
// sinistra della pagina, solo in modalità modifica) da cui trascini fuori
// una linea — a differenza delle maniglie verdi/rosse (che spostano UN solo
// elemento), una guida è un riferimento condiviso da TUTTA la galleria:
// resta esattamente dove l'hai messa (stessa posizione per ogni foto, non
// una nuova per ciascuna) finché non la trascini altrove o la ributti sul
// righello di origine per toglierla — esattamente come in Photoshop.
// Serve solo da riferimento visivo per allineare a occhio; niente aggancio
// automatico.
const GUIDES_STORE_KEY = "site-guides-v1";
const GUIDE_RULER_SIZE = 14; // px, spessore dei righelli — deve combaciare con lo stesso valore in style.css

function loadGuides() {
  try {
    return JSON.parse(localStorage.getItem(GUIDES_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function guidesFor(galleryKey) {
  return loadGuides()[galleryKey] || [];
}

function saveGuidesFor(galleryKey, guides) {
  const all = loadGuides();
  if (guides.length) all[galleryKey] = guides;
  else delete all[galleryKey];
  try {
    localStorage.setItem(GUIDES_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: le guide restano comunque applicate per questa sessione */
  }
}

// "pageEl" è ".page" (var. globale "app"): le guide vivono nel suo sistema
// di coordinate (position: relative), così scorrono col resto della
// pagina invece di restare incollate al viewport.
function setupAlignmentGuides(pageEl, galleryKey) {
  let guides = guidesFor(galleryKey).map((g) => ({ ...g }));
  let nextId = guides.reduce((max, g) => Math.max(max, g.id), 0) + 1;

  const layer = el("div", { class: "guides-layer" });
  const rulerH = el("div", { class: "guide-ruler guide-ruler-h", title: "Trascina verso il basso: crea una guida orizzontale, condivisa da tutte le foto della galleria" });
  const rulerV = el("div", { class: "guide-ruler guide-ruler-v", title: "Trascina verso destra: crea una guida verticale, condivisa da tutte le foto della galleria" });

  function persist() {
    saveGuidesFor(galleryKey, guides.map(({ id, axis, pos }) => ({ id, axis, pos })));
  }

  function renderGuide(guide) {
    const isH = guide.axis === "h";
    const line = el("div", { class: `guide-line guide-line-${isH ? "h" : "v"}` });
    layer.appendChild(line);

    function place() {
      if (isH) line.style.top = `${guide.pos}px`;
      else line.style.left = `${guide.pos}px`;
    }
    place();

    let dragState = null;
    function onPointerMove(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      const delta = (isH ? e.clientY : e.clientX) - dragState.startClient;
      guide.pos = Math.max(0, dragState.startPos + delta);
      place();
      // Sopra al righello di origine: il rilascio la elimina (tinta rossa
      // di anteprima, stesso principio del cestino di Photoshop).
      const overRuler = isH ? e.clientY < GUIDE_RULER_SIZE : e.clientX < GUIDE_RULER_SIZE;
      line.classList.toggle("guide-will-delete", overRuler);
    }
    function onPointerUp(e) {
      if (!dragState || e.pointerId !== dragState.pointerId) return;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      line.classList.remove("is-dragging");
      const overRuler = isH ? e.clientY < GUIDE_RULER_SIZE : e.clientX < GUIDE_RULER_SIZE;
      dragState = null;
      line.classList.remove("guide-will-delete");
      if (overRuler) {
        guides = guides.filter((g) => g.id !== guide.id);
        line.remove();
      }
      persist();
    }
    line.addEventListener("pointerdown", (e) => {
      if (!isEditMode()) return;
      e.preventDefault();
      e.stopPropagation();
      dragState = { pointerId: e.pointerId, startClient: isH ? e.clientY : e.clientX, startPos: guide.pos };
      line.classList.add("is-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  }

  guides.forEach(renderGuide);

  function startNewGuide(axis, e) {
    if (!isEditMode()) return;
    e.preventDefault();
    const rect = pageEl.getBoundingClientRect();
    const guide = {
      id: nextId++,
      axis,
      pos: Math.max(0, axis === "h" ? e.clientY - rect.top : e.clientX - rect.left),
    };
    guides.push(guide);
    renderGuide(guide);
    // Continua subito lo stesso trascinamento sulla riga appena creata,
    // così la posizioni nel medesimo gesto con cui l'hai tirata fuori dal
    // righello invece di doverla ripescare in un secondo momento.
    layer.lastChild.dispatchEvent(
      new PointerEvent("pointerdown", { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, bubbles: true })
    );
  }
  rulerH.addEventListener("pointerdown", (e) => startNewGuide("h", e));
  rulerV.addEventListener("pointerdown", (e) => startNewGuide("v", e));

  document.body.appendChild(rulerH);
  document.body.appendChild(rulerV);
  pageEl.appendChild(layer);

  return {
    teardown() {
      rulerH.remove();
      rulerV.remove();
      layer.remove();
    },
  };
}

// Rende "node" ridimensionabile a trascinamento in modalità modifica.
// "key" identifica il blocco (es. "project.lines.image.0") per salvare e
// riproporre la dimensione scelta. "defaults" sono width/height di partenza
// (da LAYOUT o dal singolo progetto/foto in content.js). Se si passa
// "lockRatioTo" (l'elemento <img> dentro node), il blocco è una foto: le
// maniglie NON devono mai tagliarla, quindi ridimensionano SEMPRE
// mantenendo le proporzioni naturali della foto (la ingrandiscono o
// rimpiccioliscono nel suo insieme, non ne modificano l'inquadratura). In
// quel caso si aggiunge anche una seconda maniglia a sinistra, non solo
// quella di default a destra.
function makeResizable(node, key, defaults = {}, { lockRatioTo, onResizeEnd } = {}) {
  node.classList.add("resizable");
  if (!node.style.position) node.style.position = "relative";

  const overrides = loadSizeOverrides();
  const size = overrides[key] || {};
  const width = size.width || defaults.width;
  const height = size.height || defaults.height;
  if (width) node.style.width = width;
  if (height && height !== "auto") node.style.height = height;

  const label = el("span", { class: "resizable-label" }, "");
  node.appendChild(label);

  function updateLabel() {
    const r = node.getBoundingClientRect();
    label.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}px`;
  }
  updateLabel();

  const observer = new ResizeObserver(() => {
    updateLabel();
  });
  observer.observe(node);

  // Proporzioni naturali della foto (larghezza/altezza del file originale).
  // Se l'immagine non è ancora caricata (naturalWidth/Height a 0), usiamo
  // per quella sola volta le proporzioni attuali del riquadro come ripiego:
  // capita solo nella primissima interazione prima che la foto arrivi dalla
  // rete, e si autocorregge da sola al ridimensionamento successivo.
  function currentAspectRatio() {
    if (lockRatioTo && lockRatioTo.naturalWidth && lockRatioTo.naturalHeight) {
      return lockRatioTo.naturalWidth / lockRatioTo.naturalHeight;
    }
    const r = node.getBoundingClientRect();
    return r.width / r.height;
  }

  // Maniglia disegnata da noi (vedi commento in style.css sul perché non
  // usiamo il resize nativo del browser): trascinala per cambiare
  // larghezza/altezza. Funziona con mouse e dito (pointer events).
  // "signX" inverte il segno dello spostamento orizzontale per la maniglia
  // di sinistra, così trascinarla verso sinistra ingrandisce (e verso
  // destra rimpicciolisce), speculare rispetto a quella di destra.
  function addHandle(extraClass, signX) {
    const handle = el("div", { class: extraClass ? `resize-handle ${extraClass}` : "resize-handle" });
    node.appendChild(handle);

    let dragStart = null; // { pointerId, startX, startY, startWidth, startHeight, aspectRatio }

    function onPointerMove(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      const dx = (e.clientX - dragStart.startX) * signX;
      const newWidth = snapToGrid(Math.max(40, dragStart.startWidth + dx));
      let newHeight;
      if (dragStart.aspectRatio) {
        // Foto: l'altezza segue sempre la larghezza secondo il taglio
        // originale, non si tocca mai in modo indipendente (niente crop).
        newHeight = Math.max(40, Math.round(newWidth / dragStart.aspectRatio));
      } else {
        const dy = e.clientY - dragStart.startY;
        newHeight = snapToGrid(Math.max(40, dragStart.startHeight + dy));
      }
      node.style.width = `${newWidth}px`;
      node.style.height = `${newHeight}px`;
      updateLabel();
    }

    function onPointerUp(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      handle.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      saveSizeOverride(key, { width: node.style.width, height: node.style.height });
      dragStart = null;
      if (onResizeEnd) onResizeEnd();
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isEditMode()) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = node.getBoundingClientRect();
      dragStart = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        aspectRatio: lockRatioTo ? currentAspectRatio() : null,
      };
      handle.classList.add("is-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  }

  addHandle(null, 1);
  if (lockRatioTo) addHandle("resize-handle-left", -1);

  return observer;
}

// Blocco "vuoto" trascinabile in altezza (a differenza di makeResizable,
// che con la sua unica maniglia d'angolo cambia anche la larghezza — qui
// invece il blocco è sempre a piena larghezza, cambiarla non avrebbe
// senso). Usato per lasciare all'utente il controllo diretto di quanta
// aria vuole tra un blocco e l'altro (e quindi, di riflesso, di quanto
// allungare il "foglio" beige): di default alto 0px, cioè invisibile e
// senza alcun effetto finché non lo trascini tu stesso.
function makeHeightResizable(node, key, title = "Trascina per regolare lo spazio", defaultHeight = 0) {
  const saved = loadSizeOverrides()[key];
  node.style.height = (saved && saved.height) || `${defaultHeight}px`;

  const handle = el("div", { class: "resize-handle", title });
  node.appendChild(handle);

  let dragStart = null;

  function onPointerMove(e) {
    if (!dragStart || e.pointerId !== dragStart.pointerId) return;
    const dy = e.clientY - dragStart.startY;
    const newHeight = snapToGrid(Math.max(0, dragStart.startHeight + dy));
    node.style.height = `${newHeight}px`;
  }
  function onPointerUp(e) {
    if (!dragStart || e.pointerId !== dragStart.pointerId) return;
    handle.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    saveSizeOverride(key, { height: node.style.height });
    dragStart = null;
  }
  handle.addEventListener("pointerdown", (e) => {
    if (!isEditMode()) return;
    e.preventDefault();
    e.stopPropagation();
    dragStart = { pointerId: e.pointerId, startY: e.clientY, startHeight: node.getBoundingClientRect().height };
    handle.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });
}

// Etichetta leggibile per l'id di una foto nell'export: le foto originali
// di content.js hanno un indice numerico ("foto #3"), quelle aggiunte con
// "+" invece no (non esistono ancora lì) — il testo lo dice esplicitamente.
function photoLabel(id) {
  return isExtraImageId(id) ? `una foto aggiunta con "+" (vedi === FOTO NUOVE === più sotto)` : `foto #${Number(id) + 1}`;
}

function describeOverrideKey(key) {
  if (key === "home.list") return `LAYOUT.home  →  aggiorna listWidth/listHeight in content.js`;

  const descMatch = key.match(/^project\.(.+)\.description$/);
  if (descMatch) return `Progetto "${descMatch[1]}"  →  aggiungi/aggiorna "descriptionBox" su quel progetto in PROJECTS`;

  const imgMatch = key.match(/^project\.(.+)\.image\.([\w-]+)$/);
  if (imgMatch) return `Progetto "${imgMatch[1]}", ${photoLabel(imgMatch[2])}  →  aggiorna width/height su quella voce di "images"`;

  if (key === "archive.description") return `Core archive  →  aggiorna "descriptionBox" sull'oggetto ARCHIVE`;

  const archiveImgMatch = key.match(/^archive\.image\.([\w-]+)$/);
  if (archiveImgMatch) return `Core archive, ${photoLabel(archiveImgMatch[1])}  →  aggiorna width/height su quella voce di ARCHIVE.images`;

  if (key === "lightbox.image") return `Dimensione dell'ingrandimento (lightbox), uguale per tutte le foto  →  solo una preferenza salvata nel browser, non c'è un equivalente in content.js`;

  const spacerBeforeMatch = key.match(/^(?:project\.(.+)|(archive))\.spacerBeforeBar$/);
  if (spacerBeforeMatch) {
    const where = spacerBeforeMatch[1] ? `Progetto "${spacerBeforeMatch[1]}"` : "Core archive";
    return `${where}, spazio prima delle frecce  →  aggiorna LAYOUT.gallery.spacerBeforeBarHeight in content.js (vale per tutte le gallerie; qui conta solo "height")`;
  }

  const spacerBottomMatch = key.match(/^(?:project\.(.+)|(archive))\.spacerBottom$/);
  if (spacerBottomMatch) {
    const where = spacerBottomMatch[1] ? `Progetto "${spacerBottomMatch[1]}"` : "Core archive";
    return `${where}, spazio in fondo alla pagina  →  aggiorna LAYOUT.gallery.spacerBottomHeight in content.js (vale per tutte le gallerie; qui conta solo "height")`;
  }

  return key;
}

function describeOrderKey(key) {
  if (key === "home.order") return `Home  →  riordina l'array PROJECTS in content.js mettendo i progetti in quest'ordine`;

  if (key === "home.rows") {
    return `Home  →  sequenza combinata di progetti ("p:slug") e parole aggiunte ("w:id"): riordina PROJECTS in content.js seguendo solo le voci "p:", ignorando quelle "w:" (le parole non hanno un campo in content.js, vedi === PAROLE HOME === più sotto per il loro testo)`;
  }

  const imgOrderMatch = key.match(/^project\.(.+)\.imageOrder$/);
  if (imgOrderMatch) return `Progetto "${imgOrderMatch[1]}"  →  riordina l'array "images" mettendo le foto in quest'ordine (0 = prima foto originale, 1 = seconda, ...)`;

  if (key === "archive.imageOrder") return `Core archive  →  riordina l'array ARCHIVE.images mettendo le foto in quest'ordine (0 = prima foto originale, 1 = seconda, ...)`;

  return key;
}

function describePositionKey(key) {
  const captionPosMatch = key.match(/^project\.(.+)\.captionPos\.([\w-]+)$/);
  if (captionPosMatch) return `Progetto "${captionPosMatch[1]}", didascalia ${photoLabel(captionPosMatch[2])}  →  aggiungi "captionOffset: { x, y }" su quella voce di "images"`;

  const archiveCaptionPosMatch = key.match(/^archive\.captionPos\.([\w-]+)$/);
  if (archiveCaptionPosMatch) return `Core archive, didascalia ${photoLabel(archiveCaptionPosMatch[1])}  →  aggiungi "captionOffset: { x, y }" su quella voce di ARCHIVE.images`;

  const hamburgerMatch = key.match(/^(?:project\.(.+)|(archive)|simple\.(.+))\.hamburgerPos$/);
  if (hamburgerMatch) return `${hamburgerMatch[1] ? `Progetto "${hamburgerMatch[1]}"` : hamburgerMatch[2] ? "Core archive" : `Pagina "${hamburgerMatch[3]}"`}, hamburger  →  posizione solo visiva, nessun equivalente in content.js`;

  const imagePosMatch = key.match(/^project\.(.+)\.imagePos\.([\w-]+)$/);
  if (imagePosMatch) return `Progetto "${imagePosMatch[1]}", ${photoLabel(imagePosMatch[2])}  →  aggiungi "offset: { x, y }" su quella voce di "images"`;

  const archiveImagePosMatch = key.match(/^archive\.imagePos\.([\w-]+)$/);
  if (archiveImagePosMatch) return `Core archive, ${photoLabel(archiveImagePosMatch[1])}  →  aggiungi "offset: { x, y }" su quella voce di ARCHIVE.images`;

  const descPosMatch = key.match(/^project\.(.+)\.descriptionPos$/);
  if (descPosMatch) return `Progetto "${descPosMatch[1]}", testo  →  aggiungi "descriptionBox: { offset: { x, y } }" su quel progetto`;

  if (key === "archive.descriptionPos") return `Core archive, testo  →  aggiungi "descriptionBox: { offset: { x, y } }" su ARCHIVE`;

  const topbarIndexMatch = key.match(/^(?:project\.(.+)|(archive)|simple\.(.+))\.topbarIndexPos$/);
  if (topbarIndexMatch) {
    const where = topbarIndexMatch[1] ? `Progetto "${topbarIndexMatch[1]}"` : topbarIndexMatch[2] ? "Core archive" : `Pagina "${topbarIndexMatch[3]}"`;
    return `${where}, numero in alto  →  aggiorna LAYOUT.gallery.topbarIndexOffset in content.js (vale per tutte le pagine)`;
  }

  const topbarTitleMatch = key.match(/^(?:project\.(.+)|(archive)|simple\.(.+))\.topbarTitlePos$/);
  if (topbarTitleMatch) {
    const where = topbarTitleMatch[1] ? `Progetto "${topbarTitleMatch[1]}"` : topbarTitleMatch[2] ? "Core archive" : `Pagina "${topbarTitleMatch[3]}"`;
    return `${where}, titolo in alto  →  aggiorna LAYOUT.gallery.topbarTitleOffset in content.js (vale per tutte le pagine)`;
  }

  const bottomIndexMatch = key.match(/^(?:project\.(.+)|(archive))\.bottomIndexPos$/);
  if (bottomIndexMatch) {
    const where = bottomIndexMatch[1] ? `Progetto "${bottomIndexMatch[1]}"` : "Core archive";
    return `${where}, numero in basso  →  aggiorna LAYOUT.gallery.bottomIndexOffset in content.js (vale per tutte le gallerie)`;
  }

  const homeWordPosMatch = key.match(/^home\.wordPos\.([\w-]+)$/);
  if (homeWordPosMatch) return `Home, una parola aggiunta con "+"  →  vedi === PAROLE HOME === più sotto`;

  return key;
}

function describeCaptionKey(key) {
  const captionMatch = key.match(/^project\.(.+)\.captionText\.([\w-]+)$/);
  if (captionMatch) {
    return isExtraImageId(captionMatch[2])
      ? `Progetto "${captionMatch[1]}", ${photoLabel(captionMatch[2])}  →  usa questo testo come "caption" della nuova voce`
      : `Progetto "${captionMatch[1]}", ${photoLabel(captionMatch[2])}  →  aggiorna "caption" su quella voce di "images"`;
  }

  const archiveCaptionMatch = key.match(/^archive\.captionText\.([\w-]+)$/);
  if (archiveCaptionMatch) {
    return isExtraImageId(archiveCaptionMatch[1])
      ? `Core archive, ${photoLabel(archiveCaptionMatch[1])}  →  usa questo testo come "caption" della nuova voce`
      : `Core archive, ${photoLabel(archiveCaptionMatch[1])}  →  aggiorna "caption" su quella voce di ARCHIVE.images`;
  }

  const indexTextMatch = key.match(/^(?:project\.(.+)|(archive)|word\.(.+)|simple\.(.+))\.indexNumberText$/);
  if (indexTextMatch) {
    const where = indexTextMatch[1]
      ? `Progetto "${indexTextMatch[1]}"`
      : indexTextMatch[2]
      ? "Core archive"
      : indexTextMatch[3]
      ? `Pagina-parola "${indexTextMatch[3]}"`
      : `Pagina "${indexTextMatch[4]}"`;
    return `${where}, numero mostrato in alto/in basso  →  solo un'etichetta visiva, nessun equivalente in content.js`;
  }

  return key;
}

function describeRemovedKey(key) {
  const projMatch = key.match(/^project\.(.+)$/);
  if (projMatch) return `Progetto "${projMatch[1]}"  →  elimina (o commenta) queste voci dall'array "images"`;
  if (key === "archive") return `Core archive  →  elimina (o commenta) queste voci da ARCHIVE.images`;
  return key;
}

function describeExtraKey(key) {
  const projMatch = key.match(/^project\.(.+)$/);
  if (projMatch) return `Progetto "${projMatch[1]}"  →  aggiungi queste voci in fondo all'array "images", con "src" al posto di null quando carichi il file vero`;
  if (key === "archive") return `Core archive  →  aggiungi queste voci in fondo a ARCHIVE.images, con "src" al posto di null quando carichi il file vero`;
  return key;
}

function buildExportText() {
  const sizeOverrides = loadSizeOverrides();
  const orderOverrides = loadOrderOverrides();
  const positionOverrides = loadPositionOverrides();
  const captionOverrides = loadCaptionOverrides();
  const removedOverrides = loadRemovedOverrides();
  const extraOverrides = loadExtraImagesOverrides();
  const extraTextOverrides = loadExtraTextOverrides();
  const uploadedOverrides = loadUploadedImages();
  const sizeKeys = Object.keys(sizeOverrides);
  const orderKeys = Object.keys(orderOverrides);
  const positionKeys = Object.keys(positionOverrides);
  const captionKeys = Object.keys(captionOverrides);
  const removedKeys = Object.keys(removedOverrides).filter((k) => removedOverrides[k].length);
  const extraKeys = Object.keys(extraOverrides).filter((k) => extraOverrides[k].length);
  const extraTextKeys = Object.keys(extraTextOverrides).filter((k) => extraTextOverrides[k].length);
  const hasUploads = Object.keys(uploadedOverrides).some((k) => Object.keys(uploadedOverrides[k] || {}).length);

  if (
    !sizeKeys.length &&
    !orderKeys.length &&
    !positionKeys.length &&
    !captionKeys.length &&
    !removedKeys.length &&
    !extraKeys.length &&
    !extraTextKeys.length &&
    !hasUploads
  ) {
    return "Non hai ancora modificato nulla.\n\nAttiva la modalità modifica (bottone ⇲ in basso a destra): angolo in basso a destra = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta liberamente, × = elimina una foto, + = aggiungine una nuova, clicca su una didascalia per scriverla/correggerla. Poi torna qui.";
  }

  const lines = [
    "Modifiche personalizzate — copia i valori qui sotto (o manda a me",
    "questo testo) per aggiornare content.js e renderle permanenti sul",
    "sito pubblicato.",
    "",
  ];

  if (sizeKeys.length) {
    lines.push("=== DIMENSIONI ===", "");
    sizeKeys.forEach((key) => {
      const size = sizeOverrides[key];
      lines.push(`# ${describeOverrideKey(key)}`);
      lines.push(`  width: "${size.width || "auto"}", height: "${size.height || "auto"}"`);
      lines.push("");
    });
  }

  if (orderKeys.length) {
    lines.push("=== ORDINE ===", "");
    orderKeys.forEach((key) => {
      lines.push(`# ${describeOrderKey(key)}`);
      lines.push(`  ${JSON.stringify(orderOverrides[key])}`);
      lines.push("");
    });
  }

  if (positionKeys.length) {
    lines.push("=== POSIZIONE DIDASCALIE ===", "");
    positionKeys.forEach((key) => {
      const pos = positionOverrides[key];
      lines.push(`# ${describePositionKey(key)}`);
      lines.push(`  { x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)} }`);
      lines.push("");
    });
  }

  if (captionKeys.length) {
    lines.push("=== TESTO DIDASCALIE ===", "");
    captionKeys.forEach((key) => {
      lines.push(`# ${describeCaptionKey(key)}`);
      lines.push(`  caption: "${captionOverrides[key]}"`);
      lines.push("");
    });
  }

  if (removedKeys.length) {
    lines.push("=== FOTO ELIMINATE (×) ===", "");
    removedKeys.forEach((key) => {
      lines.push(`# ${describeRemovedKey(key)}`);
      removedOverrides[key].forEach((uid) => {
        if (uid === "description") {
          lines.push(`  blocco di testo (descrizione)  →  togli "description" da quel progetto in PROJECTS`);
          return;
        }
        const idMatch = uid.match(/^orig:(.+)$/);
        if (idMatch) lines.push(`  ${photoLabel(idMatch[1])}`);
      });
      lines.push("");
    });
  }

  if (extraKeys.length) {
    lines.push("=== FOTO NUOVE (+) ===", "");
    extraKeys.forEach((key) => {
      lines.push(`# ${describeExtraKey(key)}`);
      extraOverrides[key].forEach((extra) => {
        const caption = captionOverrides[`${key}.captionText.${extra.id}`] || "";
        lines.push(`  { caption: "${caption}", src: null },  // sostituisci "src" col percorso del file quando lo carichi`);
      });
      lines.push("");
    });
  }

  if (extraTextKeys.length) {
    lines.push("=== PAROLE HOME ===", "");
    lines.push("# Home  →  non hanno ancora un campo dedicato in content.js: mandami questo");
    lines.push("# testo in chat, aggiungo io il posto giusto dove tenerle (es. una lista in SITE)");
    extraTextKeys.forEach((key) => {
      extraTextOverrides[key].forEach((word) => {
        lines.push(`  "${word.text}"`);
      });
    });
    lines.push("");
  }

  return lines.join("\n");
}

// Le foto caricate con "+" (vedi UPLOADED_IMAGE_STORE_KEY) restano solo
// nel browser di chi le ha caricate: qui un link di download per ciascuna,
// così puoi salvarle sul tuo computer e caricarle tu nel repository al
// posto del placeholder — il testo dell'export non può contenerle (sono
// dati binari, non testo).
function buildUploadedPhotosSection() {
  const all = loadUploadedImages();
  const entries = [];
  Object.keys(all).forEach((galleryKey) => {
    Object.keys(all[galleryKey] || {}).forEach((photoId) => {
      entries.push({ galleryKey, photoId, dataUrl: all[galleryKey][photoId] });
    });
  });
  if (!entries.length) return null;

  const list = el(
    "ul",
    { class: "export-uploads-list" },
    entries.map((entry, i) => {
      const filename = `${entry.galleryKey.replace(/[^\w-]+/g, "-")}-${entry.photoId}.jpg`;
      const label = isExtraImageId(entry.photoId) ? "foto nuova" : photoLabel(entry.photoId);
      const link = el("a", { href: entry.dataUrl, download: filename }, `Scarica — ${entry.galleryKey}, ${label}`);
      return el("li", {}, [link]);
    })
  );
  return el("div", { class: "export-uploads" }, [
    el(
      "p",
      {},
      `Hai ${entries.length} foto caricate ("+" su un placeholder), visibili solo in questo browser: scaricale e caricale tu nel repository al posto del placeholder per renderle permanenti.`
    ),
    list,
  ]);
}

function openExportPanel() {
  const overlay = el("div", { class: "export-panel" });
  const textarea = el("textarea", { readonly: "readonly" });
  textarea.value = buildExportText();
  const uploadsSection = buildUploadedPhotosSection();

  const copyBtn = el("button", {}, "Copia");
  const resetBtn = el("button", {}, "Reset modifiche");
  const closeBtn = el("button", {}, "Chiudi");

  copyBtn.addEventListener("click", async () => {
    textarea.focus();
    textarea.select();
    try {
      await navigator.clipboard.writeText(textarea.value);
      copyBtn.textContent = "Copiato!";
      setTimeout(() => (copyBtn.textContent = "Copia"), 1500);
    } catch (e) {
      // clipboard API non disponibile (es. file://): il testo resta comunque selezionato, Ctrl+C funziona
    }
  });

  resetBtn.addEventListener("click", () => {
    localStorage.removeItem(SIZE_STORE_KEY);
    localStorage.removeItem(ORDER_STORE_KEY);
    localStorage.removeItem(POSITION_STORE_KEY);
    localStorage.removeItem(CAPTION_STORE_KEY);
    localStorage.removeItem(REMOVED_STORE_KEY);
    localStorage.removeItem(EXTRA_IMAGES_STORE_KEY);
    localStorage.removeItem(EXTRA_TEXT_STORE_KEY);
    localStorage.removeItem(UPLOADED_IMAGE_STORE_KEY);
    localStorage.removeItem(GUIDES_STORE_KEY);
    location.reload();
  });

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const inner = el(
    "div",
    { class: "export-panel-inner" },
    [
      el("h2", {}, "Esporta modifiche"),
      el("p", {}, "Queste sono le dimensioni e l'ordine che hai regolato trascinando. Copiali (o mandami questo testo in chat) per renderli permanenti sul sito pubblicato."),
      textarea,
      uploadsSection,
      el("div", { class: "export-panel-actions" }, [copyBtn, resetBtn, closeBtn]),
    ].filter(Boolean)
  );
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}

// Il bottone di modifica e quello di esportazione restano identici tra una
// pagina e l'altra: si creano una volta sola, non li ricrea il router.
let editModeUIReady = false;
function ensureEditModeUI() {
  if (editModeUIReady) return;
  editModeUIReady = true;

  const toggle = el("button", { class: "edit-toggle", "aria-label": "Modifica", title: "Modifica: angolo = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta liberamente, × = elimina una foto, + = aggiungine una nuova, clicca su una didascalia per scriverla/correggerla" }, "⇲");
  const exportBtn = el("button", { class: "export-toggle", "aria-label": "Esporta modifiche", title: "Esporta modifiche" }, "⇩");

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("edit-mode");
    document.querySelectorAll(".photo .caption-input, .home-word-input, .topbar-index-input").forEach((input) => {
      input.readOnly = !isEditMode();
    });
  });
  exportBtn.addEventListener("click", () => openExportPanel());

  document.body.appendChild(toggle);
  document.body.appendChild(exportBtn);
}

/* -------------------------------------------------------------------------
   4. Lightbox — clic su una foto per ingrandirla (solo la foto, sfondo
   scuro come il resto del sito, non a tutto schermo: l'immagine resta
   contenuta con un margine). Disattivo in modalità modifica, per non
   aprirlo per sbaglio mentre si trascina una maniglia di resize.
   ------------------------------------------------------------------------- */
// Chiave UNICA e condivisa da tutte le foto: la misura scelta trascinando
// la maniglia si applica a ogni foto che apri dopo (non è per-foto), così
// tutte le foto ingrandite hanno una dimensione coerente fra loro.
const LIGHTBOX_SIZE_KEY = "lightbox.image";

// Maniglia di resize sempre visibile (non solo in modalità modifica): a
// differenza di makeResizable, qui non c'è un "sito in modalità modifica"
// da attivare prima — il lightbox è già di per sé una vista a parte,
// raggiungibile solo aprendo una foto, quindi la maniglia per decidere
// quanto deve essere grande lo zoom è sempre lì, pronta all'uso.
function makeLightboxResizable(frame, img, { onResizeEnd } = {}) {
  const handle = el("div", { class: "resize-handle always-visible" });
  frame.appendChild(handle);
  handle.addEventListener("click", (e) => e.stopPropagation()); // non deve mai chiudere il lightbox

  let dragStart = null;

  function onPointerMove(e) {
    if (!dragStart || e.pointerId !== dragStart.pointerId) return;
    const dx = e.clientX - dragStart.startX;
    const newWidth = Math.max(120, dragStart.startWidth + dx);
    const newHeight = Math.round(newWidth / dragStart.aspectRatio);
    frame.style.width = `${Math.round(newWidth)}px`;
    frame.style.height = `${newHeight}px`;
  }
  function onPointerUp(e) {
    if (!dragStart || e.pointerId !== dragStart.pointerId) return;
    handle.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    saveSizeOverride(LIGHTBOX_SIZE_KEY, { width: frame.style.width, height: frame.style.height });
    dragStart = null;
    // Il riquadro resta centrato dal flex del lightbox: se si restringe,
    // il bordo che stai trascinando si sposta di MENO di quanto ti sei
    // mosso tu col mouse (il centro non si muove, quindi ogni bordo fa
    // solo metà strada). La maniglia, agganciata al bordo, resta quindi
    // "indietro" rispetto al cursore, e il rilascio del clic finisce per
    // cadere sul riquadro invece che su di lei: onResizeEnd avvisa
    // openLightbox di ignorare quell'unico clic (altrimenti chiuderebbe
    // il lightbox appena finito di ridimensionare).
    if (onResizeEnd) onResizeEnd();
  }
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = frame.getBoundingClientRect();
    dragStart = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: rect.width,
      aspectRatio: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : rect.width / rect.height,
    };
    handle.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });
}

// Apertura/chiusura di un lightbox (foto o testo) con una breve dissolvenza
// + leggero ingrandimento invece di comparire/sparire di scatto — vedi
// ".lightbox.is-open" in style.css. Il doppio requestAnimationFrame serve
// perché il browser deve prima dipingere lo stato INIZIALE (opacità 0)
// prima che aggiungere la classe scateni davvero la transizione: farlo
// nello stesso frame in cui l'elemento viene creato la salterebbe del
// tutto (nessuna dissolvenza visibile).
const LIGHTBOX_FADE_MS = 220;

function animateLightboxOpen(overlay) {
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add("is-open")));
}

function closeLightboxOverlay(overlay, cleanup) {
  if (overlay.classList.contains("is-closing")) return;
  overlay.classList.add("is-closing");
  overlay.classList.remove("is-open");
  if (cleanup) cleanup();
  setTimeout(() => overlay.remove(), LIGHTBOX_FADE_MS);
}

function openLightbox(src, alt) {
  const img = el("img", { src, alt: alt || "" });
  const frame = el("div", { class: "lightbox-frame" }, [img]);
  const guideV = el("div", { class: "lightbox-guide lightbox-guide-v" });
  const guideH = el("div", { class: "lightbox-guide lightbox-guide-h" });
  const overlay = el("div", { class: "lightbox" }, [frame, guideV, guideH]);
  const closeBtn = el("button", { class: "lightbox-close", "aria-label": "Chiudi" }, "×");

  // Dimensione di default: la foto quanto più grande possibile restando
  // interamente visibile nello spazio disponibile (esattamente come
  // "contain" — nessun taglio). Se hai già trascinato la maniglia in
  // precedenza, si usa invece quella misura per tutte le foto.
  function applyDefaultSize() {
    const saved = loadSizeOverrides()[LIGHTBOX_SIZE_KEY];
    if (saved && saved.width && saved.height) {
      frame.style.width = saved.width;
      frame.style.height = saved.height;
      return;
    }
    if (!img.naturalWidth || !img.naturalHeight) return; // non ancora caricata: riproviamo al load
    const availableWidth = window.innerWidth - 96; // 48px di padding di .lightbox per lato
    const availableHeight = window.innerHeight - 96;
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = availableWidth;
    let h = w / ratio;
    if (h > availableHeight) {
      h = availableHeight;
      w = h * ratio;
    }
    frame.style.width = `${Math.round(w)}px`;
    frame.style.height = `${Math.round(h)}px`;
  }
  if (img.complete) applyDefaultSize();
  img.addEventListener("load", applyDefaultSize);
  // Solo se NON hai già impostato tu una misura: la ridisegna quando
  // ridimensioni la finestra del browser mentre il lightbox è aperto.
  function onWindowResize() {
    if (!loadSizeOverrides()[LIGHTBOX_SIZE_KEY]) applyDefaultSize();
  }
  window.addEventListener("resize", onWindowResize);

  let justResized = false;
  makeLightboxResizable(frame, img, { onResizeEnd: () => { justResized = true; } });

  function close() {
    closeLightboxOverlay(overlay, () => {
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("keydown", onKeydown);
    });
  }
  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    // Il clic che chiude il rilascio della maniglia di resize non deve
    // chiudere anche il lightbox — vedi il commento in makeLightboxResizable.
    if (justResized) { justResized = false; return; }
    if (e.target.closest(".resize-handle")) return;
    close();
  });
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  document.addEventListener("keydown", onKeydown);

  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  animateLightboxOpen(overlay);
}

// Stesso "zoom" delle foto, applicato al blocco di testo che scorre in
// verticale: click fuori dalla modalità modifica apre il testo per
// intero, ingrandito, in un overlay identico (stessa dissolvenza, stesso
// "click ovunque per chiudere", stesso tasto Esc) — solo il contenuto
// cambia (testo invece di un'immagine).
function openTextLightbox(paragraphs, sizeKeyPrefix) {
  const content = el(
    "div",
    { class: "lightbox-text-content" },
    paragraphs.map((p) => el("p", {}, p))
  );
  const textBox = el("div", { class: "lightbox-text" }, [content]);
  const overlay = el("div", { class: "lightbox lightbox-text-overlay" }, [textBox]);
  const closeBtn = el("button", { class: "lightbox-close", "aria-label": "Chiudi" }, "×");

  // Maniglia sempre visibile (come quella di resize nel lightbox foto, vedi
  // makeLightboxResizable): qui non ha senso legarla alla modalità modifica
  // del sito, perché l'unico momento in cui ha senso aggiustare la
  // posizione del testo ingrandito è mentre lo guardi davvero ingrandito.
  if (sizeKeyPrefix) {
    makeMovableFree(content, `${sizeKeyPrefix}.descriptionZoomPos`, "Trascina per spostare il testo ingrandito", {
      alwaysVisible: true,
    });
  }

  function close() {
    closeLightboxOverlay(overlay, () => {
      document.removeEventListener("keydown", onKeydown);
    });
  }
  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", () => close());
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  document.addEventListener("keydown", onKeydown);

  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
  animateLightboxOpen(overlay);
}

function makeZoomable(frame, img) {
  frame.addEventListener("click", () => {
    if (isEditMode()) return;
    openLightbox(img.src, img.alt);
  });
}

/* -------------------------------------------------------------------------
   5. Placeholder immagini
   ------------------------------------------------------------------------- */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Genera una foto segnaposto come SVG in data-URI: colore stabile in base al
// seed, così ogni foto ha una sua tinta riconoscibile. Quando hai le foto
// vere, sostituisci "src" in content.js e questa funzione non verrà più
// chiamata per quell'immagine.
function placeholderImg(seed, label) {
  const hue = hashString(seed) % 360;
  const bg1 = `hsl(${hue}, 28%, 78%)`;
  const bg2 = `hsl(${(hue + 40) % 360}, 22%, 62%)`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${bg1}" />
          <stop offset="1" stop-color="${bg2}" />
        </linearGradient>
      </defs>
      <rect width="1000" height="1400" fill="url(#g)" />
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="monospace" font-size="28" fill="rgba(0,0,0,0.35)">${label}</text>
    </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function resolveImageSrc(seed, index, image) {
  return image.src || placeholderImg(`${seed}-${index}`, image.caption || `${seed} ${index + 1}`);
}

/* -------------------------------------------------------------------------
   6. Render: HOME — lista statica, dimensioni da LAYOUT.home
   ------------------------------------------------------------------------- */
function renderHome() {
  app.innerHTML = "";
  app.classList.remove("has-fixed-bars");
  ensureEditModeUI();

  const header = el("header", { class: "home-header" }, [
    el("span", { class: "kicker" }, SITE.kicker),
    el("span", { class: "author" }, SITE.author),
  ]);

  // Una riga per ogni progetto O parola aggiunta con "+", nell'ordine
  // combinato di getHomeRows() — vedi il commento lì sopra sul perché non
  // sono più due meccanismi separati.
  const projectBySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
  const wordTextById = new Map(extraTextFor("home").map((w) => [w.id, w.text]));
  const rows = getHomeRows();

  const listItems = rows.map((tag) => {
    const id = tag.slice(2);
    if (tag.startsWith("p:")) {
      const project = projectBySlug.get(id);
      return el("li", {}, [el("a", { href: `#/project/${project.slug}` }, project.name)]);
    }
    const input = el("input", {
      type: "text",
      class: "home-word-input",
      placeholder: "scrivi qui",
      // .trim() anche qui, non solo al salvataggio: ripulisce da solo uno
      // spazio iniziale/finale salvato in precedenza (es. da un tocco
      // accidentale della barra spaziatrice) senza dover riscrivere la
      // parola — è quello che disallineava leggermente il testo rispetto
      // ai nomi dei progetti nella stessa lista.
      value: (wordTextById.get(id) || "").trim(),
    });
    input.readOnly = !isEditMode();
    input.addEventListener("input", () => {
      saveExtraTextContent("home", id, input.value.trim());
      syncWordInputWidth(input);
    });
    // Fuori dalla modalità modifica la parola è un link vero, verso la
    // stessa pagina di default di un progetto (vedi renderWordPage) — il
    // mousedown blocca solo il focus/cursore (altrimenti un <input> in
    // lettura prenderebbe comunque il focus al click), non il click stesso.
    input.addEventListener("mousedown", (e) => {
      if (!isEditMode()) e.preventDefault();
    });
    input.addEventListener("click", () => {
      if (isEditMode()) return;
      location.hash = `#/word/${id}`;
    });
    const deleteBtn = el(
      "button",
      { type: "button", class: "home-word-delete-btn", title: "Elimina questa parola", "aria-label": "Elimina questa parola" },
      "×"
    );
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditMode()) return;
      removeExtraText("home", id);
      renderRoute();
    });
    return el("li", { class: "home-word-row" }, [input, deleteBtn]);
  });
  const list = el("ul", { class: "home-list" }, listItems);

  listItems.forEach((li) => {
    makeReorderable(li, {
      container: list,
      axis: "y",
      onReorder: (from, to) => {
        const newRows = rows.slice();
        const [moved] = newRows.splice(from, 1);
        newRows.splice(to, 0, moved);
        saveOrderOverride(HOME_ROWS_KEY, newRows);
        renderRoute();
      },
    });
  });

  // "+ aggiungi una parola": la nuova riga entra in fondo alla lista,
  // pronta da trascinare con la stessa maniglia blu di riordino — non più
  // in un punto qualunque della pagina, ma esattamente dove la sposti tra
  // le altre.
  const addWordBtn = el("button", { type: "button", class: "home-add-word-btn" }, "+ aggiungi una parola");
  addWordBtn.addEventListener("click", () => {
    if (!isEditMode()) return;
    addExtraText("home");
    renderRoute();
  });

  const spacer = el("div", { class: "home-spacer" });

  const footer = el(
    "footer",
    { class: "home-footer" },
    FOOTER_LINKS.map((l) => el("a", { href: l.hash, class: "footer-link" }, l.label))
  );

  app.appendChild(header);
  app.appendChild(list);
  app.appendChild(addWordBtn);
  app.appendChild(spacer);
  app.appendChild(footer);

  // La larghezza va misurata ORA che gli <input> sono davvero nel
  // documento (con il font vero, ereditato) — prima di essere agganciati
  // al DOM, "getComputedStyle" non avrebbe ancora il font giusto da
  // misurare.
  list.querySelectorAll(".home-word-input").forEach((input) => syncWordInputWidth(input));

  const resizeObserver = makeResizable(list, "home.list", LAYOUT.home);

  currentTeardown = () => resizeObserver.disconnect();
}

/* -------------------------------------------------------------------------
   7. Render: GALLERY (usata sia per i progetti sia per "core archive")
   Le foto scorrono in ORIZZONTALE (slide) tra loro; la pagina scorre in
   VERTICALE quando testo o foto corrente non entrano nello schermo. Clic su
   una foto la ingrandisce (lightbox).

   Le frecce in basso, per un progetto, portano al progetto precedente/
   successivo (passa "projectNav"); per core archive, invece, scorrono le
   foto della selezione (projectNav assente).
   ------------------------------------------------------------------------- */
// Barra in alto (numero + titolo + hamburger "torna alla home"), identica
// tra una pagina di galleria e una pagina semplice (contacts/about/not
// found) a parte i testi e il prefisso delle chiavi di posizione salvate:
// costruita qui una sola volta invece che duplicata in renderGallery e
// renderSimplePage.
function buildTopbar(keyPrefix, indexText, titleText, { onIndexChange } = {}) {
  // Il numero mostrato in alto era un testo fisso (sempre "1" su una
  // pagina-parola, dato che parte sempre con una sola foto) — ora è un
  // <input> scrivibile in modalità modifica, stesso meccanismo di
  // didascalie/parole (si salva ad ogni tasto premuto, riusa lo stesso
  // store). Sta DENTRO ".topbar-index" (che resta il contenitore su cui
  // agganciare la maniglia verde) invece di essere lui stesso l'elemento
  // spostabile: un <input> non può avere figli, quindi non potrebbe mai
  // contenere la maniglia.
  const indexKey = `${keyPrefix}.indexNumberText`;
  const savedIndexText = loadCaptionOverrides()[indexKey];
  const resolvedIndexText = savedIndexText != null ? savedIndexText : indexText;
  const indexInput = el("input", { type: "text", class: "topbar-index-input", value: resolvedIndexText });
  indexInput.readOnly = !isEditMode();
  indexInput.addEventListener("input", () => {
    const text = indexInput.value.trim();
    if (text) saveCaptionOverride(indexKey, text);
    else clearCaptionOverride(indexKey);
    if (onIndexChange) onIndexChange(indexInput.value);
  });
  const topbarIndexEl = el("span", { class: "topbar-index" }, [indexInput]);
  const topbarTitleEl = el("span", { class: "topbar-title" }, titleText);
  const hamburgerEl = el("a", { href: "#/", class: "hamburger", "aria-label": "Torna alla home" }, [
    el("span", {}), el("span", {}), el("span", {}),
  ]);
  makeMovableFree(topbarIndexEl, `${keyPrefix}.topbarIndexPos`, "Trascina per spostare il numero", {
    defaultOffset: LAYOUT.gallery.topbarIndexOffset,
  });
  makeMovableFree(topbarTitleEl, `${keyPrefix}.topbarTitlePos`, "Trascina per spostare il titolo", {
    defaultOffset: LAYOUT.gallery.topbarTitleOffset,
  });
  makeMovableFree(hamburgerEl, `${keyPrefix}.hamburgerPos`, "Trascina per spostare l'hamburger", {
    defaultOffset: LAYOUT.gallery.hamburgerOffset,
  });
  const topbar = el("div", { class: "topbar" }, [
    el("div", { class: "topbar-row" }, [topbarIndexEl]),
    el("div", { class: "topbar-row" }, [
      topbarTitleEl,
      hamburgerEl,
    ]),
  ]);
  return { topbar, resolvedIndexText };
}

function renderGallery({ indexNumber, title, description, descriptionBox, images, projectNav, galleryKey }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  ensureEditModeUI();

  const resizeObservers = [];
  // "galleryKey" identifica in modo univoco QUESTA galleria per tutte le
  // chiavi di salvataggio (dimensioni, posizioni, didascalie, foto extra):
  // deve essere passato esplicitamente da chi chiama renderGallery — MAI
  // dedotto da "projectNav" con un default implicito "se non è un
  // progetto allora è core archive", perché non è più vero (vedi
  // renderWordPage): due gallerie diverse con lo stesso sizeKeyPrefix si
  // scriverebbero a vicenda le foto/didascalie senza che nessuna delle
  // due lo sappia.
  const sizeKeyPrefix = galleryKey;
  // Riusa lo stesso meccanismo delle foto eliminate (REMOVED_STORE_KEY):
  // "description" è un id speciale, non un indice di foto, per la stessa
  // galleria — un blocco di testo tolto così non torna più finché non fai
  // "Reset modifiche" (nessun altro modo di recuperarlo, stessa scelta già
  // fatta per le foto).
  const descriptionRemoved = removedIdsFor(sizeKeyPrefix).includes("description");

  let bottomIndexEl; // assegnato più sotto, ma la callback lo usa solo su un futuro "input" dell'utente
  const { topbar, resolvedIndexText } = buildTopbar(sizeKeyPrefix, String(indexNumber), title, {
    onIndexChange: (text) => { if (bottomIndexEl) bottomIndexEl.textContent = text; },
  });

  // Il testo scorre SEMPRE, lentissimo — un movimento ambientale continuo,
  // non solo un modo per non perdere contenuto: anche quando il blocco è
  // già alto abbastanza da contenere tutto (il caso di default, vedi più
  // sotto), scorre comunque piano piano. Il contenuto è ripetuto due
  // volte in fila dentro ".description-track": la seconda copia (nascosta
  // a chi usa uno screen reader) prende il posto della prima esattamente
  // quando questa esce di scena, quindi il giro si ripete senza scatti
  // visibili.
  const defaultDescHeight = (descriptionBox && descriptionBox.height) || LAYOUT.gallery.descriptionHeight;
  const hasExplicitDescHeight = Boolean(defaultDescHeight || loadSizeOverrides()[`${sizeKeyPrefix}.description`]?.height);
  const makeParagraphs = () => description.map((paragraph) => el("p", {}, paragraph));
  const secondCopy = makeParagraphs();
  secondCopy.forEach((p) => p.setAttribute("aria-hidden", "true"));
  const descTrack = el("div", { class: "description-track" }, [...makeParagraphs(), ...secondCopy]);
  const descBlock = el("div", { class: "description" }, [descTrack]);
  resizeObservers.push(
    makeResizable(descBlock, `${sizeKeyPrefix}.description`, {
      width: (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
      height: defaultDescHeight,
    })
  );
  makeMovableFree(descBlock, `${sizeKeyPrefix}.descriptionPos`, "Trascina per spostare il testo", {
    defaultOffset: (descriptionBox && descriptionBox.offset) || LAYOUT.gallery.descriptionOffset,
  });
  const descDeleteBtn = el(
    "button",
    { type: "button", class: "description-delete-btn", title: "Elimina il blocco di testo", "aria-label": "Elimina il blocco di testo" },
    "×"
  );
  descDeleteBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isEditMode()) return;
    if (!confirm("Eliminare il blocco di testo della descrizione?")) return;
    markImageRemoved(sizeKeyPrefix, "description");
    renderRoute();
  });
  descBlock.appendChild(descDeleteBtn);

  const captionOverrides = loadCaptionOverrides();

  const figures = images.map((image, i) => {
    const origIndex = image._index != null ? image._index : i;
    const img = el("img", { src: image._src, alt: image.caption || "", loading: i === 0 ? "eager" : "lazy" });
    const frame = el("div", { class: "photo-frame" }, [img]);

    // Didascalia: un rettangolo sempre presente nella struttura della
    // pagina (mai nascosto, non importa se è vuoto o meno), che si
    // trascina con la maniglia verde. Il testo è un normale <input>, non
    // un contentEditable: si salva a ogni tasto premuto (evento "input"),
    // non solo quando perdi il focus — niente più testo perso se prendi
    // la maniglia per trascinarlo subito dopo aver scritto, e niente più
    // trucchi CSS ":empty"/"::before" per il segnaposto o per nasconderlo.
    const captionKey = `${sizeKeyPrefix}.captionText.${origIndex}`;
    const captionOverride = captionOverrides[captionKey];
    const captionText = captionOverride != null ? captionOverride : image.caption || "";
    const captionInput = el("input", {
      type: "text",
      class: "caption-input",
      placeholder: "scrivi qui la didascalia",
      value: captionText,
    });
    captionInput.readOnly = !isEditMode();
    captionInput.addEventListener("input", () => {
      const text = captionInput.value.trim();
      if (text) saveCaptionOverride(captionKey, text);
      else clearCaptionOverride(captionKey);
    });
    const figcaption = el("figcaption", { class: "caption-box" }, [captionInput]);
    const captionMove = makeMovableFree(
      figcaption,
      `${sizeKeyPrefix}.captionPos.${origIndex}`,
      "Trascina per spostare la didascalia",
      {
        // Ricalcola l'altezza del viewport ad ogni istante del trascinamento,
        // non solo al rilascio: altrimenti, per tutta la durata del drag, il
        // pezzo di didascalia che via via esce dall'altezza calcolata finora
        // resterebbe tagliato da "overflow: hidden" finché non la rilasci.
        onMove: () => { if (i === current) updateViewportHeight(); },
        defaultOffset: image.captionOffset || LAYOUT.gallery.captionOffset,
        dualHandles: true,
      }
    );

    resizeObservers.push(
      makeResizable(
        frame,
        `${sizeKeyPrefix}.image.${origIndex}`,
        // Niente default qui: se non c'è né un salvataggio né una misura
        // esplicita in content.js, l'altezza la calcola/applica
        // applyDefaultPhotoHeights() più sotto (stessa altezza per tutte
        // le foto, in base allo spazio lasciato libero dal testo).
        { width: image.width, height: image.height },
        {
          lockRatioTo: img,
          onResizeEnd: () => {
            clearPositionOverride(`${sizeKeyPrefix}.captionPos.${origIndex}`);
            captionMove.reset();
          },
        }
      )
    );
    makeZoomable(frame, img);
    makeMovableFree(frame, `${sizeKeyPrefix}.imagePos.${origIndex}`, "Trascina per spostare la foto", {
      onMove: () => { if (i === current) updateViewportHeight(); },
      defaultOffset: image.offset || LAYOUT.gallery.imageOffset,
    });

    // "×" elimina questa foto, "+" ne aggiunge una nuova (segnaposto,
    // stesso meccanismo di "src: null" già usato per le foto non ancora
    // caricate) subito dopo — solo in modalità modifica, vedi il
    // commento su REMOVED_STORE_KEY/EXTRA_IMAGES_STORE_KEY più in alto.
    const deleteBtn = el(
      "button",
      { type: "button", class: "photo-delete-btn", title: "Elimina questa foto", "aria-label": "Elimina questa foto" },
      "×"
    );
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditMode()) return;
      if (!confirm("Eliminare questa foto dalla galleria?")) return;
      if (image._extra) removeExtraImage(sizeKeyPrefix, origIndex);
      else markImageRemoved(sizeKeyPrefix, `orig:${origIndex}`);
      renderRoute();
    });
    const addBtn = el(
      "button",
      {
        type: "button",
        class: "photo-add-btn",
        title: image._isPlaceholder ? "Carica una foto per questo segnaposto" : "Carica una nuova foto qui accanto",
        "aria-label": "Carica una foto",
      },
      "+"
    );
    addBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditMode()) return;
      // Se la foto attuale è un segnaposto (nessun "src" reale, né già
      // caricato), il "+" carica un file per RIEMPIRE proprio questo
      // segnaposto; altrimenti si comporta come prima e ne aggiunge uno
      // nuovo subito dopo, già con la foto scelta dentro (non più un
      // segnaposto vuoto da riempire con un secondo clic).
      promptImageUpload((dataUrl) => {
        if (image._isPlaceholder) {
          saveUploadedImage(sizeKeyPrefix, origIndex, dataUrl);
        } else {
          const newId = addExtraImage(sizeKeyPrefix);
          saveUploadedImage(sizeKeyPrefix, newId, dataUrl);
        }
        renderRoute();
      });
    });
    frame.appendChild(deleteBtn);
    frame.appendChild(addBtn);

    return el("figure", { class: "photo", "data-index": i }, [frame, figcaption]);
  });

  const track = el("div", { class: "photo-track" }, figures);
  const viewport = el("div", { class: "photo-viewport" }, [track]);

  const prevBtn = el("button", { class: "nav-arrow prev", "aria-label": "Precedente" }, "←");
  const nextBtn = el("button", { class: "nav-arrow next", "aria-label": "Successivo" }, "→");
  bottomIndexEl = el("span", { class: "topbar-index" }, resolvedIndexText);
  // Un tentativo di allinearlo automaticamente alla stessa colonna del
  // numero in alto si è rivelato fragile (se il numero in alto è stato a
  // sua volta trascinato in precedenza, l'allineamento "automatico" non
  // corrisponde più a quello che vedi davvero): meglio una maniglia verde
  // come le altre, così lo allinei tu guardando lo schermo.
  makeMovableFree(bottomIndexEl, `${sizeKeyPrefix}.bottomIndexPos`, "Trascina per spostare/allineare il numero", {
    defaultOffset: LAYOUT.gallery.bottomIndexOffset,
  });
  const footerBar = el("div", { class: "gallerybar" }, [prevBtn, bottomIndexEl, nextBtn]);

  // Due blocchi "vuoti" trascinabili in altezza (maniglia rossa, come sulle
  // foto — visibile solo in modalità modifica), per lasciare all'utente il
  // controllo diretto di quanta aria vuole: uno prima delle frecce in
  // basso (tra la foto/didascalia e la gallerybar), uno in fondo del tutto
  // (per allungare il "foglio" beige oltre quanto basterebbe al
  // contenuto) — altezza di default presa da LAYOUT.gallery.
  const spacerBeforeBar = el("div", { class: "gallery-spacer" });
  makeHeightResizable(
    spacerBeforeBar,
    `${sizeKeyPrefix}.spacerBeforeBar`,
    "Trascina per aggiungere spazio prima delle frecce",
    parseFloat(LAYOUT.gallery.spacerBeforeBarHeight) || 0
  );
  const spacerBottom = el("div", { class: "gallery-spacer" });
  makeHeightResizable(
    spacerBottom,
    `${sizeKeyPrefix}.spacerBottom`,
    "Trascina per allungare la pagina",
    parseFloat(LAYOUT.gallery.spacerBottomHeight) || 0
  );

  app.appendChild(topbar);
  if (!descriptionRemoved) app.appendChild(descBlock);
  app.appendChild(viewport);
  app.appendChild(spacerBeforeBar);
  app.appendChild(footerBar);
  app.appendChild(spacerBottom);

  // Marquee del testo: SEMPRE attivo, velocità volutamente minima (un
  // filo di movimento continuo, non una lettura a scorrimento). Guidato
  // da requestAnimationFrame (non da un'animazione CSS) proprio per
  // poterlo anche trascinare a mano. "marqueePos" è quanto si è già
  // scorso (0..marqueeDistance, in px); trascinando lo si sposta
  // direttamente, e l'avanzamento automatico riprende da lì al rilascio,
  // senza scattare indietro. La distanza è quella ESATTA misurata sul DOM
  // (non una percentuale) — vedi il commento in style.css sul perché
  // "50%" darebbe un salto visibile.
  const MARQUEE_PX_PER_SEC = 8;
  let marqueeDistance = 0;
  let marqueePos = 0;
  let marqueeLastTs = null;
  let marqueeDragState = null;
  let marqueeRafId = null;
  let marqueeHoverPaused = false;
  let marqueeJustDragged = false;

  const measureMarqueeDistance = () => {
    marqueeDistance = secondCopy[0] ? secondCopy[0].offsetTop : descTrack.scrollHeight / 2;
    marqueePos = marqueeDistance ? marqueePos % marqueeDistance : 0;
    // Se il blocco non ha un'altezza esplicita (misura salvata o
    // descriptionBox in content.js), il default è l'altezza esatta di
    // UNA copia: il testo si vede tutto (non ne manca un pezzo), e scorre
    // comunque piano per il movimento ambientale — non perché ne avanzi
    // altro da rivelare.
    if (!hasExplicitDescHeight) {
      descBlock.style.height = `${marqueeDistance}px`;
    }
  };
  const applyMarqueeTransform = () => {
    // translate3d, non translateY: forza la composizione su GPU con
    // precisione sub-pixel. A una velocità così bassa (pochi px/sec) ogni
    // fotogramma si muove di una frazione di pixel — senza questo, alcuni
    // browser arrotondano al pixel intero più vicino, e il movimento si
    // vede a scatti invece che fluido.
    descTrack.style.transform = `translate3d(0, ${marqueePos - marqueeDistance}px, 0)`;
  };
  const marqueeTick = (ts) => {
    if (marqueeLastTs == null) marqueeLastTs = ts;
    const dt = (ts - marqueeLastTs) / 1000;
    marqueeLastTs = ts;
    if (!marqueeDragState && !marqueeHoverPaused && !isEditMode() && marqueeDistance > 0) {
      marqueePos = (marqueePos + dt * MARQUEE_PX_PER_SEC) % marqueeDistance;
      applyMarqueeTransform();
    }
    marqueeRafId = requestAnimationFrame(marqueeTick);
  };
  measureMarqueeDistance();
  applyMarqueeTransform();
  marqueeRafId = requestAnimationFrame(marqueeTick);

  // Come per l'autoplay delle foto: passandoci sopra il mouse lo scorrimento
  // automatico del testo si ferma (utile per leggerlo con calma), e riparte
  // togliendo il mouse — senza scattare indietro, riprende da dov'era.
  descBlock.addEventListener("mouseenter", () => { marqueeHoverPaused = true; });
  descBlock.addEventListener("mouseleave", () => { marqueeHoverPaused = false; });

  // Il font (Inter) carica con font-display:swap: il testo appare subito
  // con un font di scorta dalle proporzioni diverse, poi "scatta" su
  // Inter quando arriva, cambiando l'altezza reale del testo. Rimisuriamo
  // quando il font vero è pronto.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measureMarqueeDistance();
      applyMarqueeTransform();
    });
  }

  // Trascinamento a mano: solo fuori dalla modalità modifica (lì il
  // testo resta fermo — vedi ensureEditModeUI/isEditMode — e si legge
  // scrollando normalmente col mouse/dito, come .description in edit
  // mode già permette).
  descTrack.classList.add("draggable");
  descTrack.addEventListener("pointerdown", (e) => {
    if (isEditMode()) return;
    e.preventDefault();
    marqueeDragState = { pointerId: e.pointerId, startY: e.clientY, startPos: marqueePos, moved: false };
    descTrack.classList.add("is-dragging");
    document.addEventListener("pointermove", onMarqueeDragMove);
    document.addEventListener("pointerup", onMarqueeDragEnd);
  });
  function onMarqueeDragMove(e) {
    if (!marqueeDragState || e.pointerId !== marqueeDragState.pointerId) return;
    const dy = e.clientY - marqueeDragState.startY;
    // Oltre pochi pixel è un vero trascinamento (scorri il testo a mano),
    // non un semplice clic — serve per non aprire anche lo zoom subito
    // dopo aver rilasciato, vedi il listener "click" su descBlock più sotto.
    if (Math.abs(dy) > 5) marqueeDragState.moved = true;
    // trascinare verso il basso "torna indietro" nel testo (come si
    // trascina un foglio per rivelare quello che c'è sopra); verso
    // l'alto avanza — coerente con lo scorrimento automatico dall'alto
    // verso il basso.
    let next = (marqueeDragState.startPos - dy) % marqueeDistance;
    if (next < 0) next += marqueeDistance;
    marqueePos = next;
    applyMarqueeTransform();
  }
  function onMarqueeDragEnd(e) {
    if (!marqueeDragState || e.pointerId !== marqueeDragState.pointerId) return;
    if (marqueeDragState.moved) marqueeJustDragged = true;
    marqueeDragState = null;
    descTrack.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onMarqueeDragMove);
    document.removeEventListener("pointerup", onMarqueeDragEnd);
  }

  // Stesso zoom delle foto (vedi makeZoomable), sul blocco di testo: un
  // clic vero e proprio (non il rilascio di un trascinamento — vedi
  // "marqueeJustDragged" sopra, stesso principio di "justResized" nel
  // lightbox delle foto) lo apre ingrandito. Niente zoom se il progetto
  // non ha proprio testo (pagine-parola, per ora).
  if (description && description.length) {
    descBlock.addEventListener("click", () => {
      if (isEditMode()) return;
      if (marqueeJustDragged) { marqueeJustDragged = false; return; }
      openTextLightbox(description, sizeKeyPrefix);
    });
  }

  /* ---- viewer foto: slide orizzontale, autoplay 5s + transizione 2s ----
     Questo scorrimento automatico tra le foto della galleria funziona
     sempre, sia per un progetto sia per core archive. Cambia solo cosa
     fanno le frecce: su un progetto portano al progetto precedente/
     successivo (vedi sotto), su core archive scorrono le foto. */
  let current = 0;
  let autoplayTimer = null;
  let paused = false;
  // Istante (performance.now()) dell'ultima transizione avviata da goTo():
  // usato da scheduleNext() per calcolare quanto tempo di transizione resta
  // ancora da scontare, invece di un flag "isAtRest" indovinato dal
  // chiamante — vedi il commento in scheduleNext() sul bug che questo
  // risolve (swipe touch / hover+click che riprendono l'autoplay troppo
  // presto dopo una transizione avviata mentre l'autoplay era in pausa).
  let lastTransitionStart = -Infinity;

  function updateViewportHeight() {
    const activeFigure = figures[current];
    if (!activeFigure) return;
    // Il rect della <figure> segue solo il flusso NORMALE: se la foto o la
    // didascalia sono state trascinate (transform, non layout), il loro
    // spostamento visivo non allarga affatto il rect del genitore — quindi
    // basarsi solo su "activeFigure.getBoundingClientRect()" farebbe
    // tagliare da "overflow: hidden" qualunque didascalia trascinata più in
    // basso di dove starebbe di default (il rettangolo "sparisce" quando la
    // sposti giù, esattamente dove dovrebbe stare). Il rect di ciascun
    // elemento trascinabile, preso singolarmente, riflette invece SEMPRE il
    // proprio transform: controlliamo anche loro e teniamo il punto più
    // basso tra tutti.
    const viewportTop = viewport.getBoundingClientRect().top;
    let bottom = activeFigure.getBoundingClientRect().bottom;
    activeFigure.querySelectorAll(".photo-frame, .caption-box").forEach((node) => {
      bottom = Math.max(bottom, node.getBoundingClientRect().bottom);
    });
    const newHeightPx = bottom - viewportTop;
    const currentHeightPx = viewport.getBoundingClientRect().height;
    if (newHeightPx > currentHeightPx) {
      // Se la foto in arrivo è più alta di quella attuale, lo scatto è
      // ISTANTANEO invece che animato in 6 secondi: altrimenti, per tutta
      // la durata della transizione, il riquadro resterebbe più basso di
      // quanto serve alla foto che sta scorrendo in vista, e
      // "overflow: hidden" (necessario per lo slide orizzontale) ne
      // taglierebbe il fondo finché l'altezza non recupera (confermato:
      // subito dopo l'inizio di una transizione verso una foto molto più
      // alta, il riquadro può restare centinaia di px più basso del
      // necessario). Se invece la foto in arrivo è più bassa, restringersi
      // non taglia mai nulla, quindi lì la transizione morbida resta.
      const prevTransition = viewport.style.transition;
      viewport.style.transition = "none";
      viewport.style.height = `${newHeightPx}px`;
      viewport.getBoundingClientRect(); // forza il reflow prima di riattivare la transizione
      viewport.style.transition = prevTransition;
    } else {
      viewport.style.height = `${newHeightPx}px`;
    }
  }

  function applyPosition({ instant = false, position = current } = {}) {
    if (instant) {
      // Scatto senza transizione: usato solo per i riancoraggi invisibili
      // del trucco del "loop infinito" — vedi goTo(). Non è mai quello che
      // l'utente vede muoversi: o mostra esattamente la stessa foto di
      // prima (nessun cambiamento visibile), o avviene DOPO che lo slide
      // animato è già arrivato al clone (vedi sotto).
      track.style.transition = "none";
      track.style.transform = `translateX(-${position * 100}%)`;
      track.getBoundingClientRect(); // forza il reflow prima di riattivare la transizione
      track.style.transition = "";
    } else {
      track.style.transform = `translateX(-${position * 100}%)`;
    }
    updateViewportHeight();
  }

  // Chiudere il giro (dall'ultima foto alla prima, o viceversa) deve
  // sembrare un passo avanti/indietro NORMALE, alla stessa velocità delle
  // altre transizioni — non uno scatto istantaneo né un riavvolgimento
  // veloce attraverso tutte le foto di mezzo. Trucco standard dei
  // caroselli infiniti: si clona temporaneamente la foto di arrivo,
  // agganciandola subito dopo (o prima) di quella attuale nel binario, e
  // ci si anima sopra normalmente; a transizione finita il clone (identico
  // in tutto e per tutto alla foto vera) sparisce e si riancora
  // all'istante sulla foto vera, senza che si veda alcuna differenza.
  let pendingWrapCleanup = null;

  function makePhotoClone(sourceIndex) {
    const clone = figures[sourceIndex].cloneNode(true);
    clone.classList.add("photo-clone");
    clone.querySelectorAll(".resize-handle, .move-handle, .resizable-label").forEach((el) => el.remove());
    return clone;
  }

  function goTo(i, { user = false } = {}) {
    if (!figures.length) return;
    lastTransitionStart = performance.now();
    if (pendingWrapCleanup) {
      clearTimeout(pendingWrapCleanup.timer);
      pendingWrapCleanup.cleanup();
      pendingWrapCleanup = null;
    }

    const n = figures.length;
    // "n > 1" evita che con una sola foto (n===1, current===0) entrambe le
    // condizioni sotto risultino vere per lo stesso "i" (current-1 === 0-1
    // === -1 e current+1 === 0+1 === 1 coincidono modulo 1 con l'unica
    // foto), il che clonerebbe inutilmente l'unica foto e animerebbe un
    // giro completo su se stessa invece di restare ferma.
    const wrapForward = n > 1 && current === n - 1 && i === current + 1;
    const wrapBackward = n > 1 && current === 0 && i === current - 1;
    current = (i + n) % n;

    if (wrapForward) {
      const clone = makePhotoClone(0);
      track.appendChild(clone);
      applyPosition({ position: n }); // un passo avanti normale, verso il clone appena aggiunto in coda
      const timer = setTimeout(() => {
        clone.remove();
        applyPosition({ instant: true, position: current }); // current = 0, identico al clone: nessun cambiamento visibile
        pendingWrapCleanup = null;
      }, TRANSITION_MS);
      pendingWrapCleanup = {
        timer,
        cleanup: () => { clone.remove(); applyPosition({ instant: true, position: current }); },
      };
    } else if (wrapBackward) {
      const clone = makePhotoClone(n - 1);
      track.insertBefore(clone, track.firstChild);
      // Inserire il clone in testa sposta la foto reale attuale (era in
      // posizione 0) alla posizione 1: la riancoriamo lì all'istante,
      // senza transizione, così finora non è cambiato nulla di visibile.
      applyPosition({ instant: true, position: 1 });
      applyPosition({ position: 0 }); // un passo indietro normale, verso il clone appena aggiunto in testa
      const timer = setTimeout(() => {
        clone.remove();
        applyPosition({ instant: true, position: current }); // current = n-1, identico al clone: nessun cambiamento visibile
        pendingWrapCleanup = null;
      }, TRANSITION_MS);
      pendingWrapCleanup = {
        timer,
        cleanup: () => { clone.remove(); applyPosition({ instant: true, position: current }); },
      };
    } else {
      applyPosition();
    }

    if (user) restartAutoplay();
  }

  function scheduleNext() {
    clearTimeout(autoplayTimer);
    if (paused || figures.length < 2) return;
    // Se una transizione è appena partita (autoplay, click dell'utente, o
    // swipe touch), la prossima non deve scattare dopo AUTOPLAY_DELAY
    // dall'INIZIO di questa, ma dopo che questa è FINITA di arrivare
    // (TRANSITION_MS) più il tempo di sosta vero e proprio: altrimenti, con
    // transizione e sosta impostate entrambe a 6s, la prossima partiva
    // esattamente nel momento in cui l'attuale finiva di arrivare — la foto
    // restava ferma a schermo per 0 secondi. Invece di un flag "isAtRest"
    // indovinato da ogni chiamante (bacato: goTo() chiamato mentre
    // l'autoplay è in pausa — es. hover del mouse o swipe touch — non
    // riusciva a schedulare nulla dato il controllo "paused" qui sopra, e
    // chi poi riprendeva l'autoplay (handleResume) assumeva sempre "nessuna
    // transizione in corso", tagliando la sosta della foto appena mostrata),
    // calcoliamo quanto tempo di transizione resta DAVVERO da scontare in
    // base a quando l'ultima transizione è stata avviata (lastTransitionStart,
    // aggiornato in goTo()): funziona per ogni caso (mostra iniziale,
    // ripresa dopo pausa, transizione ancora in corso) senza doverli
    // distinguere esplicitamente.
    const elapsedSinceTransition = performance.now() - lastTransitionStart;
    const remainingTransition = Math.max(0, TRANSITION_MS - elapsedSinceTransition);
    const wait = AUTOPLAY_DELAY + remainingTransition;
    autoplayTimer = setTimeout(() => {
      goTo(current + 1);
      scheduleNext();
    }, wait);
  }

  function restartAutoplay() {
    scheduleNext();
  }

  function handlePause() {
    paused = true;
    clearTimeout(autoplayTimer);
  }
  function handleResume() {
    paused = false;
    scheduleNext();
  }

  // Le frecce, su un progetto, portano al progetto precedente/successivo
  // invece di scorrere le foto della galleria corrente.
  if (projectNav) {
    prevBtn.addEventListener("click", () => { location.hash = `#/project/${projectNav.prevSlug}`; });
    nextBtn.addEventListener("click", () => { location.hash = `#/project/${projectNav.nextSlug}`; });
  } else {
    prevBtn.addEventListener("click", () => goTo(current - 1, { user: true }));
    nextBtn.addEventListener("click", () => goTo(current + 1, { user: true }));
  }

  // Passare da una foto all'altra della galleria senza aspettare
  // l'autoplay (a differenza di prevBtn/nextBtn, che su un progetto
  // navigano invece tra progetti): niente bottoni invisibili con un'area
  // cliccabile minuscola — TUTTA la fascia beige ai lati della foto,
  // dentro .photo-viewport, è attiva. Un clic sulla foto stessa (dentro
  // il riquadro) resta gestito da makeZoomable (ingrandimento), quindi
  // qui basta controllare se il clic è fuori dal riquadro della foto
  // corrente, a sinistra o a destra.
  viewport.addEventListener("click", (e) => {
    if (isEditMode() || figures.length < 2) return;
    const activeFrame = figures[current].querySelector(".photo-frame");
    const r = activeFrame.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return; // sopra/sotto la foto (didascalia, margini): non fare nulla
    if (e.clientX < r.left) goTo(current - 1, { user: true });
    else if (e.clientX > r.right) goTo(current + 1, { user: true });
  });

  viewport.addEventListener("mouseenter", handlePause);
  viewport.addEventListener("mouseleave", handleResume);
  viewport.addEventListener("touchstart", handlePause, { passive: true });

  // swipe orizzontale su touch
  let touchStartX = null;
  viewport.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) goTo(current + (dx < 0 ? 1 : -1), { user: true });
    touchStartX = null;
    handleResume();
  });

  // Finché non la tocchi, ogni foto ha la STESSA ALTEZZA: generosa,
  // proporzionale allo schermo (non allo spazio che resta dopo il testo
  // — la pagina beige può essere più alta di un monitor, e va bene così:
  // si scrolla per vederla tutta, non si rimpiccioliscono le foto per
  // farcele stare per forza). Un tetto in larghezza evita che una foto
  // molto orizzontale sfori il pannello: usa il rapporto REALE della foto
  // più orizzontale di QUESTA galleria (non un'ipotesi generica tipo
  // 16:9 applicata a tutte — col pannello fisso a ~740px larghi, un
  // limite "per sicurezza" applicato a foto verticali le schiaccerebbe
  // via inutilmente). Una foto toccata a mano (misura salvata o
  // width/height espliciti in content.js) non viene toccata qui, e non
  // influenza nemmeno il calcolo del rapporto.
  const PHOTO_HEIGHT_VH = 0.8; // 80% dell'altezza della finestra
  const MIN_PHOTO_HEIGHT = 320;
  const overridesForRatio = loadSizeOverrides();
  function isUntouched(i) {
    const key = `${sizeKeyPrefix}.image.${images[i]._index}`;
    const saved = overridesForRatio[key];
    return !((saved && (saved.width || saved.height)) || images[i].width || images[i].height);
  }
  function widestUntouchedRatio() {
    let widest = 0;
    figures.forEach((figure, i) => {
      if (!isUntouched(i)) return;
      const img = figure.querySelector("img");
      if (img.naturalWidth && img.naturalHeight) {
        widest = Math.max(widest, img.naturalWidth / img.naturalHeight);
      }
    });
    return widest;
  }
  function applyDefaultPhotoHeights() {
    if (!figures.length) return;
    const photoStyle = getComputedStyle(figures[0]);
    const paddingLeft = parseFloat(photoStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(photoStyle.paddingRight) || 0;
    const availableWidth = viewport.getBoundingClientRect().width - paddingLeft - paddingRight;
    const ratio = widestUntouchedRatio();
    const maxHeightForWidth = ratio > 0 ? availableWidth / ratio : Infinity;
    const targetHeight = Math.max(MIN_PHOTO_HEIGHT, Math.min(window.innerHeight * PHOTO_HEIGHT_VH, maxHeightForWidth));

    figures.forEach((figure, i) => {
      if (!isUntouched(i)) return;
      const frame = figure.querySelector(".photo-frame");
      frame.style.width = "auto";
      frame.style.height = `${targetHeight}px`;
    });
    updateViewportHeight();
  }
  applyDefaultPhotoHeights();
  window.addEventListener("resize", applyDefaultPhotoHeights);

  // Le foto lazy non hanno ancora naturalWidth/Height al primo calcolo:
  // ricalcoliamo (e aggiorniamo anche l'altezza del viewport se è quella
  // corrente) man mano che arrivano, così il tetto in larghezza si
  // aggiorna quando si scopre una foto più orizzontale di quanto sapessimo.
  figures.forEach((figure, i) => {
    const img = figure.querySelector("img");
    img.addEventListener("load", () => {
      applyDefaultPhotoHeights();
      if (i === current) updateViewportHeight();
    });
  });

  window.addEventListener("resize", updateViewportHeight);

  // Se la foto attiva viene ridimensionata (anche durante il trascinamento
  // della maniglia, non solo al rilascio), l'altezza del viewport deve
  // seguirla subito: altrimenti "overflow: hidden" taglia il pezzo che
  // eccede l'altezza precedente, rimasta più bassa (foto "tagliate").
  const frameResizeObserver = new ResizeObserver(() => updateViewportHeight());
  figures.forEach((figure) => {
    const frame = figure.querySelector(".photo-frame");
    if (frame) frameResizeObserver.observe(frame);
  });
  resizeObservers.push(frameResizeObserver);

  applyPosition();
  scheduleNext();

  const alignmentGuides = setupAlignmentGuides(app, sizeKeyPrefix);

  currentTeardown = () => {
    alignmentGuides.teardown();
    clearTimeout(autoplayTimer);
    if (pendingWrapCleanup) clearTimeout(pendingWrapCleanup.timer);
    cancelAnimationFrame(marqueeRafId);
    document.removeEventListener("pointermove", onMarqueeDragMove);
    document.removeEventListener("pointerup", onMarqueeDragEnd);
    window.removeEventListener("resize", updateViewportHeight);
    window.removeEventListener("resize", applyDefaultPhotoHeights);
    resizeObservers.forEach((o) => o.disconnect());
  };
}

// Applica le eliminazioni ("×") e le aggiunte ("+") fatte in modalità
// modifica a un array di foto già costruito da content.js — stessa logica
// sia per un progetto sia per core archive, quindi factorizzata qui.
function applyImageOverrides(galleryKey, seed, images) {
  const removed = removedIdsFor(galleryKey);
  const uploaded = uploadedImagesFor(galleryKey);
  const kept = images
    .filter((img) => !removed.includes(`orig:${img._index}`))
    .map((img) => {
      const uploadedSrc = uploaded[img._index];
      return uploadedSrc ? { ...img, _src: uploadedSrc, _isPlaceholder: false } : { ...img, _isPlaceholder: !img.src };
    });
  extraImagesFor(galleryKey).forEach((extra) => {
    const uploadedSrc = uploaded[extra.id];
    kept.push({
      caption: "",
      src: null,
      _index: extra.id,
      _extra: true,
      _isPlaceholder: !uploadedSrc,
      _src: uploadedSrc || placeholderImg(`${seed}-${extra.id}`, "nuova foto"),
    });
  });
  return kept;
}

function renderProject(slug) {
  const project = findProject(slug);
  if (!project) {
    renderNotFound();
    return;
  }
  const galleryKey = `project.${project.slug}`;
  const orderKey = `${galleryKey}.imageOrder`;
  const order = currentImageOrder(orderKey, project.images.length);
  const baseImages = order.map((origIndex) => {
    const img = project.images[origIndex];
    return { ...img, _index: origIndex, _src: resolveImageSrc(project.slug, origIndex, img) };
  });
  const images = applyImageOverrides(galleryKey, project.slug, baseImages);

  const orderedProjects = getOrderedProjects();
  const idx = orderedProjects.findIndex((p) => p.slug === project.slug);
  const prevSlug = orderedProjects[(idx - 1 + orderedProjects.length) % orderedProjects.length].slug;
  const nextSlug = orderedProjects[(idx + 1) % orderedProjects.length].slug;

  renderGallery({
    // Il numero mostrato è la posizione del progetto in home (1 = primo),
    // non il numero di foto della galleria.
    indexNumber: idx + 1,
    title: project.name.toLowerCase(),
    description: project.description,
    descriptionBox: project.descriptionBox,
    images,
    projectNav: { slug: project.slug, prevSlug, nextSlug },
    galleryKey,
  });
}

function renderArchive() {
  const galleryKey = "archive";
  const orderKey = "archive.imageOrder";
  const order = currentImageOrder(orderKey, ARCHIVE.images.length);
  const baseImages = order.map((origIndex) => {
    const img = ARCHIVE.images[origIndex];
    return { ...img, _index: origIndex, _src: resolveImageSrc("archive", origIndex, img) };
  });
  const images = applyImageOverrides(galleryKey, "archive", baseImages);
  renderGallery({
    // Core archive non fa parte della lista progetti: qui il numero resta
    // il conteggio delle foto (non c'è una "posizione" a cui riferirsi).
    indexNumber: images.length,
    title: ARCHIVE.title,
    description: ARCHIVE.description,
    images,
    galleryKey,
  });
}

// Pagina di una "parola" aggiunta in home ("+ aggiungi una parola"): usa
// la STESSA pagina di default di un progetto (renderGallery — numero,
// titolo, testo, foto), ma non esiste in PROJECTS: parte con UNA SOLA
// foto segnaposto (mai due) proprio per evitare il loop automatico tra
// due placeholder, che con una sola foto non scatta mai (vedi
// "figures.length < 2" in scheduleNext). Foto aggiunte/eliminate con i
// soliti "+"/"×" usano lo stesso meccanismo di un progetto vero, solo
// con una chiave "word.<id>" invece di "project.<slug>".
function renderWordPage(id) {
  const word = extraTextFor("home").find((w) => w.id === id);
  if (!word) {
    renderNotFound();
    return;
  }
  const galleryKey = `word.${id}`;
  const baseImages = [{ caption: "", src: null, _index: 0, _src: resolveImageSrc(galleryKey, 0, { caption: "", src: null }) }];
  const images = applyImageOverrides(galleryKey, galleryKey, baseImages);
  renderGallery({
    indexNumber: images.length,
    title: word.text || "senza titolo",
    description: [],
    images,
    galleryKey,
  });
}

/* -------------------------------------------------------------------------
   8. Render: CONTACTS / ABOUT
   ------------------------------------------------------------------------- */
function renderSimplePage({ title, paragraphs, extraLines = [] }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  ensureEditModeUI();

  const simpleKeyPrefix = `simple.${title.toLowerCase()}`;
  const { topbar } = buildTopbar(simpleKeyPrefix, "", title.toLowerCase());

  const body = el("div", { class: "description simple-page" }, [
    ...paragraphs.map((p) => el("p", {}, p)),
    ...extraLines.map((line) => el("p", { class: "contact-line" }, `${line.label} — ${line.value}`)),
  ]);

  app.appendChild(topbar);
  app.appendChild(body);

  currentTeardown = null;
}

function renderContacts() {
  renderSimplePage({ title: CONTACTS.title, paragraphs: CONTACTS.paragraphs, extraLines: CONTACTS.lines });
}

function renderAbout() {
  renderSimplePage({ title: ABOUT.title, paragraphs: ABOUT.paragraphs });
}

function renderNotFound() {
  renderSimplePage({ title: "not found", paragraphs: ["Questa pagina non esiste."] });
}

/* -------------------------------------------------------------------------
   9. Router
   ------------------------------------------------------------------------- */
function parseHash() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [route, param] = hash.split("/");
  return { route: route || "home", param };
}

// Se content.js ha un errore (virgole/virgolette sbagliate, un campo che
// manca...) mostriamo un messaggio leggibile invece di lasciare la pagina
// vuota — così si capisce subito cosa è successo.
function showFatalError(error) {
  app.classList.remove("has-fixed-bars");
  app.innerHTML = "";
  app.appendChild(
    el("div", { style: "padding:40px;font-family:ui-monospace,monospace;font-size:0.85rem;line-height:1.6;white-space:pre-wrap;" }, [
      el("p", {}, "C'è un errore in content.js e la pagina non riesce a caricarsi del tutto:"),
      el("p", { style: "color:#a33;" }, String(error && error.message ? error.message : error)),
      el("p", {}, "Causa più comune: hai incollato un testo che contiene virgolette dritte (\" o ') dentro una stringa delimitata dagli stessi apici, oppure manca una virgola tra due righe. Se hai appena incollato un testo, prova a racchiuderlo tra backtick ` invece che tra virgolette \" \" — tollerano meglio apici e virgolette dentro il testo."),
    ])
  );
}

function renderRoute() {
  teardownCurrentView();
  try {
    const { route, param } = parseHash();

    switch (route) {
      case "project":
        renderProject(param);
        break;
      case "archive":
        renderArchive();
        break;
      case "word":
        renderWordPage(param);
        break;
      case "contacts":
        renderContacts();
        break;
      case "about":
        renderAbout();
        break;
      case "home":
      case "":
      default:
        renderHome();
        break;
    }
  } catch (error) {
    console.error(error);
    showFatalError(error);
  }

  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);
