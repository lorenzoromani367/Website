
let saveSuccessTimeout;
function showSaveSuccess(timestamp) {
  let badge = document.getElementById("save-success-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "save-success-badge";
    badge.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #2b7a4b; color: white; padding: 8px 16px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12px; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s; pointer-events: none;";
    document.body.appendChild(badge);
  }
  badge.textContent = `Salvato su content.js alle ${timestamp}`;
  badge.style.opacity = "1";
  
  clearTimeout(saveSuccessTimeout);
  saveSuccessTimeout = setTimeout(() => {
    badge.style.opacity = "0";
  }, 3000);
}

function showSaveError() {
  let alarm = document.getElementById("save-error-alarm");
  if (!alarm) {
    alarm = document.createElement("div");
    alarm.id = "save-error-alarm";
    alarm.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(220, 38, 38, 0.95); color: white; display: flex; align-items: center; justify-content: center; font-family: sans-serif; font-size: 32px; font-weight: bold; z-index: 100000; text-align: center; padding: 40px; box-sizing: border-box; cursor: pointer; flex-direction: column; white-space: pre-wrap;";
    alarm.textContent = "ATTENZIONE: Modifiche NON salvate su disco\n\nClicca per chiudere.";
    alarm.onclick = () => { alarm.style.display = "none"; };
    document.body.appendChild(alarm);
  }
  alarm.style.display = "flex";
}

const originalFetch = window.fetch;
window.fetch = async function(url, options) {
  const isSaveUrl = typeof url === 'string' && (url.includes('/api/save') || url.includes('/api/rename'));
  try {
    const res = await originalFetch.apply(this, arguments);
    if (isSaveUrl) {
      const cloned = res.clone();
      cloned.json().then(data => {
        if (data.success && data.timestamp) {
          showSaveSuccess(data.timestamp);
        } else if (!data.success) {
          showSaveError();
        }
      }).catch(e => showSaveError());
    }
    return res;
  } catch (e) {
    if (isSaveUrl) showSaveError();
    throw e;
  }
};

// TEMPORARY CLEANUP FOR SINGLE PAGES
(function() {
  if (!localStorage.getItem('fixed_single_pages_v2')) {
    localStorage.setItem('fixed_single_pages_v2', 'true');
    const posObj = JSON.parse(localStorage.getItem('site-position-overrides-v1:d') || '{}');
    const sizeObj = JSON.parse(localStorage.getItem('site-size-overrides-v1:d') || '{}');
    
    const singleSlugs = ['beach', 'hair', 'eating', 'toy', 'whitening', 'bar', 'fluoxetine', 'compression', 'sofa', 'Pile'];
    
    singleSlugs.forEach(slug => {
      delete posObj[`project.${slug}.singleImagePos.0`];
      delete posObj[`project.${slug}.imagePos.0`];
      delete posObj[`project.${slug}.captionPos.0`];
      delete sizeObj[`project.${slug}.image.0`];
      delete sizeObj[`project.${slug}.captionSize.0`];
    });
    
    localStorage.setItem('site-position-overrides-v1:d', JSON.stringify(posObj));
    localStorage.setItem('site-size-overrides-v1:d', JSON.stringify(sizeObj));
    
    const posObjM = JSON.parse(localStorage.getItem('site-position-overrides-v1:m') || '{}');
    const sizeObjM = JSON.parse(localStorage.getItem('site-size-overrides-v1:m') || '{}');
    
    singleSlugs.forEach(slug => {
      delete posObjM[`project.${slug}.singleImagePos.0`];
      delete posObjM[`project.${slug}.imagePos.0`];
      delete posObjM[`project.${slug}.captionPos.0`];
      delete sizeObjM[`project.${slug}.image.0`];
      delete sizeObjM[`project.${slug}.captionSize.0`];
    });
    
    localStorage.setItem('site-position-overrides-v1:m', JSON.stringify(posObjM));
    localStorage.setItem('site-size-overrides-v1:m', JSON.stringify(sizeObjM));
    
    location.reload();
  }
})();
// END TEMPORARY CLEANUP

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
const MARQUEE_PX_PER_SEC = 6;  // velocità dello scorrimento del testo
const GRID_SIZE = 20;          // px: passo della griglia di allineamento in modalità modifica (resize/spostamenti si agganciano a questo)
const MOBILE_BREAKPOINT = 700; // px: stessa soglia del media query in style.css — sopra/sotto cambia lo "scope" di posizioni/dimensioni salvate
// Le foto vere (src in content.js) restano in cache nel browser di chi
// visita il sito anche a lungo, a differenza di css/js che hanno già il
// loro "?v=" in index.html: senza questo, sostituire o ripristinare un
// file con lo STESSO NOME (es. dopo che una foto era sparita dal
// repository) può continuare a mostrare la versione vecchia — o un 404
// già in cache — a chi l'ha già vista prima. Bump ad ogni foto
// aggiunta/sostituita/ripristinata in content.js (vedi resolveImageSrc).
let IMAGE_VERSION = sessionStorage.getItem("APP_IMAGE_VERSION") || "3";
// Se l'utente ricarica la pagina (es. F5 o hard refresh), generiamo una nuova
// versione per forzare il browser a scaricare le immagini nuove/modificate.
if (performance.navigation && performance.navigation.type === 1) { // 1 = TYPE_RELOAD
  IMAGE_VERSION = Date.now().toString();
  sessionStorage.setItem("APP_IMAGE_VERSION", IMAGE_VERSION);
}

// Reset the core archive offsets once to ensure it perfectly aligns with boundaries
if (!localStorage.getItem("core_archive_reset_v1")) {
  localStorage.removeItem("archive.topbarTitlePos");
  localStorage.removeItem("archive.topbarIndexPos");
  localStorage.removeItem("archive.bottomIndexPos");
  localStorage.setItem("core_archive_reset_v1", "true");
}

// Assorbe automaticamente le modifiche alla cartella "images" usando l'elenco
// generato dal watcher (images-data.js), mantenendo le impostazioni salvate in content.js.
(function mergeDynamicImages() {
  if (typeof window.DYNAMIC_IMAGES === "undefined" || typeof PROJECTS === "undefined" || typeof ARCHIVE === "undefined") return;

  const mergeProjectImages = (project, folderSlug) => {
    const folderPrefix = `images/${folderSlug.toLowerCase()}/`;
    const projectFiles = window.DYNAMIC_IMAGES.filter(path => path.toLowerCase().startsWith(folderPrefix));
    
    // Rimuove i file fisicamente cancellati, ignorando i placeholder (src == null)
    // o i file che puntano ad altre cartelle
    if (!project.images) project.images = [];
    project.images = project.images.filter(img => {
      if (!img.src || !img.src.toLowerCase().startsWith(folderPrefix)) return true;
      return projectFiles.some(pf => pf.toLowerCase() === img.src.toLowerCase());
    });

    // Aggiunge i nuovi file trovati nella cartella
    projectFiles.forEach(file => {
      const exists = project.images.find(img => img.src && img.src.toLowerCase() === file.toLowerCase());
      if (!exists) {
        project.images.push({ caption: "", src: file });
      }
    });
  };

  PROJECTS.forEach(project => mergeProjectImages(project, project.slug));
  mergeProjectImages(ARCHIVE, "core archive");
})();

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

// Vero anche dentro il riquadro di anteprima mobile (vedi openMobilePreview
// più sotto): lì l'iframe ha davvero quella larghezza, non è solo un
// restringimento visivo, quindi "window.innerWidth" lì dentro riflette la
// realtà — la stessa identica soglia del @media in style.css, apposta,
// così le posizioni/dimensioni salvate (vedi mobileScope più sotto) e
// l'aspetto visivo cambiano insieme, mai uno senza l'altro.
function isMobileViewport() {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

// Suffisso di scope per le chiavi di storage "di layout" (posizioni,
// dimensioni, guide) — MAI per il contenuto (testi, didascalie, quali foto
// esistono): quello resta identico su ogni schermo, cambia solo come è
// disposto. Permette di risistemare la disposizione mobile con le stesse
// maniglie del desktop senza mai sovrascrivere l'una con l'altra.
function layoutScopeSuffix() {
  return isMobileViewport() ? ":m" : ":d";
}

// Le posizioni/dimensioni di default in content.js e LAYOUT (offset in px,
// larghezze come "700px") sono tarate sul pannello desktop (740px): su
// mobile spingerebbero foto/didascalie/numeri fuori posto o fuori
// larghezza, quindi qui restano SOLO per il desktop — su mobile parte
// tutto da zero/auto (vedi CSS), e resta così finché non trascini TU
// qualcosa mentre sei nell'anteprima mobile (salvato a parte, mai qui).
function desktopOnly(value) {
  return isMobileViewport() ? undefined : value;
}

// Come desktopOnly(), ma per i campi che HANNO anche un default mobile
// esplicito (LAYOUT.galleryMobile, o un "mobile: {...}" sulla singola
// voce di content.js): sotto i 700px usa, nell'ordine, l'eventuale
// override della SINGOLA foto/blocco, poi il default generale mobile,
// altrimenti niente (mai il valore desktop, che conterebbe solo sopra i
// 700px).
function pickLayout(desktopValue, mobileSpecific, mobileGeneral) {
  if (!isMobileViewport()) return desktopValue;
  return mobileSpecific !== undefined ? mobileSpecific : mobileGeneral;
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
    return JSON.parse(localStorage.getItem(SIZE_STORE_KEY + layoutScopeSuffix())) || {};
  } catch (e) {
    return {};
  }
}

function saveSizeOverride(key, size) {
  const all = loadSizeOverrides();
  all[key] = size;
  try {
    localStorage.setItem(SIZE_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la dimensione resta comunque applicata per questa sessione */
  }
}

function clearSizeOverride(key) {
  const all = loadSizeOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    localStorage.setItem(SIZE_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
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

// Nascondere un NOME DI PROGETTO dalla home (a differenza di una parola,
// che si toglie del tutto con removeExtraText): il progetto resta nel
// codice (content.js) e la sua pagina resta raggiungibile, si toglie solo
// la riga dalla lista — reversibile con "Reset modifiche", stesso
// principio di ogni altra eliminazione del sito. Le parole invece restano
// una vera cancellazione: non hanno un "codice sorgente" a parte da cui
// potrebbero ricomparire da sole.
const HOME_HIDDEN_STORE_KEY = "site-home-hidden-v1";

function loadHiddenHomeRows() {
  try {
    return JSON.parse(localStorage.getItem(HOME_HIDDEN_STORE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function hideHomeRow(tag) {
  const hidden = loadHiddenHomeRows();
  if (!hidden.includes(tag)) hidden.push(tag);
  try {
    localStorage.setItem(HOME_HIDDEN_STORE_KEY, JSON.stringify(hidden));
  } catch (e) {
    /* storage non disponibile: la riga resta comunque nascosta per questa sessione */
  }
}

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
  const defaultOrder = Array.from({ length }, (_, i) => i);
  if (stored) {
    const validStored = stored.filter(idx => (typeof idx === 'number' && idx < length) || typeof idx === 'string');
    const uniqueStored = [...new Set(validStored)];
    const missing = defaultOrder.filter(idx => !uniqueStored.includes(idx));
    return [...uniqueStored, ...missing];
  }
  return defaultOrder;
}

/* -------------------------------------------------------------------------
   Eliminare una foto ("×") o aggiungerne una nuova ("+") in modalità
   modifica: il sito è statico, quindi non c'è modo di toccare per davvero
   content.js da qui — sono solo due salvataggi nel browser, esportabili
   come tutto il resto (vedi pannello "Esporta modifiche"). Una foto
   ORIGINALE di content.js non si può cancellare per davvero: eliminarla
   segna solo il suo id come "nascosto". Una foto AGGIUNTA con "+" invece
   non è mai esistita in content.js: è solo un segnaposto (stesso
   placeholder colorato che vedi quando "src" è null) con una didascalia,
   in attesa che tu carichi il file vero e lo riporti in content.js —
   eliminarla la toglie del tutto dalla lista.

   L'id di una foto ORIGINALE è il suo "src" (es. "images/lines/lines-1.jpg"),
   non la sua posizione nell'array: se in content.js quella foto viene
   sostituita con un file diverso (nuovo nome), l'id cambia insieme al file,
   quindi la nuova foto NON eredita il "nascosto" di quella vecchia — puoi
   sempre caricare una foto diversa in un progetto, anche se in passato ne
   avevi eliminata una che occupava la stessa posizione. Solo per i
   segnaposto senza foto ("src: null", che non hanno nulla da identificare)
   si ricade sulla posizione ("orig:N"). Stessa idea per la descrizione: il
   suo id è il testo stesso, non "il blocco descrizione di questo
   progetto" — cambiarne il testo in content.js la rende visibile di nuovo,
   anche se in passato era stata eliminata.
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

// Id stabile di una foto ORIGINALE (non aggiunta con "+") ai fini
// dell'eliminazione: il contenuto (src) quando c'è, altrimenti la
// posizione (per i segnaposto "src: null", che non hanno altro con cui
// identificarsi). Usata sia per segnare un'eliminazione sia per
// controllare se una foto è tra quelle eliminate — DEVE restare identica
// nei due punti, altrimenti un'eliminazione non verrebbe mai riconosciuta.
function imageRemovalId(image, origIndex) {
  return image.src ? `src:${image.src}` : `orig:${origIndex}`;
}

// Stessa idea per il blocco di descrizione: il testo stesso è l'id, non
// una posizione fissa, così cambiare il testo in content.js la fa
// ricomparire anche se una versione precedente era stata eliminata.
function descriptionRemovalId(description) {
  return `description:${JSON.stringify(description)}`;
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
const LINK_STORE_KEY = "site-links-v1";

function loadExtraImagesOverrides() {
  try {
    return JSON.parse(localStorage.getItem(EXTRA_IMAGES_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function loadLinkOverrides() {
  try {
    return JSON.parse(localStorage.getItem(LINK_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function setLinkOverride(galleryKey, uid, linkTo) {
  const all = loadLinkOverrides();
  if (!all[galleryKey]) all[galleryKey] = {};
  if (linkTo) {
    all[galleryKey][uid] = linkTo;
  } else {
    delete all[galleryKey][uid];
  }
  try {
    localStorage.setItem(LINK_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn(e);
  }
}

function getLinkOverride(galleryKey, uid) {
  const all = loadLinkOverrides();
  return all[galleryKey] ? all[galleryKey][uid] : undefined;
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

// Stessa migrazione, seconda tornata: "beach" e "solo" sono ora anche loro
// vere pagine progetto — flag separato ("v2") perché chi ha già visitato
// il sito ha già la "v1" segnata come fatta, e non ripasserebbe più di lì.
(function removeWordsPromotedToProjectsOnceV2() {
  const FLAG_KEY = "site-words-promoted-v2";
  try {
    if (localStorage.getItem(FLAG_KEY)) return;
    const promotedNames = new Set(["beach", "solo"]);
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
    return JSON.parse(localStorage.getItem(POSITION_STORE_KEY + layoutScopeSuffix())) || {};
  } catch (e) {
    return {};
  }
}

function savePositionOverride(key, pos) {
  const all = loadPositionOverrides();
  all[key] = pos;
  try {
    localStorage.setItem(POSITION_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la posizione resta comunque applicata per questa sessione */
  }
}

function clearPositionOverride(key) {
  const all = loadPositionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    localStorage.setItem(POSITION_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
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

const DESCRIPTION_STORE_KEY = "site-description-overrides-v1";

function loadDescriptionOverrides() {
  try {
    return JSON.parse(localStorage.getItem(DESCRIPTION_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveDescriptionOverride(key, textArray) {
  const all = loadDescriptionOverrides();
  all[key] = textArray;
  try {
    localStorage.setItem(DESCRIPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* ignore */
  }
}

function clearDescriptionOverride(key) {
  const all = loadDescriptionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    localStorage.setItem(DESCRIPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* ignore */
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
    // Diretto sulla chiave desktop (":d"), non su loadPositionOverrides():
    // questa migrazione precede lo "scope" mobile/desktop di
    // layoutScopeSuffix() — tutti i dati vecchi da ripulire sono per
    // forza desktop (il mobile è uno store nuovo, nato già vuoto).
    const rawKey = POSITION_STORE_KEY + ":d";
    const all = JSON.parse(localStorage.getItem(rawKey)) || {};
    let changed = false;
    Object.keys(all).forEach((key) => {
      if (/\.captionPos\.\d+$/.test(key) || /\.caption\.\d+$/.test(key)) {
        delete all[key];
        changed = true;
      }
    });
    if (changed) localStorage.setItem(rawKey, JSON.stringify(all));
    localStorage.setItem(FLAG_KEY, "1");
  } catch (e) {
    /* storage non disponibile: non c'è nulla da migrare */
  }
})();

(function resetStaleZoomPositionsOnce() {
  const FLAG_KEY = "site-zoom-rebuild-v2";
  try {
    if (localStorage.getItem(FLAG_KEY)) return;
    
    // Clear size overrides for zoom
    const rawSizeKey = SIZE_STORE_KEY + ":d";
    let sizeAll = JSON.parse(localStorage.getItem(rawSizeKey)) || {};
    let sizeChanged = false;
    Object.keys(sizeAll).forEach((key) => {
      if (key.endsWith(".descriptionZoomSize")) {
        delete sizeAll[key];
        sizeChanged = true;
      }
    });
    if (sizeChanged) localStorage.setItem(rawSizeKey, JSON.stringify(sizeAll));

    // Clear position overrides for zoom
    const rawPosKey = POSITION_STORE_KEY + ":d";
    let posAll = JSON.parse(localStorage.getItem(rawPosKey)) || {};
    let posChanged = false;
    Object.keys(posAll).forEach((key) => {
      if (key.endsWith(".descriptionZoomPos")) {
        delete posAll[key];
        posChanged = true;
      }
    });
    if (posChanged) localStorage.setItem(rawPosKey, JSON.stringify(posAll));

    localStorage.setItem(FLAG_KEY, "1");
  } catch (e) {}
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
function makeMovableFree(node, key, title = "Trascina per spostare", { onMove, defaultOffset, dualHandles, alwaysVisible, lockAxis, dragLockAxis, dragOnNode, src, propType } = {}) {
  if (!node.style.position) node.style.position = "relative";

  // "defaultOffset" è la posizione di partenza quando non hai ancora
  // trascinato nulla TU in QUESTO browser (es. LAYOUT.gallery.imageOffset,
  // o l'"offset"/"captionOffset" di una singola voce di "images" in
  // content.js) — un trascinamento salvato la sovrascrive sempre.
  const pos = Object.assign({ x: 0, y: 0 }, defaultOffset, loadPositionOverrides()[key]);
  if (lockAxis === "x") pos.y = 0;
  if (lockAxis === "y") pos.x = 0;
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
    
    attachDragListener(h, h);
    return h;
  }

  function attachDragListener(targetEl, visualHandleEl) {
    targetEl.addEventListener("pointerdown", (e) => {
      if (!alwaysVisible && !isEditMode()) return;
      if (dragOnNode && (e.target.closest("button") || e.target.closest("figcaption") || e.target.classList.contains("resize-handle"))) return;
      
      // Se dentro "node" c'è un testo in modifica (es. la didascalia) con
      // ancora il cursore attivo, va salvato ORA: il preventDefault() qui
      // sotto impedisce anche lo sfocamento naturale che cliccando altrove
      // lo salverebbe da solo, quindi iniziare subito a trascinare senza
      // prima aver cliccato via avrebbe perso quello che hai appena scritto.
      if (document.activeElement && document.activeElement !== targetEl && node.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      e.preventDefault();
      e.stopPropagation();
      activeHandle = visualHandleEl;
      dragState = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
      if (visualHandleEl) visualHandleEl.classList.add("is-dragging");
      else node.classList.add("is-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  }

  if (dragOnNode) {
    attachDragListener(node, null);
  } else {
    createHandle();
    if (dualHandles) createHandle("move-handle-left");
  }

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    const rawX = dragState.baseX + (e.clientX - dragState.startX);
    const rawY = dragState.baseY + (e.clientY - dragState.startY);
    const newX = e.shiftKey ? snapToGrid(rawX) : rawX;
    const newY = e.shiftKey ? snapToGrid(rawY) : rawY;
    pos.x = lockAxis === "y" ? 0 : (dragLockAxis === "y" ? dragState.baseX : newX);
    pos.y = lockAxis === "x" ? 0 : (dragLockAxis === "x" ? dragState.baseY : newY);
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
    if (src && propType) {
      const props = {};
      props[propType] = { x: pos.x, y: pos.y };
      fetch('http://localhost:8000/api/save-image-props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, props })
      }).catch(e => console.error("Auto-save failed", e));
    }
  }

  return {
    reset() {
      // Torna alla posizione di DEFAULT (LAYOUT/content.js), non a (0,0):
      // con un "defaultOffset" impostato, (0,0) non è affatto "nessuno
      // spostamento", è un punto arbitrario come un altro.
      const base = Object.assign({ x: 0, y: 0 }, defaultOffset);
      pos.x = lockAxis === "y" ? 0 : base.x;
      pos.y = lockAxis === "x" ? 0 : base.y;
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
    return JSON.parse(localStorage.getItem(GUIDES_STORE_KEY + layoutScopeSuffix())) || {};
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
    localStorage.setItem(GUIDES_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: le guide restano comunque applicate per questa sessione */
  }
}

// Migrazione una tantum: prima di oggi posizioni/dimensioni/guide non
// distinguevano mobile da desktop (un solo store per ciascuna). Chi ha già
// sistemato foto/didascalie/guide si ritroverebbe tutto "sparito" appena
// il codice comincia a leggere le chiavi con suffisso ":d"/":m" invece di
// quelle vecchie senza suffisso — si copia tutto quel che c'era su ":d"
// (era comunque tutto fatto da desktop, il mobile non esisteva ancora
// come concetto separato), lasciando il vecchio store intatto (nessuna
// perdita se qualcosa andasse storto).
(function migrateLayoutStoresToDesktopScopeOnce() {
  const FLAG_KEY = "site-layout-scope-migration-v1";
  try {
    if (localStorage.getItem(FLAG_KEY)) return;
    [POSITION_STORE_KEY, SIZE_STORE_KEY, GUIDES_STORE_KEY].forEach((baseKey) => {
      const legacy = localStorage.getItem(baseKey);
      if (legacy != null && localStorage.getItem(baseKey + ":d") == null) {
        localStorage.setItem(baseKey + ":d", legacy);
      }
    });
    localStorage.setItem(FLAG_KEY, "1");
  } catch (e) {
    /* storage non disponibile: non c'è nulla da migrare */
  }
})();

// "pageEl" è ".page" (var. globale "app"): le guide vivono nel suo sistema
// di coordinate (position: relative), così scorrono col resto della
// pagina invece di restare incollate al viewport.
function setupAlignmentGuides(pageEl, galleryKey) {
  let guides = guidesFor(galleryKey).map((g) => ({ ...g }));
  let nextId = guides.reduce((max, g) => Math.max(max, g.id), 0) + 1;

  const layer = el("div", { class: "guides-layer" });
  const rulerH = el("div", { class: "guide-ruler guide-ruler-h", title: "Trascina verso il basso: crea una guida orizzontale, condivisa da tutte le foto della galleria" });
  const rulerV = el("div", { class: "guide-ruler guide-ruler-v", title: "Trascina verso destra: crea una guida verticale, condivisa da tutte le foto della galleria" });

  const pageZ = parseInt(pageEl.style.zIndex || window.getComputedStyle(pageEl).zIndex, 10);
  if (!isNaN(pageZ) && pageZ > 0) {
    rulerH.style.zIndex = (pageZ + 1).toString();
    rulerV.style.zIndex = (pageZ + 1).toString();
    layer.style.zIndex = (pageZ + 1).toString();
    
    // Se siamo nel pannello di zoom, attacchiamo i righelli al pannello stesso (beige)
    // così sono visibili e non persi nello sfondo nero.
    rulerH.style.position = "absolute";
    rulerV.style.position = "absolute";
  }

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

  if (!isNaN(pageZ) && pageZ > 0) {
    pageEl.appendChild(rulerH);
    pageEl.appendChild(rulerV);
  } else {
    document.body.appendChild(rulerH);
    document.body.appendChild(rulerV);
  }
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
function makeResizable(node, key, defaults = {}, { lockRatioTo, onResizeEnd, alwaysVisible, src, propType = "size" } = {}) {
  node.classList.add("resizable");
  if (alwaysVisible) node.classList.add("always-visible-label");
  if (!node.style.position) node.style.position = "relative";

  const overrides = loadSizeOverrides();
  const size = overrides[key] || {};
  const width = size.width || defaults.width;
  if (width) node.style.width = width;

  // L'altezza non è più forzata in JS: è il CSS (height: fit-content) 
  // a far avvolgere perfettamente l'immagine, eliminando gli spazi vuoti.

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
  // "signX" e "signY" invertono il segno dello spostamento orizzontale/verticale.
  function addHandle(extraClass, signX, signY = 1) {
    let classes = "resize-handle";
    if (alwaysVisible) classes += " always-visible";
    if (extraClass) classes += ` ${extraClass}`;
    const handle = el("div", { class: classes });
    node.appendChild(handle);

    let dragStart = null; // { pointerId, startX, startY, startWidth, startHeight, aspectRatio }

    function onPointerMove(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      const dx = (e.clientX - dragStart.startX) * signX;
      const dy = (e.clientY - dragStart.startY) * signY;
      
      let rawWidth = dragStart.startWidth;
      
      if (dragStart.aspectRatio) {
        // Per le foto, se stiamo trascinando una maniglia in alto o in basso,
        // l'utente potrebbe muoversi più verticalmente che orizzontalmente.
        // Prendiamo il movimento dominante in scala.
        const effectiveDx = Math.abs(dx) > Math.abs(dy * dragStart.aspectRatio) ? dx : dy * dragStart.aspectRatio;
        rawWidth = Math.max(40, dragStart.startWidth + effectiveDx);
      } else {
        rawWidth = Math.max(40, dragStart.startWidth + dx);
      }
      
      const newWidth = e.shiftKey ? snapToGrid(rawWidth) : rawWidth;
      
      let newHeight;
      if (dragStart.aspectRatio) {
        newHeight = Math.max(40, Math.round(newWidth / dragStart.aspectRatio));
      } else {
        const rawHeight = Math.max(40, dragStart.startHeight + dy);
        newHeight = e.shiftKey ? snapToGrid(rawHeight) : rawHeight;
      }
      
      node.style.width = `${newWidth}px`;
      updateLabel();
    }

    function onPointerUp(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      handle.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      saveSizeOverride(key, { width: node.style.width, height: node.style.height });
      if (src && propType === "size") {
        fetch('http://localhost:8000/api/save-image-props', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src, props: { width: node.style.width, height: node.style.height } })
        }).catch(e => console.error("Auto-save failed", e));
      }
      dragStart = null;
      if (onResizeEnd) onResizeEnd();
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!alwaysVisible && !isEditMode()) return;
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

  addHandle(null, 1, 1); // Bottom-Right
  if (lockRatioTo) {
    addHandle("resize-handle-left", -1, 1); // Bottom-Left
    addHandle("resize-handle-top", 1, -1); // Top-Right
    addHandle("resize-handle-top-left", -1, -1); // Top-Left
  }

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
    const rawHeight = Math.max(0, dragStart.startHeight + dy);
    const newHeight = e.shiftKey ? snapToGrid(rawHeight) : rawHeight;
    node.style.height = `${newHeight}px`;
  }
  function onPointerUp(e) {
    if (!dragStart || e.pointerId !== dragStart.pointerId) return;
    handle.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    saveSizeOverride(key, { width: node.style.width, height: node.style.height });
    if (src && propType === "size") {
      fetch('http://localhost:8000/api/save-image-props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, props: { width: node.style.width, height: node.style.height } })
      }).catch(e => console.error("Auto-save failed", e));
    }
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
  if (key === LIGHTBOX_SIZE_KEY) return `Dimensione dell'ingrandimento (lightbox), uguale per tutte le foto  →  solo una preferenza salvata nel browser, non c'è un equivalente in content.js`;

  if (key === "home.list") return `LAYOUT.home  →  aggiorna listWidth/listHeight in content.js`;

  const descMatch = key.match(/^project\.(.+)\.description$/);
  if (descMatch) return `Progetto "${descMatch[1]}"  →  aggiungi/aggiorna "descriptionBox" su quel progetto in PROJECTS`;

  const imgMatch = key.match(/^project\.(.+)\.image\.([\w-]+)$/);
  if (imgMatch) return `Progetto "${imgMatch[1]}", ${photoLabel(imgMatch[2])}  →  aggiorna width/height su quella voce di "images"`;
  
  const zoomMatch = key.match(/^project\.(.+)\.zoom\.([\w-]+)$/);
  if (zoomMatch) return `Progetto "${zoomMatch[1]}", ${photoLabel(zoomMatch[2])} (Ingrandimento)  →  aggiungi "zoomBox: { width, height }" a quella voce in "images"`;

  if (key === "archive.description") return `Core archive  →  aggiorna "descriptionBox" sull'oggetto ARCHIVE`;

  const archiveImgMatch = key.match(/^archive\.image\.([\w-]+)$/);
  if (archiveImgMatch) return `Core archive, ${photoLabel(archiveImgMatch[1])}  →  aggiorna width/height su quella voce di ARCHIVE.images`;
  
  const archiveZoomMatch = key.match(/^archive\.zoom\.([\w-]+)$/);
  if (archiveZoomMatch) return `Core archive, ${photoLabel(archiveZoomMatch[1])} (Ingrandimento)  →  aggiungi "zoomBox: { width, height }" a quella voce in ARCHIVE.images`;

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

// La pagina attualmente aperta, nello stesso formato delle chiavi di
// salvataggio (galleryKey/sizeKeyPrefix: "project.<slug>", "archive",
// "word.<id>", "simple.<titolo>", o "home"). Usata per far leggere al
// pannello "Esporta modifiche" SOLO le modifiche di QUESTA pagina — non
// tutte quelle accumulate nel browser su ogni pagina mai toccata, che
// altrimenti finirebbero mescolate insieme a quello che hai appena
// guardato, anche se non c'entrano nulla con questa modifica.
function currentExportKeyPrefix() {
  const { route, param } = parseHash();
  switch (route) {
    case "project": return `project.${param}`;
    case "archive": return "archive";
    case "word": return `word.${param}`;
    case "contacts": return `simple.${CONTACTS.title.toLowerCase()}`;
    case "about": return `simple.${ABOUT.title.toLowerCase()}`;
    default: return "home";
  }
}

// Le chiavi "composte" (dimensioni/ordine/posizione/didascalie) sono
// "<prefix>.qualcosa" (es. "project.lines.image.3"); quelle "a bucket"
// (foto eliminate/nuove, parole home, foto caricate) sono il prefix
// stesso, senza suffisso — vedi i rispettivi loadXxxOverrides() più sopra.
function belongsToCurrentPage(key, prefix) {
  return key === prefix || key.startsWith(`${prefix}.`);
}

function buildExportText() {
  const prefix = currentExportKeyPrefix();
  const sizeOverrides = loadSizeOverrides();
  const orderOverrides = loadOrderOverrides();
  const positionOverrides = loadPositionOverrides();
  const captionOverrides = loadCaptionOverrides();
  const descriptionOverrides = loadDescriptionOverrides();
  const removedOverrides = loadRemovedOverrides();
  const hiddenHomeRows = loadHiddenHomeRows();
  const extraOverrides = loadExtraImagesOverrides();
  const extraTextOverrides = loadExtraTextOverrides();
  const uploadedOverrides = loadUploadedImages();
  const linkOverrides = loadLinkOverrides();
  const sizeKeys = Object.keys(sizeOverrides).filter((k) => belongsToCurrentPage(k, prefix));
  const orderKeys = Object.keys(orderOverrides).filter((k) => belongsToCurrentPage(k, prefix));
  const positionKeys = Object.keys(positionOverrides).filter((k) => belongsToCurrentPage(k, prefix));
  const captionKeys = Object.keys(captionOverrides).filter((k) => belongsToCurrentPage(k, prefix));
  const descriptionKeys = Object.keys(descriptionOverrides).filter((k) => belongsToCurrentPage(k, prefix));
  const removedKeys = Object.keys(removedOverrides).filter((k) => k === prefix && removedOverrides[k].length);
  const hiddenHomeHasChanges = prefix === "home" && hiddenHomeRows.length > 0;
  const extraKeys = Object.keys(extraOverrides).filter((k) => k === prefix && extraOverrides[k].length);
  const extraTextKeys = Object.keys(extraTextOverrides).filter((k) => k === prefix && extraTextOverrides[k].length);
  const linkKeys = Object.keys(linkOverrides).filter((k) => belongsToCurrentPage(k, prefix));
  const hasUploads = Object.keys(uploadedOverrides).some((k) => k === prefix && Object.keys(uploadedOverrides[k] || {}).length);

  if (
    !sizeKeys.length &&
    !orderKeys.length &&
    !positionKeys.length &&
    !captionKeys.length &&
    !descriptionKeys.length &&
    !removedKeys.length &&
    !hiddenHomeHasChanges &&
    !extraKeys.length &&
    !extraTextKeys.length &&
    !linkKeys.length &&
    !hasUploads
  ) {
    return "Non hai ancora modificato nulla IN QUESTA PAGINA.\n\nL'export legge solo le modifiche della pagina che stai guardando ora, non quelle di tutto il sito — se hai già sistemato un'altra pagina, apri l'export da lì. Attiva la modalità modifica (bottone ⇲ in basso a destra): angolo in basso a destra = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta liberamente, × = elimina una foto, + = aggiungine una nuova, clicca su una didascalia per scriverla/correggerla. Poi torna qui.";
  }

  const lines = [
    "Modifiche personalizzate — copia i valori qui sotto (o manda a me",
    "questo testo) per aggiornare content.js e renderle permanenti sul",
    `sito pubblicato. Solo la pagina che stai guardando ora (${prefix}).`,
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

  if (descriptionKeys.length) {
    lines.push("=== TESTO GALLERIA ===", "");
    descriptionKeys.forEach((key) => {
      lines.push(`# ${key}`);
      lines.push(`  ${JSON.stringify(descriptionOverrides[key], null, 2)}`);
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

  if (hiddenHomeHasChanges) {
    lines.push("=== VOCI HOME NASCOSTE (×) ===", "");
    lines.push(`# Rimuovi dall'array PROJECTS in content.js i seguenti tag:`);
    lines.push(`  ${JSON.stringify(hiddenHomeRows)}`);
    lines.push("");
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

  if (linkKeys.length) {
    lines.push("=== LINK PAGINE (🔗) ===", "");
    linkKeys.forEach((key) => {
      lines.push(`# ${key}`);
      Object.keys(linkOverrides[key]).forEach((uid) => {
        const idMatch = uid.match(/^orig:(.+)$/);
        const label = idMatch ? photoLabel(idMatch[1]) : uid;
        lines.push(`  linkTo per ${label}: "${linkOverrides[key][uid]}"`);
      });
      lines.push("");
    });
  }
  
  const archivePages = loadArchivePages();
  if (prefix === "archive" && archivePages && archivePages.length > 0) {
    lines.push("=== CORE ARCHIVE PAGES ===", "");
    lines.push(JSON.stringify(archivePages, null, 2));
    lines.push("");
  }

  return lines.join("\n");
}

// Le foto caricate con "+" (vedi UPLOADED_IMAGE_STORE_KEY) restano solo
// nel browser di chi le ha caricate: qui un link di download per ciascuna,
// così puoi salvarle sul tuo computer e caricarle tu nel repository al
// posto del placeholder — il testo dell'export non può contenerle (sono
// dati binari, non testo). Solo quelle della pagina corrente, stesso
// filtro del resto del pannello (vedi currentExportKeyPrefix).
function buildUploadedPhotosSection(prefix) {
  const all = loadUploadedImages();
  const entries = [];
  Object.keys(all).forEach((galleryKey) => {
    if (galleryKey !== prefix) return;
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
  const uploadsSection = buildUploadedPhotosSection(currentExportKeyPrefix());

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
    if (!confirm("Sei sicuro di voler ripristinare tutte le modifiche IN QUESTA PAGINA?")) return;
    
    const prefix = currentExportKeyPrefix();
    
    // Chiavi di localStorage che contengono un oggetto (dizionario) le cui chiavi
    // interne usano il formato "prefix.qualcosa"
    const dictKeys = [
      SIZE_STORE_KEY, `${SIZE_STORE_KEY}:d`, `${SIZE_STORE_KEY}:m`,
      POSITION_STORE_KEY, `${POSITION_STORE_KEY}:d`, `${POSITION_STORE_KEY}:m`,
      GUIDES_STORE_KEY, `${GUIDES_STORE_KEY}:d`, `${GUIDES_STORE_KEY}:m`,
      ORDER_STORE_KEY,
      CAPTION_STORE_KEY,
      LINK_STORE_KEY
    ];
    
    dictKeys.forEach(k => {
      try {
        const str = localStorage.getItem(k);
        if (!str) return;
        const obj = JSON.parse(str);
        let changed = false;
        Object.keys(obj).forEach(objKey => {
          if (belongsToCurrentPage(objKey, prefix)) {
            delete obj[objKey];
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem(k, JSON.stringify(obj));
        }
      } catch (e) {}
    });
    
    // Chiavi di localStorage che contengono un oggetto le cui chiavi sono esattamente "prefix" (es: "project.lines")
    const bucketKeys = [
      REMOVED_STORE_KEY,
      EXTRA_IMAGES_STORE_KEY,
      EXTRA_TEXT_STORE_KEY,
      UPLOADED_IMAGE_STORE_KEY
    ];
    
    bucketKeys.forEach(k => {
      try {
        const str = localStorage.getItem(k);
        if (!str) return;
        const obj = JSON.parse(str);
        if (obj[prefix]) {
          delete obj[prefix];
          localStorage.setItem(k, JSON.stringify(obj));
        }
      } catch (e) {}
    });
    
    // Azzeramento specifico per home (lista nascosta) e core archive (struttura pagine)
    if (prefix === "home") {
      localStorage.removeItem(HOME_HIDDEN_STORE_KEY);
    }
    if (prefix === "archive") {
      localStorage.removeItem("site-archive-pages-v2");
    }

    // AUTO-SAVE FIX: If we cleared localStorage, we must also clear content.js
    // for all images in the current page so the reset actually takes effect!
    const isArchive = window.location.hash.startsWith("#/archive");
    const isSimple = window.location.hash.startsWith("#/simple/");
    let imagesToReset = [];
    
    if (isArchive && typeof ARCHIVE !== "undefined" && ARCHIVE.images) {
       imagesToReset = ARCHIVE.images;
    } else if (isSimple) {
       // not fully supported yet
    } else {
       const slug = prefix.replace(/^project\./, '');
       const proj = typeof PROJECTS !== "undefined" ? PROJECTS.find(p => p.slug === slug) : null;
       if (proj && proj.images) {
          imagesToReset = proj.images;
       }
    }
    
const fetchPromises = [];
    imagesToReset.forEach(img => {
       const src = img._src || img.src;
       if (src) {
         fetchPromises.push(
           fetch('http://localhost:8000/api/save-image-props', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               src, 
               props: { width: null, height: null, offset: null, captionOffset: null, zoomBox: null } 
             })
           }).catch(e => {})
         );
       }
    });

    Promise.all(fetchPromises).then(() => {
       setTimeout(() => location.reload(), 100);
    });
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
  if (document.querySelector(".edit-toggle")) return;

  const toggle = el("button", { class: "edit-toggle", style: "z-index: 99999 !important;", "aria-label": "Modifica", title: "Modifica: angolo = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta liberamente, × = elimina una foto, + = aggiungine una nuova, clicca su una didascalia per scriverla/correggerla" }, "⇲");

  toggle.addEventListener("click", async () => {
    const turningOff = document.body.classList.contains("edit-mode");
    
    if (turningOff) {
      toggle.textContent = "Salvataggio...";
      toggle.disabled = true;
      // Save texts to server
      const overrides = loadDescriptionOverrides();
      let allTextsSaved = true;
      for (const [key, textArray] of Object.entries(overrides)) {
        let slug = key;
        if (key.startsWith("project:")) slug = key.replace("project:", "");
        if (key === "core") slug = "core archive";
        
        try {
          await fetch('http://localhost:8000/api/save-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, text: textArray })
          });
        } catch (e) {
          console.error("Failed to save", slug, e);
          allTextsSaved = false;
        }
      }
      
      // Svuotiamo la cache locale per forzare la lettura dal file .txt al prossimo caricamento
      if (allTextsSaved && Object.keys(overrides).length > 0) {
        localStorage.removeItem(DESCRIPTION_STORE_KEY);
      }

      // Save archive pages to server
      try {
        const archivePagesLs = JSON.parse(localStorage.getItem("site-archive-pages-v2"));
        if (archivePagesLs && archivePagesLs.length > 0) {
          await fetch('http://localhost:8000/api/save-archive-pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: archivePagesLs })
          });
        }
      } catch (e) {
        console.error("Failed to save archive pages", e);
      }

      // Save image properties (like zoomBox) to server
      const sizeOverrides = loadSizeOverrides();
      for (const [key, size] of Object.entries(sizeOverrides)) {
        let src = null;
        
        const zoomMatch = key.match(/^project\.(.+)\.zoom\.(\d+)$/);
        if (zoomMatch) {
          const slug = zoomMatch[1];
          const idx = parseInt(zoomMatch[2], 10);
          const proj = PROJECTS.find(p => p.slug === slug);
          if (proj && proj.images && proj.images[idx]) {
            src = proj.images[idx]._src || proj.images[idx].src;
          }
        }
        
        const archiveMatch = key.match(/^archive\.zoom\.(\d+)$/);
        if (archiveMatch) {
          const idx = parseInt(archiveMatch[1], 10);
          if (typeof ARCHIVE !== "undefined" && ARCHIVE.images && ARCHIVE.images[idx]) {
            src = ARCHIVE.images[idx]._src || ARCHIVE.images[idx].src;
          }
        }
        
        const simpleMatch = key.match(/^simple\.(.+)\.zoom\.(\d+)$/);
        if (simpleMatch) {
          // Non c'è un posto centralizzato globale per cercare facilmente la galleria simple,
          // ma tipicamente il src in app.js per simple galleries è disponibile da getLinkOverride o simili.
          // Se servisse, si aggiungerà in futuro: per ora logghiamo.
          console.warn("Auto-save for simple gallery zoomBox not yet implemented, please use manual export");
        }
        
        if (src) {
          try {
            await fetch('http://localhost:8000/api/save-image-props', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ src, props: { zoomBox: size } })
            });
          } catch (e) {
            console.error("Failed to save image props for", src, e);
          }
        }
      }
      
      toggle.disabled = false;
      toggle.textContent = "⇲";
    } else {
      toggle.textContent = "💾";
    }

    document.body.classList.toggle("edit-mode");
    document.querySelectorAll(".photo .caption-input, .home-word-input, .topbar-index-input").forEach((input) => {
      input.readOnly = !isEditMode();
    });
    window.dispatchEvent(new Event("edit-mode-toggled"));
  });

  document.body.appendChild(toggle);

  const exportBtn = el(
    "button",
    {
      class: "export-toggle",
      style: "z-index: 99999 !important;",
      "aria-label": "Esporta modifiche",
      title: "Copia le modifiche da incollare in chat",
    },
    "⇩"
  );
  exportBtn.addEventListener("click", () => openExportPanel());
  document.body.appendChild(exportBtn);

  if (window.top === window) setupMobilePreviewToggle();
}

function setupMobilePreviewToggle() {
  const mobileBtn = el("button", {
    class: "mobile-preview-toggle",
    "aria-label": "Anteprima mobile",
    title: "Guarda il sito come su telefono — stesse modifiche disponibili, salvate a parte da quelle desktop",
  }, [el("span", { class: "phone-icon" })]);

  const closeBtn = el("button", { type: "button", class: "mobile-preview-close" }, "Chiudi anteprima");
  const iframe = el("iframe", { title: "Anteprima mobile del sito" });
  const device = el("div", { class: "mobile-preview-device" }, [iframe]);
  const overlay = el("div", { class: "mobile-preview-overlay" }, [device, closeBtn]);

  function open() {
    // Riparte sempre dalla pagina che stai guardando ORA, non dalla home:
    // così puoi controllare subito la galleria su cui stavi lavorando.
    iframe.src = location.href;
    overlay.classList.add("is-open");
  }
  function close() {
    overlay.classList.remove("is-open");
    iframe.src = "about:blank"; // ferma marquee/autoplay/audio invece di lasciarli girare invisibili
  }
  mobileBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });

  document.body.appendChild(mobileBtn);
  document.body.appendChild(overlay);
}

/* -------------------------------------------------------------------------
   4. Lightbox — clic per ingrandire, sfondo scuro. Due varianti:
   - foto (vedi makeZoomable): tecnica FLIP, l'immagine "vola" dalla sua
     posizione nello slider al centro dello schermo e viceversa;
   - testo (vedi openTextLightbox): overlay a scomparsa/dissolvenza
     classico, invariato.
   Disattivo in modalità modifica, per non aprirlo per sbaglio mentre si
   lavora sulla pagina.
   ------------------------------------------------------------------------- */
// Pannello beige ingrandito, singolo e riusato per ogni apertura (come
// zoomActiveImg per le foto): il contenuto (paragrafi) cambia ad ogni
// apertura, non l'elemento stesso.
let zoomTextPanel = null;

function ensureZoomTextPanel() {
  if (zoomTextPanel) return;
  zoomTextPanel = el("div", { class: "lightbox-text" });
  zoomTextPanel.id = "lightboxTextPanel";
  // Posizione impostata in riga per lo stesso motivo dello sfondo scuro
  // (vedi ensureZoomElements): un "position: fixed" senza left/right/top
  // in riga dipenderebbe dal solo CSS per centrarsi ed essere scrollabile
  // se il testo è lungo — qui mettiamo SOLO l'essenziale (struttura),
  // aspetto/larghezza restano nel foglio di stile (vedi ".lightbox-text").
  zoomTextPanel.style.position = "fixed";
  zoomTextPanel.style.top = "0";
  zoomTextPanel.style.left = "0";
  zoomTextPanel.style.right = "0";
  zoomTextPanel.style.maxHeight = "100vh";
  zoomTextPanel.style.overflowY = "auto";
  zoomTextPanel.style.zIndex = "301";
  zoomTextPanel.addEventListener("click", () => { if (zoomCurrentClose) zoomCurrentClose(); });
  document.body.appendChild(zoomTextPanel);
}

// Apertura e chiusura: translate(dalla posizione del blocco cliccato al
// centro schermo) + scale(0.94↔1) + dissolvenza in opacità, IDENTICI nelle
// due direzioni (stessa durata, stessa curva, solo la direzione invertita
// — vedi i commenti dentro openTextLightbox). A differenza del FLIP delle
// foto (vedi makeZoomable), qui il translate è calcolato rispetto al
// CENTRO DELLO SCHERMO, non al rettangolo esatto del pannello di arrivo:
// più semplice, e sul layout di questo sito il pannello ingrandito è
// comunque quasi centrato, quindi la differenza è trascurabile. Sfondo
// scuro condiviso con le foto (zoomBackdrop); a differenza delle foto, qui
// resta un vero rettangolo BEIGE (il "foglio" del sito), non un semplice
// contenuto su sfondo nero: il colore/aspetto restano quelli di
// ".lightbox-text" in style.css.
function openTextLightbox(paragraphs, sizeKeyPrefix, descBlock, pageTitle = "", defaultWidth = "auto") {
  // 3. Blocca la pagina di sfondo per impedire qualsiasi scorrimento o salto accidentale
  const originalBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const firstRect = descBlock.getBoundingClientRect();
  descBlock.style.opacity = "0";

  ensureZoomElements();
  ensureZoomTextPanel();
  const backdrop = zoomBackdrop;
  const panel = zoomTextPanel;

  backdrop.style.transition = "opacity 200ms ease-out";
  backdrop.classList.add("is-active");
  panel.classList.add("is-active");

  panel.innerHTML = "";
  
  if (pageTitle) {
    // Generate a topbar for the zoomed view
    // Usiamo lo stesso sizeKeyPrefix della main page (senza .zoom) così
    // il titolo legge (e salva) la stessa esatta posizione trascinata!
    const { topbar } = buildTopbar(sizeKeyPrefix, "", pageTitle, { hideIndex: true, hideHamburger: true });
    // Non usiamo position: absolute, lo facciamo scorrere nel flusso come nella pagina principale
    topbar.style.width = "100%";
    panel.appendChild(topbar);
  }

  // Rimuoviamo il padding hardcoded del lightbox, lo deleghiamo alla topbar e a .description
  panel.style.padding = "0";
  // NON forziamo il --panel-width: lasciamo che erediti il 740px globale dal CSS,
  // così il "foglio beige" dello zoom è grande esattamente quanto quello della main page.
  panel.style.removeProperty("--panel-width");

  const closeBtn = el("button", { class: "lightbox-close", "aria-label": "Chiudi", style: "color: var(--ink); z-index: 10;" }, "×");
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (zoomCurrentClose) zoomCurrentClose();
  });
  const content = el(
    "div",
    { class: "lightbox-text-content description-content" },
    paragraphs.map((p) => el("p", p === "" ? { style: "min-height: 1em;" } : {}, p || "\u00A0"))
  );
  
  const descTrack = el("div", { class: "description-track" }, [content]);
  const newDescBlock = el("div", { class: "description" }, [descTrack]);
  
  // Facciamo in modo che il blocco di testo sia largo esattamente quanto quello della pagina principale
  // (che l'utente potrebbe aver ridimensionato). In questo modo il testo andrà a capo in modo identico,
  // e i margini rispetto al "foglio beige" (che è 740px in entrambe le viste) saranno perfetti.
  newDescBlock.style.width = descBlock.style.width || "700px";

  // Rimuoviamo il paddingTop perché nella pagina principale il testo scorre verso l'alto (marquee)
  // ed è visibile fino al bordo superiore del blocco (tagliato da overflow: hidden).
  // Nello zoom, il testo è statico: togliendo il padding lo facciamo partire esattamente da quel bordo,
  // rendendo la distanza visiva dal titolo identica a quella della pagina principale.
  newDescBlock.style.paddingTop = "0";
  
  panel.appendChild(newDescBlock);
  panel.appendChild(closeBtn);

  if (sizeKeyPrefix) {
    // Il testo della main page è spostabile tramite .description. Facciamo lo stesso qui.
    // Usiamo LA STESSA CHIAVE della main page (senza .zoom) così le due viste
    // sono costantemente sincronizzate al pixel, usando anche gli stessi override dell'utente.
    const proj = PROJECTS.find(p => p.slug === sizeKeyPrefix);
    const defaultOffset = pickLayout(
      (proj && proj.descriptionBox && proj.descriptionBox.offset) || LAYOUT.gallery.descriptionOffset,
      proj && proj.descriptionBox && proj.descriptionBox.mobile && proj.descriptionBox.mobile.offset,
      LAYOUT.galleryMobile.descriptionOffset
    ) || LAYOUT.gallery.descriptionOffset;

    makeMovableFree(newDescBlock, `${sizeKeyPrefix}.descriptionPos`, "Trascina per spostare il testo", {
      alwaysVisible: true,
      defaultOffset: defaultOffset
    });
    
    // Non rendiamo ridimensionabile la larghezza qui perché il panel (--panel-width) gestisce già la larghezza
    // E l'altezza è automatica.
  }

  // Aggiunta pulsante Edit interno al lightbox e pannello debug misure
  const editZoomBtn = el("button", { style: "position: absolute; top: 10px; right: 60px; z-index: 1000; background: #2b2b28; color: #edebe0; padding: 6px 12px; border-radius: 4px; font-size: 13px;" }, "✏️ Edit Zoom");
  editZoomBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.body.classList.toggle("edit-mode");
    updateDebugPanel();
  });
  panel.appendChild(editZoomBtn);

  const debugPanel = el("div", { style: "position: absolute; top: 50px; right: 60px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-family: monospace; font-size: 12px; z-index: 1000; pointer-events: none; display: none; border-radius: 4px;" });
  panel.appendChild(debugPanel);

  function updateDebugPanel() {
    if (!document.body.classList.contains("edit-mode")) {
      debugPanel.style.display = "none";
      return;
    }
    debugPanel.style.display = "block";
    const titleEl = panel.querySelector(".topbar-title");
    const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;
    const textRect = content.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    let distTitleText = "N/A";
    if (titleRect) {
      distTitleText = Math.round(textRect.top - titleRect.top) + "px (da inizio titolo) / " + Math.round(textRect.top - titleRect.bottom) + "px (da fine titolo)";
    }
    const distTextBottom = Math.round(panelRect.bottom - textRect.bottom) + "px";
    
    debugPanel.innerHTML = `
      <div>Titolo-Testo: ${distTitleText}</div>
      <div>Testo-Fondo Pannello: ${distTextBottom}</div>
    `;
  }

  const debugObserver = new MutationObserver(updateDebugPanel);
  debugObserver.observe(content, { attributes: true, attributeFilter: ['style', 'class'] });
  const topbarTitleEl = panel.querySelector(".topbar-title");
  if (topbarTitleEl) debugObserver.observe(topbarTitleEl, { attributes: true, attributeFilter: ['style'] });
  
  // Abilita le guide per questa vista!
  const zoomGuides = setupAlignmentGuides(panel, `${sizeKeyPrefix}.zoom`);

  // APERTURA IMMEDIATA: nessuna transizione o ingrandimento.
  panel.style.transition = "none";
  panel.style.transform = "none";
  panel.style.opacity = "1";

  function onKeydown(e) {
    if (e.key === "Escape" && zoomCurrentClose) zoomCurrentClose();
  }
  document.addEventListener("keydown", onKeydown);

  zoomCurrentClose = function close() {
    debugObserver.disconnect();
    if (zoomGuides && zoomGuides.teardown) zoomGuides.teardown();
    // Chiusura del tutto immediata (nessuna transizione nemmeno sullo sfondo)
    backdrop.style.transition = "none";
    backdrop.classList.remove("is-active");

    panel.style.transition = "none";
    panel.style.transform = "none";
    panel.style.opacity = "0";
    
    closeBtn.style.opacity = "0";

    panel.classList.remove("is-active");
    panel.style.opacity = "";
    panel.innerHTML = "";
    descBlock.style.opacity = "1";
    document.removeEventListener("keydown", onKeydown);
    zoomCurrentClose = null;
    
    document.body.style.overflow = originalBodyOverflow;
  };
}

// Zoom foto con tecnica FLIP (First-Last-Invert-Play): l'immagine non
// compare al centro già ingrandita (come il vecchio lightbox), ma parte
// visivamente dalla sua posizione/misura ESATTA nello slider e "vola" fino
// al centro dello sfondo scuro, e viceversa alla chiusura — un vero
// zoom-in/zoom-out, non una semplice dissolvenza. Sfondo e immagine
// volante sono UN SOLO elemento ciascuno CONDIVISO DA TUTTE LE FOTO del
// sito (non uno per foto), creato la prima volta che apri una foto
// qualsiasi e riusato per tutte le successive: l'<img> del clone cambia
// solo "src".
// Dimensione dell'ingrandimento scelta a mano trascinando le maniglie (vedi
// makeZoomResizable): UNA sola misura salvata, condivisa da tutte le foto
// del sito ("uguale per tutte le foto") — non ha senso una misura diversa
// per ciascuna, è solo "quanto grande voglio vedere le foto quando le
// ingrandisco".
const LIGHTBOX_SIZE_KEY = "lightbox.image";

let zoomBackdrop = null;
// Il riquadro che vola (posizione/dimensione/transform) è un <div> a parte
// dall'<img> vero e proprio: un <img> è un elemento "replaced" e non può
// avere figli visibili, quindi le maniglie di resize devono appoggiarsi a
// questo contenitore, non all'immagine stessa.
let zoomActiveFrame = null;
let zoomActiveImg = null;
let zoomProjectLabel = null;
let zoomActiveSizeKey = null;
let zoomActiveOriginalSrc = null;

// La funzione di chiusura dell'apertura IN CORSO: il click su sfondo/
// immagine (agganciato una volta sola, vedi ensureZoomElements) deve
// sempre richiamare QUESTA, aggiornata a ogni apertura — non una copia
// fissata alla primissima foto mai aperta. Prima di questa correzione era
// una variabile locale a makeZoomable (quindi una per foto): il listener
// restava agganciato per sempre a quella della PRIMA foto cliccata in
// assoluto, quindi chiudere una foto diversa non faceva nulla (bug
// confermato: "chiudere funziona solo sulla prima foto, poi si blocca").
let zoomCurrentClose = null;

// Maniglie per regolare a mano la dimensione della foto ingrandita: due,
// una in basso e una speculare in alto (entrambe sul lato destro), così
// almeno una resta raggiungibile anche se il riquadro ingrandito supera
// l'altezza dello schermo. Sempre visibili (non solo in modalità
// modifica): è l'unico momento in cui ha senso regolarla, mentre la foto è
// davvera ingrandita davanti a te. Il ridimensionamento mantiene sempre le
// proporzioni NATURALI della foto (mai un ritaglio): un solo trascinamento
// orizzontale basta, l'altezza segue di conseguenza.
function makeZoomResizable(frame, img) {
  function addHandle(extraClass) {
    const classes = extraClass ? `resize-handle ${extraClass}` : "resize-handle";
    const handle = el("div", { class: classes, title: "Trascina per regolare la dimensione dell'ingrandimento" });
    frame.appendChild(handle);

    let dragStart = null; // { pointerId, startX, startWidth, startHeight, aspectRatio }
    
    let hud = document.getElementById("zoom-resize-hud");
    if (!hud) {
      hud = el("div", { id: "zoom-resize-hud" });
      hud.style.cssText = "position: absolute; bottom: -35px; right: 0; background: rgba(0,0,0,0.8); color: white; padding: 6px 10px; border-radius: 4px; font-family: ui-monospace, monospace; font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 1000;";
      frame.appendChild(hud);
    }

    function onPointerMove(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      const dx = e.clientX - dragStart.startX;
      const isLeft = extraClass && extraClass.includes("resize-handle-top");
      const effectiveDx = isLeft ? -dx : dx;
      const maxW = window.innerWidth - 96;
      const maxH = window.innerHeight - 96;
      let newWidth = Math.max(120, Math.min(maxW, dragStart.startWidth + effectiveDx));
      let newHeight = newWidth / dragStart.aspectRatio;
      if (newHeight > maxH) {
        newHeight = maxH;
        newWidth = newHeight * dragStart.aspectRatio;
      }
      frame.style.width = `${newWidth}px`;
      frame.style.height = `${newHeight}px`;
      // Ricentrata sullo schermo a ogni trascinamento: il riquadro ingrandito
      // è sempre centrato, quindi cambiarne solo larghezza/altezza senza
      // aggiornare anche left/top lo farebbe "scivolare" verso l'angolo in
      // basso a destra a ogni resize.
      frame.style.left = `${(window.innerWidth - newWidth) / 2}px`;
      frame.style.top = `${(window.innerHeight - newHeight) / 2}px`;
      
      hud.textContent = `${Math.round(newWidth)}px`;
      hud.style.opacity = "1";
      hud.style.background = "rgba(0,0,0,0.8)";
    }

    function onPointerUp(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      handle.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      // Aggiorniamo la "scatola" globale salvata in modo intelligente:
      // se l'utente restringe una foto verticale (cambiandone l'altezza come vincolo principale),
      // aggiorniamo l'altezza massima (maxH) ma non distruggiamo la larghezza massima (maxW),
      // altrimenti la prossima foto orizzontale apparirebbe piccolissima.
      const activeKey = zoomActiveSizeKey || LIGHTBOX_SIZE_KEY;
      const currentSaved = loadSizeOverrides()[activeKey] || {};
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const defaultMaxW = isMobile ? window.innerWidth - 16 : window.innerWidth * 0.85;
      const defaultMaxH = isMobile ? window.innerHeight - 16 : window.innerHeight * 0.82;
      
      let newMaxW = currentSaved.width ? parseFloat(currentSaved.width) : defaultMaxW;
      let newMaxH = currentSaved.height ? parseFloat(currentSaved.height) : defaultMaxH;

      const w = parseFloat(frame.style.width);
      const h = parseFloat(frame.style.height);
      const ratio = dragStart.aspectRatio;

      if (ratio >= 1) {
        newMaxW = w;
        if (h > newMaxH) newMaxH = h;
      } else {
        newMaxH = h;
        if (w > newMaxW) newMaxW = w;
      }

      saveSizeOverride(activeKey, { width: `${newMaxW}px`, height: `${newMaxH}px` });
      
      if (zoomActiveOriginalSrc) {
        hud.textContent = "Salvataggio...";
        fetch('http://localhost:8000/api/save-image-props', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src: zoomActiveOriginalSrc, props: { zoomBox: { width: `${newMaxW}px`, height: `${newMaxH}px` } } })
        }).then(async res => {
          const data = await res.json();
          if (data.success) {
            hud.style.background = "#2b7a4b";
            hud.textContent = `[OK] Salvato su content.js (${Math.round(newMaxW)}px)`;
            console.log(`[OK] Zoom foto aggiornato a ${Math.round(newMaxW)}px su disco`);
            setTimeout(() => { hud.style.opacity = "0"; }, 1500);
          } else {
            throw new Error("Success false");
          }
        }).catch(e => {
          console.error("Auto-save failed", e);
          hud.style.background = "#dc2626";
          hud.textContent = "Errore salvataggio";
          setTimeout(() => { hud.style.opacity = "0"; }, 1500);
        });
      } else {
        setTimeout(() => { hud.style.opacity = "0"; }, 1500);
      }
      dragStart = null;
    }

    handle.addEventListener("pointerdown", (e) => {
      if (!isEditMode()) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = frame.getBoundingClientRect();
      dragStart = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startWidth: rect.width,
        startHeight: rect.height,
        aspectRatio: img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : rect.width / rect.height,
      };
      handle.classList.add("is-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    });
  }

  addHandle(null);
  addHandle("resize-handle-top");
}

function ensureZoomElements() {
  if (zoomBackdrop) return;
  zoomBackdrop = el("div", { class: "lightbox-backdrop" });
  zoomBackdrop.id = "lightboxBackdrop";
  // Geometria e colore impostati QUI, in riga, invece di lasciarli solo al
  // CSS: dopo aver scoperto che "inset: 0" veniva ignorato su alcuni
  // browser (lasciando lo sfondo scuro senza nessuna dimensione, con la
  // pagina beige visibile sotto la foto), lo sfondo di QUESTO elemento non
  // deve più dipendere da nessuna regola esterna che potrebbe non
  // applicarsi — vince sempre lo stile in riga, qualunque cosa succeda al
  // foglio di stile. Colore pieno (niente alpha/trasparenza: prima era
  // rgba(13,13,13,0.96), un 4% di trasparenza che sommato a un eventuale
  // problema di copertura peggiorava l'effetto "residuo").
  zoomBackdrop.style.position = "fixed";
  zoomBackdrop.style.top = "0";
  zoomBackdrop.style.left = "0";
  zoomBackdrop.style.width = "100%";
  zoomBackdrop.style.height = "100vh";
  zoomBackdrop.style.background = "#161616";
  zoomBackdrop.style.zIndex = "300";
  zoomActiveFrame = el("div", { class: "lightbox-active-frame" });
  zoomActiveFrame.id = "lightboxActiveFrame";
  zoomActiveImg = el("img", { class: "lightbox-active-img" });
  zoomActiveImg.id = "lightboxActiveImg";
  zoomProjectLabel = el("div", { class: "lightbox-project-label", style: "display: none; position: absolute; left: calc(100% + 80px); top: 50%; transform: translateY(-50%); font-family: 'Strichpunkt Sans', Helvetica, Arial, sans-serif; font-size: 0.9rem; font-weight: 550; color: var(--paper); cursor: pointer; white-space: nowrap; pointer-events: auto; padding: 10px;" });
  zoomActiveFrame.appendChild(zoomActiveImg);
  zoomActiveFrame.appendChild(zoomProjectLabel);
  makeZoomResizable(zoomActiveFrame, zoomActiveImg);
  const triggerClose = () => { if (zoomCurrentClose) zoomCurrentClose(); };
  zoomBackdrop.addEventListener("click", triggerClose);
  zoomActiveImg.addEventListener("click", triggerClose);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") triggerClose();
  });
  document.body.appendChild(zoomBackdrop);
  document.body.appendChild(zoomActiveFrame);
}

function makeZoomable(frame, img, linkTo, sizeKey, zoomBox) {
  frame.addEventListener("click", () => {
    if (isEditMode()) return;
    
    zoomActiveSizeKey = sizeKey;
    zoomActiveOriginalSrc = img.getAttribute("src") || img.src;

    // 1. FIRST: coordinate della miniatura nello slider.
    const firstRect = img.getBoundingClientRect();

    // Nasconde temporaneamente l'originale (niente "doppione" per l'istante
    // in cui il clone appare esattamente sopra di lei).
    img.style.opacity = "0";

    ensureZoomElements();
    const backdrop = zoomBackdrop;
    const activeFrame = zoomActiveFrame;
    const activeImg = zoomActiveImg;

    if (linkTo) {
      const parts = linkTo.split("/");
      let labelName = linkTo;
      if (parts[0] === "project" && parts[1]) {
        const proj = PROJECTS.find(p => p.slug === parts[1]);
        if (proj) labelName = proj.name.toLowerCase();
      } else if (linkTo === "archive") {
        labelName = ARCHIVE.title.toLowerCase();
      }
      zoomProjectLabel.innerText = labelName;
      zoomProjectLabel.style.display = "block";
      
      // Simula hover css via js perché è l'unico punto in cui lo gestiamo
      zoomProjectLabel.onmouseenter = () => zoomProjectLabel.style.opacity = "0.7";
      zoomProjectLabel.onmouseleave = () => zoomProjectLabel.style.opacity = "1";
      
      zoomProjectLabel.onclick = (e) => {
        e.stopPropagation();
        if (zoomCurrentClose) zoomCurrentClose();
        // Diamo il tempo all'animazione di chiusura di partire prima di navigare
        setTimeout(() => location.hash = `#/${linkTo}`, 50);
      };
    } else {
      zoomProjectLabel.style.display = "none";
      zoomProjectLabel.onclick = null;
    }

    // Lo sfondo scuro arriva SUBITO (200ms, molto più rapido delle 850ms
    // del volo della foto): deve coprire il beige/testo della pagina ben
    // prima che la foto finisca di ingrandirsi, altrimenti per gran parte
    // dell'animazione si vede la pagina reale trasparire attraverso uno
    // sfondo ancora a metà dissolvenza — il "residuo beige con testo"
    // segnalato. Impostato ogni volta esplicitamente (non lasciato alla
    // regola CSS di base): altrimenti resterebbe quello impostato
    // dall'ultima CHIUSURA (vedi sotto), con un ritardo che qui non ha senso.
    backdrop.style.transition = "opacity 200ms ease-out";
    backdrop.classList.add("is-active");
    // Riattiva i click sul clone SOLO mentre è davvero visibile: senza
    // questa classe, a fine chiusura il clone resta comunque nel DOM
    // (a grandezza/posizione della miniatura, "position: fixed") e
    // intercetterebbe per sempre i click su qualunque cosa si trovi in
    // quello stesso punto dello schermo — bug confermato con un test
    // automatico (impossibile riaprire una foto in quella posizione).
    activeFrame.classList.add("is-active");

    // 2. LAST: dimensione finale, centrata sullo schermo. Se in precedenza
    // hai già trascinato le maniglie di resize (su QUALSIASI foto — la
    // misura è unica e condivisa, vedi LIGHTBOX_SIZE_KEY), quella misura
    // sostituisce il solito 85%/82% dello schermo come INGOMBRO MASSIMO:
    // le proporzioni restano comunque quelle NATURALI di QUESTA foto (mai
    // deformata), semplicemente adattata (in scala, non stirata) dentro
    // l'ingombro scelto — così una foto orizzontale e una verticale
    // condividono la stessa misura "sentita" senza mai apparire distorte,
    // e soprattutto lo scaleX/scaleY del volo FLIP restano sempre uguali
    // fra loro (nessuno "schiacciamento" a metà animazione, lo stesso bug
    // già risolto per il testo).
    const activeKey = sizeKey || LIGHTBOX_SIZE_KEY;
    const savedSize = loadSizeOverrides()[activeKey] || zoomBox;
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const defaultMaxW = isMobile ? window.innerWidth - 16 : window.innerWidth * 0.85;
    const defaultMaxH = isMobile ? window.innerHeight - 16 : window.innerHeight * 0.82;
    // Su mobile ignora del tutto eventuali ridimensionamenti salvati (che
    // impedirebbero di andare a filo), forzando il default 100% - 16px.
    const maxW = savedSize && savedSize.width && !isMobile ? Math.min(parseFloat(savedSize.width), window.innerWidth - 32) : defaultMaxW;
    const maxH = savedSize && savedSize.height && !isMobile ? Math.min(parseFloat(savedSize.height), window.innerHeight - 32) : defaultMaxH;
    const ratio = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : (firstRect.width / firstRect.height);

    let targetW = maxW;
    let targetH = targetW / ratio;
    if (targetH > maxH) {
      targetH = maxH;
      targetW = targetH * ratio;
    }
    let targetX = (window.innerWidth - targetW) / 2;
    if (sizeKey && sizeKey.startsWith("archive.") && !isMobile) {
      targetX = (window.innerWidth / 2 - targetW) / 2;
      if (targetX < 16) targetX = 16; // non incollato al bordo
    }
    const targetY = (window.innerHeight - targetH) / 2;

    activeImg.src = img.src;
    activeImg.alt = img.alt;
    activeFrame.style.width = `${targetW}px`;
    activeFrame.style.height = `${targetH}px`;
    activeFrame.style.left = `${targetX}px`;
    activeFrame.style.top = `${targetY}px`;

    // 3. INVERT: delta centro-miniatura → centro-target.
    const firstCenterX = firstRect.left + firstRect.width / 2;
    const firstCenterY = firstRect.top + firstRect.height / 2;
    const targetCenterX = targetX + targetW / 2;
    const targetCenterY = targetY + targetH / 2;

    const deltaX = firstCenterX - targetCenterX;
    const deltaY = firstCenterY - targetCenterY;
    let scaleX = firstRect.width / targetW;
    let scaleY = firstRect.height / targetH;

    if (img.classList.contains("hidden-link-img")) {
      const uniformScale = Math.max(scaleX, scaleY);
      scaleX = uniformScale;
      scaleY = uniformScale;
    }

    // Porta il clone esattamente sopra la miniatura, ancora invisibile agli occhi.
    activeFrame.style.transition = "none";
    activeFrame.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;

    // 4. PLAY: anima verso il centro.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        activeFrame.style.transition = "transform 850ms cubic-bezier(0.16, 1, 0.3, 1)";
        activeFrame.style.transform = "translate(0px, 0px) scale(1)";
      });
    });

    zoomCurrentClose = function close() {
      // Ricalcola la miniatura al MOMENTO della chiusura (se nel frattempo
      // hai scrollato la pagina, "firstRect" sarebbe ormai vecchia).
      const currentThumbRect = img.getBoundingClientRect();
      const thumbCenterX = currentThumbRect.left + currentThumbRect.width / 2;
      const thumbCenterY = currentThumbRect.top + currentThumbRect.height / 2;

      // Ricalcola anche il riquadro ingrandito AL MOMENTO della chiusura
      // (non i "targetW/targetH/targetCenterX/Y" catturati all'apertura):
      // se nel frattempo hai trascinato le maniglie di resize, il riquadro
      // ha ormai una misura/posizione diversa da quella iniziale, e la
      // trasformazione CSS calcola sempre a partire dalla sua misura
      // ATTUALE — usare valori vecchi farebbe atterrare il volo di ritorno
      // nel punto/scala sbagliati.
      const currentFrameRect = activeFrame.getBoundingClientRect();
      const frameCenterX = currentFrameRect.left + currentFrameRect.width / 2;
      const frameCenterY = currentFrameRect.top + currentFrameRect.height / 2;

      let closingDeltaX = thumbCenterX - frameCenterX;
      let closingDeltaY = thumbCenterY - frameCenterY;
      let closingScaleX = currentThumbRect.width / currentFrameRect.width;
      let closingScaleY = currentThumbRect.height / currentFrameRect.height;
      
      // Se la miniatura è un'immagine nascosta sotto una parola, non ha senso
      // farla volare indietro fino a diventare minuscola per poi sparire
      // (perché la miniatura vera e propria è invisibile).
      // Piuttosto, la facciamo sfumare dolcemente sul posto.
      if (img.classList.contains("hidden-link-img")) {
        closingDeltaX = 0;
        closingDeltaY = 0;
        closingScaleX = 0.95;
        closingScaleY = 0.95;
        activeFrame.style.transition = "transform 400ms ease-out, opacity 300ms ease-out";
        activeFrame.style.opacity = "0";
      } else {
        activeFrame.style.transition = "transform 550ms cubic-bezier(0.25, 1, 0.5, 1)";
      }

      // Lo sfondo scuro resta PIENO per quasi tutto il ritorno della foto
      // (400ms di ritardo) e sparisce solo negli ultimi 150ms, quando la
      // foto è ormai tornata quasi esattamente al suo posto: 400+150 = gli
      // stessi 550ms del volo, ma senza mai mostrare insieme "foto ancora
      // a metà volo" e "pagina beige/testo reale già visibile sotto" — lo
      // stesso "residuo" del volo di apertura, ma in chiusura.
      backdrop.classList.remove("is-active");
      backdrop.style.transition = "opacity 150ms ease-in 400ms";

      activeFrame.style.transform = `translate(${closingDeltaX}px, ${closingDeltaY}px) scale(${closingScaleX}, ${closingScaleY})`;

      setTimeout(() => {
        activeFrame.classList.remove("is-active");
        activeFrame.style.transition = "none";
        activeFrame.style.transform = "";
        activeFrame.style.opacity = "1"; // Ripristina per le prossime foto
        // Ripulisce TUTTO quello che l'apertura aveva impostato (misura,
        // posizione, alt), non solo "src": un <img> senza "src" ma con
        // ancora l'"alt" di prima (es. "house, norway") e le vecchie
        // width/height/left/top mostra in molti browser l'iconcina di
        // "immagine non trovata" seguita dal testo alt — esattamente il
        // glitch segnalato ("quella caption" accanto a un'icona rotta),
        // perché backdrop/activeFrame/activeImg sono UN SOLO elemento
        // riusato da ogni foto e prima restava con gli attributi della foto
        // precedente.
        activeFrame.style.width = "";
        activeFrame.style.height = "";
        activeFrame.style.left = "";
        activeFrame.style.top = "";
        activeImg.removeAttribute("alt");
        // "activeImg.src = ''" (come nel codice originale) in molti browser
        // fa ripartire una richiesta verso la PAGINA STESSA, non verso
        // "nessuna immagine" — bug confermato: dopo la chiusura, "src"
        // risultava l'URL della pagina invece che vuoto. removeAttribute
        // toglie l'attributo senza scatenare nessuna richiesta.
        activeImg.removeAttribute("src");
        if (!img.classList.contains("hidden-link-img")) {
          img.style.opacity = "1";
        }
        zoomCurrentClose = null;
      }, 550);
    };
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
  if (image.src) return `${image.src}?v=${IMAGE_VERSION}`;
  return placeholderImg(`${seed}-${index}`, image.caption || `${seed} ${index + 1}`);
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
      
      const input = el("input", {
        type: "text",
        class: "home-word-input",
        value: project.name,
      });
      input.readOnly = !isEditMode();
      input.addEventListener("input", () => {
        // Aggiorna visivamente e invia al server
        project.name = input.value.trim();
        fetch('http://localhost:8000/api/rename-project', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ slug: project.slug, newName: project.name })
        }).catch(e => console.error(e));
        syncWordInputWidth(input);
      });
      input.addEventListener("mousedown", (e) => {
        if (!isEditMode()) e.preventDefault();
      });
      input.addEventListener("click", () => {
        if (isEditMode()) return;
        location.hash = `#/project/${project.slug}`;
      });

      const deleteBtn = el(
        "button",
        { type: "button", class: "home-word-delete-btn", title: "Togli dalla home", "aria-label": "Togli dalla home" },
        "×"
      );
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isEditMode()) return;
        if (!confirm(`Togliere "${project.name}" dalla home? La pagina resterà comunque raggiungibile, solo non più elencata.`)) return;
        hideHomeRow(tag);
        renderRoute();
      });
      return el("li", { class: "home-word-row" }, [input, deleteBtn]);
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

  const viewAllPhotosBtn = el("button", { type: "button", class: "home-view-all-photos-btn" }, "Vedi tutte le foto");
  viewAllPhotosBtn.addEventListener("click", () => {
    if (!isEditMode()) return;
    openAllPhotosIndex();
  });

  const spacer = el("div", { class: "home-spacer" });

  const footer = el(
    "footer",
    { class: "home-footer" },
    FOOTER_LINKS.map((l) => el("a", { href: l.hash, class: "footer-link" }, l.label))
  );

  const actionsRow = el("div", { style: "display: flex; gap: 10px; flex-wrap: wrap;" }, [addWordBtn, viewAllPhotosBtn]);

  app.appendChild(header);
  app.appendChild(list);
  app.appendChild(actionsRow);
  app.appendChild(spacer);
  app.appendChild(footer);

  // La larghezza va misurata ORA che gli <input> sono davvero nel
  // documento (con il font vero, ereditato) — prima di essere agganciati
  // al DOM, "getComputedStyle" non avrebbe ancora il font giusto da
  // misurare.
  list.querySelectorAll(".home-word-input").forEach((input) => syncWordInputWidth(input));

  const resizeObserver = makeResizable(list, "home.list", {
    width: desktopOnly(LAYOUT.home.listWidth),
    height: LAYOUT.home.listHeight,
  });

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
function buildTopbar(keyPrefix, indexText, titleText, { onIndexChange, hideIndex, hideHamburger } = {}) {
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
  if (hideIndex) topbarIndexEl.style.visibility = "hidden";
  const topbarTitleEl = el("span", { class: "topbar-title" }, titleText);
  const hamburgerEl = el("a", { href: "#/", class: "hamburger", "aria-label": "Torna alla home" }, [
    el("span", {}), el("span", {}), el("span", {}),
  ]);
  if (hideHamburger) hamburgerEl.style.visibility = "hidden";
  makeMovableFree(topbarIndexEl, `${keyPrefix}.topbarIndexPos`, "Trascina per spostare il numero", {
    defaultOffset: pickLayout(LAYOUT.gallery.topbarIndexOffset, undefined, LAYOUT.galleryMobile.topbarIndexOffset),
  });
  makeMovableFree(topbarTitleEl, `${keyPrefix}.topbarTitlePos`, "Trascina per spostare il titolo", {
    defaultOffset: pickLayout(LAYOUT.gallery.topbarTitleOffset, undefined, LAYOUT.galleryMobile.topbarTitleOffset),
  });
  makeMovableFree(hamburgerEl, `${keyPrefix}.hamburgerPos`, "Trascina per spostare l'hamburger", {
    defaultOffset: pickLayout(LAYOUT.gallery.hamburgerOffset, undefined, LAYOUT.galleryMobile.hamburgerOffset),
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
  // Riusa lo stesso meccanismo delle foto eliminate (REMOVED_STORE_KEY),
  // con lo stesso id "per contenuto" (vedi descriptionRemovalId più sopra):
  // se il TESTO di content.js cambia, torna visibile da solo, anche se una
  // versione precedente era stata eliminata col tasto "×".
  // Un array vuoto in content.js (vedi "michelin", "tower", ecc.) nasconde
  // il blocco allo stesso modo del flag salvato dal tasto "×": è il modo
  // permanente di "togliere la descrizione" richiesto dall'export panel,
  // dato che description.map() più sotto ha comunque bisogno di un array.
  const savedDesc = loadDescriptionOverrides()[galleryKey];
  const activeDescription = savedDesc || description;
  const descriptionRemoved = removedIdsFor(sizeKeyPrefix).includes(descriptionRemovalId(description)) || !activeDescription.some(t => t.trim());

  let bottomIndexEl; // assegnato più sotto, ma la callback lo usa solo su un futuro "input" dell'utente
  const { topbar, resolvedIndexText } = buildTopbar(sizeKeyPrefix, String(indexNumber), title, {
    onIndexChange: (text) => { if (bottomIndexEl) bottomIndexEl.textContent = text; },
  });

  const defaultDescHeight = (descriptionBox && descriptionBox.height) || LAYOUT.gallery.descriptionHeight;
  const hasExplicitDescHeight = Boolean(defaultDescHeight || loadSizeOverrides()[`${sizeKeyPrefix}.description`]?.height);
  
  // Normalizziamo l'array: separiamo eventuali "\n" in nuovi elementi
  const normalizedDescription = activeDescription
    .flatMap(text => text.split(/\n/))
    .map(s => s.trim());

  // Creiamo i paragrafi in modo nativo così il CSS originale ".description p+p" li formatta correttamente
  const makeParagraphs = (texts) => texts.map((paragraph) => el("p", paragraph === "" ? { class: "spacer" } : { html: paragraph }));
  
  const descContent = el("div", { class: "description-content" }, makeParagraphs(normalizedDescription));
  const secondCopyWrapper = el("div", { class: "description-clone", "aria-hidden": "true" }, makeParagraphs(normalizedDescription));
  
  const marqueeGap = el("div", { class: "marquee-gap" });
  marqueeGap.style.height = "100vh";
  
  const descTrack = el("div", { class: "description-track" }, [descContent, marqueeGap, secondCopyWrapper]);
  const descBlock = el("div", { class: "description" }, [descTrack]);

  // Gestione Edit Mode dinamica
  const updateDescEditable = () => {
    if (isEditMode()) {
      descContent.contentEditable = "true";
      descContent.style.outline = "1px dashed #ccc";
      descContent.style.cursor = "text";
      secondCopyWrapper.style.display = "none";
      marqueeGap.style.display = "none";
      descTrack.style.transform = "none"; // Ferma il marquee
    } else {
      descContent.contentEditable = "false";
      descContent.style.outline = "none";
      descContent.style.cursor = "";
      secondCopyWrapper.style.display = "block";
      marqueeGap.style.display = "block";
      // Il marquee riparte automaticamente al prossimo frame di requestAnimationFrame (perché updateMarquee è sempre in loop)
    }
  };
  
  updateDescEditable();
  window.addEventListener("edit-mode-toggled", updateDescEditable);

  // Per salvare mantenendo il formato paragrafo corretto
  descContent.addEventListener("input", () => {
    if (!isEditMode()) return;
    // contenteditable genera div o p o br a seconda del browser, estraiamo l'innerText pulito
    const text = descContent.innerText;
    if (!text.trim()) {
      clearDescriptionOverride(galleryKey);
    } else {
      const newArray = text.split(/\n/).map(s => s.trim()).filter(s => s !== "");
      saveDescriptionOverride(galleryKey, newArray);
      
      // Aggiorna silenziosamente il clone in background così è pronto quando si esce da Edit Mode
      secondCopyWrapper.innerHTML = "";
      makeParagraphs(newArray).forEach(p => secondCopyWrapper.appendChild(p));
    }
  });
  
  // Se non c'è un'altezza forzata salvata o in content.js, lasciamo l'altezza automatica (fit-content)
  if (hasExplicitDescHeight) {
    const explicitHeight = pickLayout(
      defaultDescHeight,
      descriptionBox && descriptionBox.mobile && descriptionBox.mobile.height,
      LAYOUT.galleryMobile.descriptionHeight
    ) || defaultDescHeight;
    
    // Ripristiniamo esplicitamente l'altezza poiché makeResizable la ignora per le foto
    if (explicitHeight) descBlock.style.height = explicitHeight;

    resizeObservers.push(
      makeResizable(descBlock, `${sizeKeyPrefix}.description`, {
        width: pickLayout(
          (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
          descriptionBox && descriptionBox.mobile && descriptionBox.mobile.width,
          LAYOUT.galleryMobile.descriptionWidth
        ) || (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
        height: explicitHeight,
      })
    );
  } else {
    // Rendiamo resizable solo la larghezza, l'altezza si adatta al testo
    resizeObservers.push(
      makeResizable(descBlock, `${sizeKeyPrefix}.description`, {
        width: pickLayout(
          (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
          descriptionBox && descriptionBox.mobile && descriptionBox.mobile.width,
          LAYOUT.galleryMobile.descriptionWidth
        ) || (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
        height: "auto",
      })
    );
  }
  
  makeMovableFree(descBlock, `${sizeKeyPrefix}.descriptionPos`, "Trascina per spostare il testo", {
    defaultOffset: pickLayout(
      (descriptionBox && descriptionBox.offset) || LAYOUT.gallery.descriptionOffset,
      descriptionBox && descriptionBox.mobile && descriptionBox.mobile.offset,
      LAYOUT.galleryMobile.descriptionOffset
    ),
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
    markImageRemoved(sizeKeyPrefix, descriptionRemovalId(description));
    renderRoute();
  });
  descBlock.appendChild(descDeleteBtn);

  const captionOverrides = loadCaptionOverrides();

  const figures = images.map((image, i) => {
    const origIndex = image._index != null ? image._index : i;
    let inlineStyle = "";
    const imgAttrs = { src: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", alt: image.caption || "", decoding: "async" };
    if (image.zoomBox && image.zoomBox.width && image.zoomBox.height) {
      const w = parseFloat(image.zoomBox.width);
      const h = parseFloat(image.zoomBox.height);
      if (!isNaN(w) && !isNaN(h) && h > 0) {
        inlineStyle = `aspect-ratio: ${w} / ${h};`;
        imgAttrs.width = w;
        imgAttrs.height = h;
      }
    }
    if (inlineStyle) imgAttrs.style = inlineStyle + " transition: opacity 0.3s; opacity: 0;";
    else imgAttrs.style = "transition: opacity 0.3s; opacity: 0;";
    const img = el("img", imgAttrs);
    
    const preloader = new Image();
    preloader.onload = () => {
      img.src = preloader.src;
      img.style.opacity = "1";
      const p = img.closest(".photo-track");
      if (p) p.offsetHeight;
      if (typeof updateViewportHeight === "function") updateViewportHeight();
    };
    preloader.onerror = () => {
      const fig = img.closest("figure.photo");
      if (fig) fig.style.display = "none";
    };
    preloader.src = image._src;
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
    const captionInput = el("textarea", {
      class: "caption-input",
      placeholder: "scrivi qui la didascalia",
      rows: "1",
    });
    captionInput.value = captionText;
    captionInput.readOnly = !isEditMode();
    
    const adjustHeight = () => {
      captionInput.style.height = "auto";
      captionInput.style.height = captionInput.scrollHeight + "px";
    };
    
    captionInput.addEventListener("input", () => {
      adjustHeight();
      const text = captionInput.value.trim();
      if (text) saveCaptionOverride(captionKey, text);
      else clearCaptionOverride(captionKey);
    });
    
    // Imposta l'altezza iniziale una volta aggiunto al DOM
    setTimeout(adjustHeight, 0);
    const figcaption = el("figcaption", { class: "caption-box" }, [captionInput]);
    
    resizeObservers.push(
      makeResizable(
        figcaption,
        `${sizeKeyPrefix}.captionSize.${origIndex}`,
        { width: image.captionWidth || "240px" },
        {
          onResizeEnd: () => {
            adjustHeight();
          }
        }
      )
    );
    
    const captionMove = makeMovableFree(
      figcaption,
      `${sizeKeyPrefix}.captionPos.${origIndex}`,
      "Trascina per spostare la didascalia",
      {
        src: image.src,
        propType: "captionOffset",
        // Ricalcola l'altezza del viewport ad ogni istante del trascinamento,
        // non solo al rilascio: altrimenti, per tutta la durata del drag, il
        // pezzo di didascalia che via via esce dall'altezza calcolata finora
        // resterebbe tagliato da "overflow: hidden" finché non la rilasci.
        onMove: () => { if (i === current) updateViewportHeight(); },
        defaultOffset: pickLayout(
          image.captionOffset || LAYOUT.gallery.captionOffset,
          image.mobile && image.mobile.captionOffset,
          LAYOUT.galleryMobile.captionOffset
        ),
        dualHandles: true,
        lockAxis: "x",
      }
    );

    resizeObservers.push(
      makeResizable(
        frame,
        `${sizeKeyPrefix}.image.${origIndex}`,
        // Niente default qui: se non c'è né un salvataggio né una misura
        // esplicita in content.js, l'altezza la calcola/applica
        // applyDefaultPhotoHeights() più sotto (stessa altezza per tutte
        // le foto, in base allo spazio lasciato libero dal testo). Su
        // mobile una misura desktop esplicita in content.js (pensata per
        // il pannello da 740px) viene ignorata a meno che la foto non
        // abbia anche un "mobile.width/height" dedicato — senza, la foto
        // passa allo stesso calcolo automatico invece di restare fissa
        // a una larghezza pensata per tutt'altro schermo (vedi anche
        // isUntouched() più sotto, che deve ignorarla allo stesso modo).
        {
          width: pickLayout(image.width, image.mobile && image.mobile.width, undefined),
          height: pickLayout(image.height, image.mobile && image.mobile.height, undefined),
        },
        {
          src: image.src,
          propType: "size",
          lockRatioTo: img,
          onResizeEnd: () => {
            clearPositionOverride(`${sizeKeyPrefix}.captionPos.${origIndex}`);
            captionMove.reset();
          },
        }
      )
    );
    makeZoomable(frame, img, image.linkTo, `${sizeKeyPrefix}.zoom.${origIndex}`, image.zoomBox);
    const isSingle = images.length === 1;
    makeMovableFree(frame, `${sizeKeyPrefix}.${isSingle ? 'singleImagePos' : 'imagePos'}.${origIndex}`, isSingle ? "Trascina per spostare la foto" : "Trascina per ricentrare la foto", {
      src: image.src,
      propType: "offset",
      onMove: () => { if (i === current) updateViewportHeight(); },
      defaultOffset: pickLayout(
        image.offset || ((isSingle && LAYOUT.gallery.singleImageOffset) ? LAYOUT.gallery.singleImageOffset : LAYOUT.gallery.imageOffset),
        image.mobile && image.mobile.offset,
        LAYOUT.galleryMobile.imageOffset
      ),
      dragOnNode: true,
      dragLockAxis: isSingle ? null : "x"
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
      else markImageRemoved(sizeKeyPrefix, imageRemovalId(image, origIndex));
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
    
    const linkBtn = el(
      "button",
      {
        type: "button",
        class: "photo-link-btn",
        title: "Imposta pagina collegata (es: project/beach)",
        "aria-label": "Imposta link",
      },
      "🔗"
    );
    linkBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditMode()) return;
      const currentLink = getLinkOverride(sizeKeyPrefix, image._extra ? `orig:${origIndex}` : imageRemovalId(image, origIndex)) || image.linkTo || "";
      const newLink = prompt("Inserisci il link (es: project/beach). Lascia vuoto per rimuoverlo:", currentLink);
      if (newLink !== null) {
        setLinkOverride(sizeKeyPrefix, image._extra ? `orig:${origIndex}` : imageRemovalId(image, origIndex), newLink.trim() || undefined);
        renderRoute();
      }
    });

    frame.appendChild(deleteBtn);
    frame.appendChild(linkBtn);
    frame.appendChild(addBtn);
    frame.appendChild(figcaption);

    const figureAttrs = { class: "photo", "data-index": i };
    if (image.align === "left") {
      figureAttrs.style = "text-align: left;";
    }
    return el("figure", figureAttrs, [frame]);
  });

  const track = el("div", { class: "photo-track" }, figures);
  const viewport = el("div", { class: "photo-viewport" }, [track]);

  const prevBtn = el("button", { class: "nav-arrow prev", "aria-label": "Precedente" }, "←");
  const nextBtn = el("button", { class: "nav-arrow next", "aria-label": "Successivo" }, "→");
  const indexBtn = el("button", { class: "nav-arrow grid-btn", "aria-label": "Mostra tutte le foto", title: "Index" });
  indexBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" style="display:block; margin: 0 auto;"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>';
  indexBtn.addEventListener("click", () => openGalleryIndex(images, track, viewport, galleryKey));
  
  bottomIndexEl = el("span", { class: "topbar-index" }, resolvedIndexText);
  // Un tentativo di allinearlo automaticamente alla stessa colonna del
  // numero in alto si è rivelato fragile (se il numero in alto è stato a
  // sua volta trascinato in precedenza, l'allineamento "automatico" non
  // corrisponde più a quello che vedi davvero): meglio una maniglia verde
  // come le altre, così lo allinei tu guardando lo schermo.
  makeMovableFree(bottomIndexEl, `${sizeKeyPrefix}.bottomIndexPos`, "Trascina per spostare/allineare il numero", {
    defaultOffset: pickLayout(LAYOUT.gallery.bottomIndexOffset, undefined, LAYOUT.galleryMobile.bottomIndexOffset),
  });
  
  const centerGroup = el("div", { class: "gallerybar-center" }, [bottomIndexEl, indexBtn]);
  const footerBar = el("div", { class: "gallerybar" }, [prevBtn, centerGroup, nextBtn]);

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
    parseFloat(pickLayout(LAYOUT.gallery.spacerBeforeBarHeight, undefined, LAYOUT.galleryMobile.spacerBeforeBarHeight)) || 0
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

  let marqueeDistance = 0;
  let marqueePos = 0;
  let marqueeLastTs = null;
  let marqueeDragState = null;
  let marqueeRafId = null;
  let marqueeHoverPaused = false;
  let marqueeJustDragged = false;

  const measureMarqueeDistance = () => {
    const textHeight = descContent.offsetHeight;
    let gapHeight = 80; // Spazio minimo tra fine e inizio loop
    if (hasExplicitDescHeight) {
      const boxHeight = descBlock.getBoundingClientRect().height;
      if (textHeight < boxHeight) {
        gapHeight = boxHeight - textHeight;
      }
    } else {
      descBlock.style.height = `${textHeight}px`;
    }
    marqueeGap.style.height = `${gapHeight}px`;

    // Calcoliamo la distanza sul wrapper della seconda copia
    marqueeDistance = secondCopyWrapper.offsetTop;
    marqueePos = marqueeDistance ? marqueePos % marqueeDistance : 0;
  };
  const applyMarqueeTransform = () => {
    if (isEditMode()) {
      descTrack.style.transform = "none";
      return;
    }
    descTrack.style.transform = `translate3d(0, ${marqueePos - marqueeDistance}px, 0)`;
  };
  const marqueeTick = (ts) => {
    if (marqueeLastTs == null) marqueeLastTs = ts;
    let dt = (ts - marqueeLastTs) / 1000;
    if (dt > 0.1) dt = 0.1;
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

  descBlock.addEventListener("mouseenter", () => { marqueeHoverPaused = true; });
  descBlock.addEventListener("mouseleave", () => { marqueeHoverPaused = false; });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measureMarqueeDistance();
      applyMarqueeTransform();
    });
  }

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
    if (Math.abs(dy) > 5) marqueeDragState.moved = true;
    let next = (marqueeDragState.startPos + dy) % marqueeDistance;
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

  if (activeDescription && activeDescription.length) {
    descBlock.addEventListener("click", () => {
      if (isEditMode()) return;
      if (marqueeJustDragged) { marqueeJustDragged = false; return; }
      const currentLines = descContent.innerText.split(/\n/).map(s => s.trim()).filter(s => s !== "");
        openTextLightbox(
          currentLines, 
          sizeKeyPrefix, 
          descBlock, 
          title.toLowerCase(),
          pickLayout(
            "593px",
            descriptionBox && descriptionBox.mobile && descriptionBox.mobile.width,
            LAYOUT.galleryMobile.descriptionWidth
          )
        );
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
  let isAnimating = false;

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
    if (isAnimating) return;
    if (!figures.length) return;
    
    lastTransitionStart = performance.now();
    isAnimating = true;
    setTimeout(() => { isAnimating = false; }, 500); // 500ms di debounce per evitare doppi clic veloci, ma senza bloccare i 6s di transizione
    
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
    if (paused || figures.length < 2 || document.hidden || isEditMode()) return;
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

  const onEditModeToggled = () => {
    if (isEditMode()) clearTimeout(autoplayTimer);
    else if (!paused) scheduleNext();
  };
  window.addEventListener("edit-mode-toggled", onEditModeToggled);

  // Blocca l'autoplay quando il tab del browser non è visibile, 
  // per evitare che continui ad avanzare in background.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearTimeout(autoplayTimer);
    } else {
      if (!paused) scheduleNext();
    }
  });

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

  const onKeyDown = (e) => {
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName) || e.target.isContentEditable) return;
    if (e.key === "ArrowLeft") {
      if (figures.length > 1) {
        goTo(current - 1, { user: true });
      } else if (projectNav) {
        location.hash = `#/project/${projectNav.prevSlug}`;
      }
    } else if (e.key === "ArrowRight") {
      if (figures.length > 1) {
        goTo(current + 1, { user: true });
      } else if (projectNav) {
        location.hash = `#/project/${projectNav.nextSlug}`;
      }
    }
  };
  document.addEventListener("keydown", onKeyDown);

  // Passare da una foto all'altra della galleria senza aspettare
  // l'autoplay (a differenza di prevBtn/nextBtn, che su un progetto
  // navigano invece tra progetti): niente bottoni invisibili con un'area
  // cliccabile minuscola — TUTTA la fascia beige ai lati della foto,
  // dentro .photo-viewport, è attiva. Un clic sulla foto stessa (dentro
  // il riquadro) resta gestito da makeZoomable (ingrandimento), quindi
  // qui basta controllare se il clic è fuori dal riquadro della foto
  // corrente, a sinistra o a destra. Attivo ANCHE in modalità modifica
  // (a differenza dello zoom): le maniglie/pulsanti di editing stanno
  // tutti dentro il riquadro della foto, mai nei margini laterali, quindi
  // scorrere le foto per poterle modificare una dopo l'altra non entra
  // mai in conflitto con loro.
  viewport.addEventListener("click", (e) => {
    if (figures.length < 2) return;
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
  function isUntouched(i) {
    const key = `${sizeKeyPrefix}.image.${images[i]._index}`;
    const saved = loadSizeOverrides()[key];
    const mobileOverride = images[i].mobile && (images[i].mobile.width || images[i].mobile.height);
    const contentDefault = pickLayout(images[i].width || images[i].height, mobileOverride, undefined);
    return !((saved && (saved.width || saved.height)) || contentDefault);
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
      frame.style.maxHeight = `${targetHeight}px`;
      
      // Assicuriamoci che l'immagine interna non sfori l'altezza massima 
      // e scali proporzionalmente
      const img = frame.querySelector("img");
      if (img) img.style.maxHeight = `${targetHeight}px`;
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
    window.removeEventListener("edit-mode-toggled", onEditModeToggled);
    document.removeEventListener("keydown", onKeyDown);
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
    .filter((img) => !removed.includes(imageRemovalId(img, img._index)))
    .map((img) => {
      const uploadedSrc = uploaded[img._index];
      const linkOverride = getLinkOverride(galleryKey, imageRemovalId(img, img._index));
      return {
        ...img,
        _src: uploadedSrc || img._src || img.src,
        _isPlaceholder: !uploadedSrc && !img.src,
        linkTo: linkOverride !== undefined ? linkOverride : img.linkTo
      };
    });
  extraImagesFor(galleryKey).forEach((extra) => {
    if (removed.includes(`orig:${extra.id}`)) return;
    const uploadedSrc = uploaded[extra.id];
    const linkOverride = getLinkOverride(galleryKey, `orig:${extra.id}`);
    kept.push({
      caption: "",
      src: null,
      _index: extra.id,
      _extra: true,
      _isPlaceholder: !uploadedSrc,
      _src: uploadedSrc || placeholderImg(`${seed}-${extra.id}`, "nuova foto"),
      linkTo: linkOverride !== undefined ? linkOverride : null
    });
  });
  return kept;
}

function checkImageExists(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${url}?v=${IMAGE_VERSION}`;
  });
}

async function autoDetectImages(projectObj, folderSlug) {
  if (projectObj._isDetecting) return;
  projectObj._isDetecting = true;
  
  let nextIdx = projectObj.images.length;
  let foundNew = false;
  
  while (true) {
    const testUrl = `images/${folderSlug}/${folderSlug}-${nextIdx + 1}.jpg`;
    const exists = await checkImageExists(testUrl);
    if (exists) {
      projectObj.images.push({ caption: "" });
      foundNew = true;
      nextIdx++;
    } else {
      break;
    }
  }
  
  projectObj._isDetecting = false;
  if (foundNew) {
    // Rendi effettiva la nuova lunghezza delle immagini riaggiornando la vista corrente
    if (location.hash === `#/${folderSlug}` || (folderSlug === "archive" && location.hash === `#/archive`)) {
      renderRoute();
    }
  }
}

async function renderProject(slug) {
  const project = findProject(slug);
  if (!project) {
    renderNotFound();
    return;
  }
  
  let descText = "";
  try {
    const res = await fetch(`/testi/${project.slug}.txt?t=${Date.now()}`);
    if (res.ok) {
      descText = await res.text();
      // Rimuovi eventuali spazi bianchi superflui all'inizio/fine
      descText = descText.trim();
    }
  } catch (e) {
    console.warn("Nessun file di testo trovato per", project.slug);
  }
  
  // Avvia il check in background per nuove immagini caricate nella cartella
  autoDetectImages(project, project.slug);

  const galleryKey = `project.${project.slug}`;
  const orderKey = `${galleryKey}.imageOrder`;
  const order = currentImageOrder(orderKey, project.images.length);
  const baseImages = order.map((origIndex) => {
    const img = project.images[origIndex];
    if (!img) return null; // Fallback se c'erano id invalidi (es. extra images) salvati per sbaglio
    return { ...img, _index: origIndex, _src: resolveImageSrc(project.slug, origIndex, img) };
  }).filter(Boolean);
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
    description: descText ? descText.split('\n') : [],
    descriptionBox: project.descriptionBox,
    images,
    projectNav: { slug: project.slug, prevSlug, nextSlug },
    galleryKey,
  });
}

function renderArchive(param) {
  renderArchivePagesMode(param);
}

function renderOldArchive() {
  const images = applyImageOverrides("archive", "archive", ARCHIVE.images);
  
  // Aggiunge temporaneamente la classe per la larghezza extra
  const app = document.getElementById("app");
  app.classList.add("is-archive");
  
  renderGallery({
    indexNumber: 0,
    title: ARCHIVE.title + " (Vecchio)",
    description: [],
    images,
    projectNav: null,
    galleryKey: "archive",
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
function renderSimplePage({ title, paragraphs, extraLines = [], disableMarquee = false }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  ensureEditModeUI();

  const resizeObservers = [];
  const sizeKeyPrefix = `simple.${title.toLowerCase()}`;
  const { topbar } = buildTopbar(sizeKeyPrefix, "", title.toLowerCase(), { hideIndex: true });

  const allText = [...paragraphs];
  if (extraLines.length) {
    allText.push("");
    extraLines.forEach((line) => allText.push(`${line.label} — ${line.value}`));
  }

  const defaultDescHeight = LAYOUT.gallery.descriptionHeight;
  const hasExplicitDescHeight = Boolean(defaultDescHeight || loadSizeOverrides()[`${sizeKeyPrefix}.description`]?.height);
  const makeParagraphs = () => allText.map((paragraph) => el("p", paragraph === "" ? { class: "spacer" } : { html: paragraph }));
  
  const descContent = el("div", { class: "description-content" }, makeParagraphs());
  const secondCopyWrapper = el("div", { class: "description-clone", "aria-hidden": "true" });
  const marqueeGap = el("div", { class: "marquee-gap" });
  marqueeGap.style.display = "none";
  
  if (!disableMarquee) {
    makeParagraphs().forEach((p) => secondCopyWrapper.appendChild(p));
    marqueeGap.style.display = "block";
    marqueeGap.style.height = "100vh";
  }
  
  const descTrack = el("div", { class: "description-track" }, [descContent, marqueeGap, secondCopyWrapper]);
  const descBlock = el("div", { class: "description simple-page" }, [descTrack]);

  // Set explicit height before observing/measuring, exactly like renderGallery
  if (hasExplicitDescHeight) {
    const explicitHeight = pickLayout(
      defaultDescHeight,
      undefined, // descriptionBox doesn't exist here
      LAYOUT.galleryMobile.descriptionHeight
    ) || defaultDescHeight;
    
    if (explicitHeight) descBlock.style.height = explicitHeight;
  }

  resizeObservers.push(
    makeResizable(descBlock, `${sizeKeyPrefix}.description`, {
      width: LAYOUT.gallery.descriptionWidth,
      height: hasExplicitDescHeight ? defaultDescHeight : "auto",
    })
  );
  makeMovableFree(descBlock, `${sizeKeyPrefix}.descriptionPos`, "Trascina per spostare il testo", {
    defaultOffset: LAYOUT.gallery.descriptionOffset,
  });

  app.appendChild(topbar);
  app.appendChild(descBlock);

  if (!disableMarquee) {
    let marqueeDistance = 0;
    let marqueePos = 0;
    let marqueeLastTs = null;
    let marqueeDragState = null;
    let marqueeRafId = null;
    let marqueeHoverPaused = false;
    let marqueeJustDragged = false;

    const measureMarqueeDistance = () => {
      const textHeight = descContent.offsetHeight;
      let gapHeight = 80;
      if (hasExplicitDescHeight) {
        const boxHeight = descBlock.getBoundingClientRect().height;
        if (textHeight < boxHeight) gapHeight = boxHeight - textHeight;
      } else {
        descBlock.style.height = `${textHeight}px`;
      }
      marqueeGap.style.height = `${gapHeight}px`;

      marqueeDistance = secondCopyWrapper.offsetTop;
      marqueePos = marqueeDistance ? marqueePos % marqueeDistance : 0;
    };
    const applyMarqueeTransform = () => {
      descTrack.style.transform = `translate3d(0, ${marqueePos - marqueeDistance}px, 0)`;
    };
    const marqueeTick = (ts) => {
      if (marqueeLastTs == null) marqueeLastTs = ts;
      let dt = (ts - marqueeLastTs) / 1000;
      if (dt > 0.1) dt = 0.1;
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

    descBlock.addEventListener("mouseenter", () => { marqueeHoverPaused = true; });
    descBlock.addEventListener("mouseleave", () => { marqueeHoverPaused = false; });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measureMarqueeDistance();
        applyMarqueeTransform();
      });
    }

    descTrack.classList.add("draggable");
    descTrack.addEventListener("pointerdown", (e) => {
      if (isEditMode()) return;
      e.preventDefault();
      marqueeDragState = { pointerId: e.pointerId, startY: e.clientY, startPos: marqueePos, moved: false };
      descTrack.classList.add("is-dragging");
      document.addEventListener("pointermove", onMarqueeDragMove);
      document.addEventListener("pointerup", onMarqueeDragEnd);
    });
    
    // Assegnamo al volo le variabili così possono essere rimosse nel teardown
    var onMarqueeDragMoveHandler = function(e) {
      if (!marqueeDragState || e.pointerId !== marqueeDragState.pointerId) return;
      const dy = e.clientY - marqueeDragState.startY;
      if (Math.abs(dy) > 5) marqueeDragState.moved = true;
      let next = (marqueeDragState.startPos - dy) % marqueeDistance;
      if (next < 0) next += marqueeDistance;
      marqueePos = next;
      applyMarqueeTransform();
    };
    
    var onMarqueeDragEndHandler = function(e) {
      if (!marqueeDragState || e.pointerId !== marqueeDragState.pointerId) return;
      if (marqueeDragState.moved) marqueeJustDragged = true;
      marqueeDragState = null;
      descTrack.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onMarqueeDragMoveHandler);
      document.removeEventListener("pointerup", onMarqueeDragEndHandler);
    };

    document.addEventListener("pointermove", onMarqueeDragMoveHandler);
    document.addEventListener("pointerup", onMarqueeDragEndHandler);

    if (allText && allText.length) {
      descBlock.addEventListener("click", () => {
        if (isEditMode()) return;
        if (marqueeJustDragged) { marqueeJustDragged = false; return; }
        openTextLightbox(
          allText, 
          sizeKeyPrefix, 
          descBlock, 
          title.toLowerCase(),
          pickLayout(
            "593px",
            undefined,
            LAYOUT.galleryMobile.descriptionWidth
          )
        );
      });
    }

    currentTeardown = () => {
      cancelAnimationFrame(marqueeRafId);
      document.removeEventListener("pointermove", onMarqueeDragMoveHandler);
      document.removeEventListener("pointerup", onMarqueeDragEndHandler);
      resizeObservers.forEach((o) => o.disconnect());
    };
  } else {
    // Se disabilitato, non c'è drag né loop, solo ridimensionamento
    currentTeardown = () => {
      resizeObservers.forEach((o) => o.disconnect());
    };
  }
}

function renderContacts() {
  renderSimplePage({ title: CONTACTS.title, paragraphs: CONTACTS.paragraphs, extraLines: CONTACTS.lines, disableMarquee: true });
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

async function renderRoute() {
  teardownCurrentView();
  app.classList.remove("is-archive");
  try {
    const { route, param } = parseHash();

    switch (route) {
      case "project":
        await renderProject(param);
        break;
      case "archive":
        renderArchive(param);
        break;
      case "old-archive":
        renderOldArchive();
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

function openGalleryIndex(images, track, viewport, galleryKey) {
  const originalBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const overlay = el("div", { class: "gallery-index-overlay" });
  const closeBtn = el("button", { class: "gallery-index-close", "aria-label": "Salva e Chiudi" }, "Salva");
  
  const grid = el("div", { class: "gallery-index-grid" });
  
  let isZoomedOut = false;
  const zoomBtn = el("button", { class: "gallery-index-zoom", "aria-label": "Zoom out" }, "- Zoom out");
  zoomBtn.addEventListener("click", () => {
    isZoomedOut = !isZoomedOut;
    if (isZoomedOut) {
      grid.classList.add("zoomed-out");
      zoomBtn.textContent = "+ Zoom in";
    } else {
      grid.classList.remove("zoomed-out");
      zoomBtn.textContent = "- Zoom out";
    }
  });
  
  let dragSrcEl = null;
  let isDragging = false;
  
  images.forEach((imgObj, i) => {
    const src = imgObj._src || imgObj.src;
    if (!src) return; 
    
    // Non mostriamo nella griglia di modifica le foto già rimosse, a meno che non vogliamo farle recuperare.
    // Ma per semplicità nascondiamo se è già rimossa. In realtà le riceve già filtrate, quindi va bene.
    
    const imgEl = el("img", { src: src, loading: "lazy", alt: imgObj.caption || "" });
    
    const removeBtn = el("button", { class: "grid-item-remove", "aria-label": "Rimuovi foto" }, "×");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Evita il click sull'item
      if (!confirm("Rimuovere questa foto dalla galleria?")) return;
      markImageRemoved(galleryKey, imageRemovalId(imgObj, imgObj._index));
      item.style.display = "none";
    });
    
    const item = el("div", { class: "gallery-index-item", "data-index": imgObj._index }, [imgEl, removeBtn]);
    
    item.addEventListener("click", () => {
      if (isDragging) return;
      const currentVisualIndex = Array.from(grid.children).filter(el => el.style.display !== "none").indexOf(item);
      const currentViewport = document.querySelector('.photo-viewport');
      const currentTrack = document.querySelector('.photo-track');
      if (currentTrack && currentViewport && currentVisualIndex !== -1) {
        const targetFig = currentTrack.children[currentVisualIndex];
        if (targetFig) {
          const scrollDest = targetFig.offsetLeft - (currentViewport.clientWidth - targetFig.offsetWidth) / 2;
          currentViewport.scrollTo({ left: Math.max(0, scrollDest), behavior: "auto" });
        }
      }
      closeIndex();
    });
    
    // Drag & Drop
    item.draggable = true;
    item.addEventListener("dragstart", function(e) {
      isDragging = true;
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => this.classList.add("is-dragging-item"), 0);
    });
    item.addEventListener("dragover", function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      return false;
    });
    item.addEventListener("dragenter", function(e) {
      if (this !== dragSrcEl) this.classList.add("over");
    });
    item.addEventListener("dragleave", function(e) {
      this.classList.remove("over");
    });
    item.addEventListener("drop", function(e) {
      e.stopPropagation();
      if (dragSrcEl !== this) {
        const siblings = Array.from(grid.children);
        const fromIndex = siblings.indexOf(dragSrcEl);
        const toIndex = siblings.indexOf(this);
        
        if (fromIndex < toIndex) {
          this.parentNode.insertBefore(dragSrcEl, this.nextSibling);
        } else {
          this.parentNode.insertBefore(dragSrcEl, this);
        }
      }
      return false;
    });
    item.addEventListener("dragend", function(e) {
      this.classList.remove("is-dragging-item");
      Array.from(grid.children).forEach(child => child.classList.remove("over"));
      setTimeout(() => isDragging = false, 50);
    });
    
    grid.appendChild(item);
  });

  overlay.appendChild(zoomBtn);
  overlay.appendChild(closeBtn);
  overlay.appendChild(grid);
  document.body.appendChild(overlay);

  overlay.offsetHeight;
  overlay.classList.add("is-active");

  function closeIndex() {
    overlay.classList.remove("is-active");
    document.body.style.overflow = originalBodyOverflow;
    
    // Salva il nuovo ordine prima di chiudere
    const newOrder = Array.from(grid.children)
      .filter(child => child.style.display !== "none")
      .map(child => {
        const idxStr = child.getAttribute("data-index");
        return isNaN(Number(idxStr)) ? idxStr : Number(idxStr);
      });
    
    const orderKey = `${galleryKey}.imageOrder`;
    saveOrderOverride(orderKey, newOrder);
    
    // Rendi effettive le modifiche chiudendo
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      renderRoute();
    }, 300);
  }
  
  closeBtn.addEventListener("click", closeIndex);
}

function openAllPhotosIndex() {
  const originalBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const overlay = el("div", { class: "gallery-index-overlay" });
  const closeBtn = el("button", { class: "gallery-index-close", "aria-label": "Chiudi" }, "Chiudi");
  
  const grid = el("div", { class: "gallery-index-grid" });
  
  let isZoomedOut = false;
  const zoomBtn = el("button", { class: "gallery-index-zoom", "aria-label": "Zoom out" }, "- Zoom out");
  zoomBtn.addEventListener("click", () => {
    isZoomedOut = !isZoomedOut;
    if (isZoomedOut) {
      grid.classList.add("zoomed-out");
      zoomBtn.textContent = "+ Zoom in";
    } else {
      grid.classList.remove("zoomed-out");
      zoomBtn.textContent = "- Zoom out";
    }
  });
  
  const allImages = [];
  
  // Raccogliamo tutte le foto da tutti i progetti
  const orderedProjects = getOrderedProjects();
  orderedProjects.forEach(project => {
    const galleryKey = `project.${project.slug}`;
    const orderKey = `${galleryKey}.imageOrder`;
    const order = currentImageOrder(orderKey, project.images.length);
    const baseImages = order.map((origIndex) => {
      const img = project.images[origIndex];
      if (!img) return null;
      return { ...img, _index: origIndex, _src: resolveImageSrc(project.slug, origIndex, img), _project: project };
    }).filter(Boolean);
    const images = applyImageOverrides(galleryKey, project.slug, baseImages);
    allImages.push(...images);
  });

  allImages.forEach((imgObj) => {
    const src = imgObj._src || imgObj.src;
    if (!src) return; 
    
    const imgEl = el("img", { src: src, loading: "lazy", alt: imgObj.caption || "" });
    const label = el("div", { style: "position:absolute; bottom:6px; left:6px; background:rgba(0,0,0,0.65); color:#fff; font-size:11px; padding:3px 6px; border-radius:4px; font-family:inherit; pointer-events:none;" }, imgObj._project.name);
    
    const item = el("div", { class: "gallery-index-item", style: "position:relative;" }, [imgEl, label]);
    
    item.addEventListener("click", () => {
      location.hash = `#/project/${imgObj._project.slug}`;
      closeIndex();
    });
    
    grid.appendChild(item);
  });

  overlay.appendChild(zoomBtn);
  overlay.appendChild(closeBtn);
  overlay.appendChild(grid);
  document.body.appendChild(overlay);

  overlay.offsetHeight;
  overlay.classList.add("is-active");

  function closeIndex() {
    overlay.classList.remove("is-active");
    document.body.style.overflow = originalBodyOverflow;
    
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
  
  closeBtn.addEventListener("click", closeIndex);
}

const ARCHIVE_PAGES_STORE_KEY = "site-archive-pages-v2";

function loadArchivePages() {
  try {
    const ls = JSON.parse(localStorage.getItem(ARCHIVE_PAGES_STORE_KEY));
    if (ls && ls.length > 0) {
      return ls;
    }
  } catch (e) {}
  
  if (ARCHIVE.pages && ARCHIVE.pages.length > 0) {
    return JSON.parse(JSON.stringify(ARCHIVE.pages));
  }

  if (ARCHIVE.images && ARCHIVE.images.length > 0) {
    return [{
      id: "page_1",
      images: ARCHIVE.images.map((img, i) => ({
        type: "image",
        poolIndex: i,
        uid: `img_${i}`
      }))
    }];
  }
  
  return null;
}

function saveArchivePages(pages) {
  localStorage.setItem(ARCHIVE_PAGES_STORE_KEY, JSON.stringify(pages));
  
  // Auto-save to content.js
  fetch('http://localhost:8000/api/save-archive-pages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages })
  }).catch(e => console.error("Auto-save archive pages failed", e));
}

function renderArchivePagesMode(param) {
  const pages = loadArchivePages() || [];
  if (pages.length === 0) {
    // If no pages, auto-initialize with an empty page 1
    pages.push({ id: "page_1", images: [] });
    saveArchivePages(pages);
  }
  
  const pageIndex = 0;
  
  const page = pages[pageIndex];
  const galleryKey = `archive.page.${page.id}`;
  const resizeObservers = [];
  
  ensureEditModeUI();
  
  // Create UI
  const app = document.getElementById("app");
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  app.classList.add("is-archive");
  
  const figure = el("figure", { class: "photo", style: "position: relative; width: 100%; height: 100vh; display: block;" });
  
  const mappedArchiveImages = ARCHIVE.images.map((img, i) => ({ ...img, _index: i }));
  const poolImages = applyImageOverrides("archive", "archive", mappedArchiveImages);
  
  // Render images/words on this page
  page.images.forEach((item) => {
    if (item.type === "word") {
      const wordEl = el("div", { class: "archive-word", style: "font-family: ui-monospace, SFMono-Regular, 'Courier New', monospace; font-weight: normal; line-height: 1; position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; outline: none; white-space: nowrap;" }, item.text);
      
      if (isEditMode()) {
        wordEl.contentEditable = "true";
        wordEl.addEventListener("blur", () => {
           item.text = wordEl.innerText.trim() || "Parola";
           wordEl.innerText = item.text;
           saveArchivePages(pages);
        });
        wordEl.addEventListener("pointerdown", (e) => e.stopPropagation());
      }
      
      const frame = el("div", { class: "photo-frame is-word", style: "pointer-events: auto; position: relative;" }, [wordEl]);
      const frameWrapper = el("div", { class: "photo-wrapper", style: "position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;" }, [frame]);
      
      const updateFontSize = () => {
         if (frame.style.width === "auto" || frame.style.width === "") {
            wordEl.style.fontSize = "16px";
            return;
         }
         const rect = frame.getBoundingClientRect();
         if (rect.width === 0) return;
         const textLen = Math.max(1, wordEl.innerText.trim().length);
         wordEl.style.fontSize = `${rect.width / (textLen * 0.6)}px`;
      };
      
      if (isEditMode()) {
        wordEl.addEventListener("input", updateFontSize);
      }
      
      const sizeKeyPrefix = galleryKey;
      
      const ro = new ResizeObserver(() => {
         updateFontSize();
      });
      ro.observe(frame);
      resizeObservers.push(ro);

      resizeObservers.push(
        makeResizable(
          frame,
          `${sizeKeyPrefix}.size.${item.uid}`,
          { width: "auto", height: "auto" }
        )
      );
      
      makeMovableFree(frame, `${sizeKeyPrefix}.pos.${item.uid}`, "Trascina per spostare la parola", {
        defaultOffset: { x: 0, y: 0 }
      });
      
      const linkBtn = el("button", { type: "button", class: "photo-link-btn", title: "Collega a un'immagine dell'archivio" }, "🔗");
      linkBtn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!isEditMode()) return;
        showArchivePoolModal(page, pages, "link", (selectedImg) => {
          item.linkedImageSrc = selectedImg.src;
          item.linkedImageLinkTo = selectedImg.linkTo;
          saveArchivePages(pages);
          renderRoute();
        });
      });
      
      const deleteBtn = el("button", { type: "button", class: "photo-delete-btn", title: "Rimuovi parola" }, "×");
      deleteBtn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!isEditMode()) return;
        if (!confirm("Rimuovere questa parola?")) return;
        page.images = page.images.filter(i => i.uid !== item.uid);
        saveArchivePages(pages);
        frameWrapper.remove();
      });
      
      frame.appendChild(deleteBtn);
      frame.appendChild(linkBtn);
      figure.appendChild(frameWrapper);
      
      if (item.linkedImageSrc != null || item.linkedImageIndex != null) {
          let poolImg, src;
          if (item.linkedImageSrc) {
              src = item.linkedImageSrc;
              poolImg = { linkTo: item.linkedImageLinkTo };
          } else {
              poolImg = poolImages[item.linkedImageIndex];
              if (poolImg) src = resolveImageSrc("archive", item.linkedImageIndex, poolImg);
          }
          if (src) {
              const hiddenImg = el("img", { class: "hidden-link-img", src: src, style: "position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: -1;" });
              frame.appendChild(hiddenImg);
              makeZoomable(frame, hiddenImg, poolImg.linkTo, `${galleryKey}.zoom.${item.uid}`, poolImg.zoomBox);
              frame.style.cursor = "pointer";
          }
      }
      return;
    }

    // item: { poolIndex, poolSrc, linkTo, uid }
    let poolImg, src;
    if (item.poolSrc) {
        src = item.poolSrc;
        poolImg = { caption: "", linkTo: item.linkTo, width: "300px", height: "auto" };
    } else {
        poolImg = poolImages[item.poolIndex];
        if (!poolImg) return;
        src = resolveImageSrc("archive", item.poolIndex, poolImg);
    }
    let inlineStyle = "";
    const imgAttrs = { src: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", class: "photo-img", draggable: false };
    if (poolImg.zoomBox && poolImg.zoomBox.width && poolImg.zoomBox.height) {
      const w = parseFloat(poolImg.zoomBox.width);
      const h = parseFloat(poolImg.zoomBox.height);
      if (!isNaN(w) && !isNaN(h) && h > 0) {
        inlineStyle = `aspect-ratio: ${w} / ${h};`;
        imgAttrs.width = w;
        imgAttrs.height = h;
      }
    }
    if (inlineStyle) imgAttrs.style = inlineStyle + " transition: opacity 0.3s; opacity: 0;";
    else imgAttrs.style = "transition: opacity 0.3s; opacity: 0;";
    const imgEl = el("img", imgAttrs);
    
    const preloader = new Image();
    preloader.onload = () => {
      imgEl.src = preloader.src;
      imgEl.style.opacity = "1";
      const p = imgEl.closest(".photo");
      if (p) p.offsetHeight;
    };
    preloader.src = src;
    
    const frame = el("div", { class: "photo-frame", style: "pointer-events: auto;" }, [imgEl]);
    const frameWrapper = el("div", { class: "photo-wrapper", style: "position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none;" }, [frame]);
    
    // Zoom / Link
    const linkOverride = getLinkOverride(galleryKey, item.uid);
    const linkTo = linkOverride !== undefined ? linkOverride : poolImg.linkTo;
    makeZoomable(frame, imgEl, linkTo, `${galleryKey}.zoom.${item.uid}`, poolImg.zoomBox);
    
    // Size override (must be on frame, not imgEl, because img cannot have child handles)
    const sizeKeyPrefix = galleryKey;
    resizeObservers.push(
      makeResizable(
        frame,
        `${sizeKeyPrefix}.size.${item.uid}`,
        { width: poolImg.width || "300px", height: poolImg.height || "auto" },
        { lockRatioTo: imgEl }
      )
    );
    
    // Scatter default offsets so they don't perfectly overlap if they have no saved position
    const scatterX = (Math.random() - 0.5) * 400; // -200 to 200
    const scatterY = (Math.random() - 0.5) * 300; // -150 to 150

    // Move
    makeMovableFree(frame, `${sizeKeyPrefix}.pos.${item.uid}`, "Trascina per spostare la foto", {
      defaultOffset: { x: scatterX, y: scatterY }, // Random scatter
      dragOnNode: true
    });
    
    // Edit mode buttons
    const deleteBtn = el("button", { type: "button", class: "photo-delete-btn", title: "Rimuovi dalla pagina" }, "×");
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!isEditMode()) return;
      if (!confirm("Rimuovere questa foto dalla pagina?")) return;
      page.images = page.images.filter(i => i.uid !== item.uid);
      saveArchivePages(pages);
      frameWrapper.remove();
    });
    
    const linkBtn = el("button", { type: "button", class: "photo-link-btn", title: "Imposta link" }, "🔗");
    linkBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!isEditMode()) return;
      const newLink = prompt("Inserisci il link (es: project/beach):", linkTo || "");
      if (newLink !== null) {
        setLinkOverride(galleryKey, item.uid, newLink.trim() || undefined);
        renderRoute();
      }
    });
    
    frame.appendChild(deleteBtn);
    frame.appendChild(linkBtn);
    
    // Caption if any
    const finalCaption = loadCaptionOverrides()[`${galleryKey}.captionText.${item.uid}`] ?? poolImg.caption;
    if (finalCaption || isEditMode()) {
      const figcaption = el("figcaption", { class: "photo-caption" });
      const captionP = el("p", { class: "photo-caption-text" }, finalCaption);
      
      if (isEditMode()) {
        captionP.contentEditable = "true";
        captionP.addEventListener("blur", () => {
          const txt = captionP.innerText.trim();
          const allCaps = loadCaptionOverrides();
          if (txt === (poolImg.caption || "")) delete allCaps[`${galleryKey}.captionText.${item.uid}`];
          else allCaps[`${galleryKey}.captionText.${item.uid}`] = txt;
          localStorage.setItem(CAPTION_STORE_KEY, JSON.stringify(allCaps));
        });
      }
      figcaption.appendChild(captionP);
      frame.appendChild(figcaption);
    }
    
    figure.appendChild(frameWrapper);
  });
  
  const pageControls = el("div", { class: "archive-page-controls", style: "position: fixed; bottom: 20px; left: 20px; z-index: 1000; display: " + (isEditMode() ? "flex" : "none") + "; gap: 8px; flex-direction: column;" });
  
  const addPhotoBtn = el("button", { style: "padding: 8px; background: #2b7a4b; color: #f4f0e6; border-radius: 4px; border: none; cursor: pointer; font-family: monospace;" }, "+ Foto da Archivio");
  addPhotoBtn.addEventListener("click", () => showArchivePoolModal(page, pages));

  const addWordBtn = el("button", { style: "padding: 8px; background: #7a5d2b; color: #f4f0e6; border-radius: 4px; border: none; cursor: pointer; font-family: monospace;" }, "+ Parola");
  addWordBtn.addEventListener("click", () => {
    page.images.push({ type: "word", text: "Nuova parola", uid: `uid_${Date.now()}_${Math.floor(Math.random()*10000)}` });
    saveArchivePages(pages);
    renderRoute();
  });
  
  const oldArchiveBtn = el("a", { href: "#/old-archive", target: "_blank", style: "padding: 8px; background: #9c6e26; color: #f4f0e6; border-radius: 4px; border: none; cursor: pointer; font-family: monospace; text-decoration: none; text-align: center;" }, "Guarda Vecchio Archivio");
  
  pageControls.appendChild(addPhotoBtn);
  pageControls.appendChild(addWordBtn);
  pageControls.appendChild(oldArchiveBtn);
  
  const toggleControls = () => {
    renderRoute();
  };
  window.addEventListener("edit-mode-toggled", toggleControls);
  
  const track = el("div", { class: "photo-track" }, [figure]);
  const viewport = el("div", { class: "photo-viewport" }, [track]);
  
  const { topbar } = buildTopbar("archive", "0", ARCHIVE.title);
  
  const bottomIndexEl = el("span", { class: "topbar-index" }, "0");
  makeMovableFree(bottomIndexEl, `archive.bottomIndexPos`, "Trascina per spostare/allineare il numero", {
    defaultOffset: pickLayout(LAYOUT.gallery.bottomIndexOffset, undefined, LAYOUT.galleryMobile.bottomIndexOffset),
  });
  const centerGroup = el("div", { class: "gallerybar-center" }, [bottomIndexEl]);
  const footerBar = el("div", { class: "gallerybar" }, [centerGroup]);
  
  const spacerBottom = el("div", { class: "gallery-spacer" });
  makeHeightResizable(spacerBottom, "archive.spacerBottom", "Trascina per allungare la pagina", parseFloat(LAYOUT.gallery.spacerBottomHeight) || 0);

  app.appendChild(topbar);
  app.appendChild(viewport);
  app.appendChild(pageControls);
  app.appendChild(footerBar);
  app.appendChild(spacerBottom);
  
  const alignmentGuides = setupAlignmentGuides(app, galleryKey);
  
  currentTeardown = () => {
    window.removeEventListener("edit-mode-toggled", toggleControls);
    alignmentGuides.teardown();
    resizeObservers.forEach(o => o.disconnect());
  };
}

function showArchivePoolModal(page, pages, mode = "add", onSelect = null) {
  const overlay = el("div", { class: "export-panel" });
  const inner = el("div", { class: "export-panel-inner", style: "display:flex; flex-direction:column; max-height: 90vh; width: 90vw; max-width: 1200px; overflow: hidden; padding: 0; background: var(--paper);" });
  
  const header = el("div", { style: "display:flex; justify-content:space-between; align-items:center; padding: 16px; background: var(--ink); color: var(--paper);" });
  const title = el("div", { style: "font-weight: bold;" }, mode === "link" ? "Seleziona l'immagine da legare alla parola" : "Seleziona le foto da importare (puoi sceglierne più di una)");
  const closeBtn = el("button", { style: "padding: 8px 16px; background: #2b7a4b; color: white; border: none; cursor: pointer; border-radius: 4px;" }, mode === "link" ? "Annulla" : "Fatto");
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  inner.appendChild(header);
  
  const grid = el("div", { style: "display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; overflow-y: auto; flex: 1; padding: 16px;" });
  
  const selectedIndices = new Set();
  
  const mappedArchiveImages = ARCHIVE.images.map((img, i) => ({ ...img, _index: i }));
  const poolImages = applyImageOverrides("archive", "archive", mappedArchiveImages);
  
  let displayImages = poolImages;
  if (window.DYNAMIC_IMAGES && window.DYNAMIC_IMAGES.length > 0) {
    displayImages = window.DYNAMIC_IMAGES.map((src, i) => {
      const parts = src.split("/");
      let linkTo = undefined;
      let caption = parts[parts.length - 1]; // filename
      if (parts.length > 2) {
        const folder = parts[parts.length - 2];
        const proj = PROJECTS.find(p => p.slug === folder);
        if (proj) linkTo = `project/${proj.slug}`;
        else if (folder === "core archive") linkTo = "archive";
      }
      return { src: src, _index: i, linkTo: linkTo, caption: caption };
    });
  }
  
  displayImages.forEach((img, idx) => {
    // If it's a fallback pool image, resolve its src. If it's from DYNAMIC_IMAGES, it already has src.
    const src = img.src || resolveImageSrc("archive", idx, img);
    const item = el("div", { style: "cursor: pointer; position: relative; border: 4px solid transparent; border-radius: 4px; transition: border 0.2s;" }, [
      el("img", { src: src, style: "width: 100%; height: 150px; object-fit: cover; border-radius: 2px;" }),
      el("div", { style: "position: absolute; bottom: 0; background: rgba(0,0,0,0.5); color: white; width: 100%; text-align: center; font-size: 10px; padding: 4px;" }, img.caption || "Foto")
    ]);
    
    item.addEventListener("click", () => {
      if (mode === "link") {
        if (onSelect) onSelect(img);
        overlay.remove();
        return;
      }
      if (selectedIndices.has(idx)) {
        selectedIndices.delete(idx);
        item.style.borderColor = "transparent";
      } else {
        selectedIndices.add(idx);
        item.style.borderColor = "#2b7a4b";
      }
    });
    
    grid.appendChild(item);
  });
  
  closeBtn.addEventListener("click", () => {
    if (mode === "add" && selectedIndices.size > 0) {
      Array.from(selectedIndices).sort((a,b) => a-b).forEach(idx => {
        const selectedImg = displayImages[idx];
        page.images.push({ 
          poolSrc: selectedImg.src,
          linkTo: selectedImg.linkTo,
          uid: `uid_${Date.now()}_${Math.floor(Math.random()*10000)}` 
        });
      });
      saveArchivePages(pages);
      renderRoute();
    }
    overlay.remove();
  });
  
  inner.appendChild(grid);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}

// Migration: Reset zoom panel positions to force new defaults matching main page
const MIGRATION_ZOOM_RESET_V3 = "zoom_reset_v3";
if (!localStorage.getItem(MIGRATION_ZOOM_RESET_V3)) {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("site-pos-v1-")) {
      if (key.includes(".zoom.descriptionPos") || 
          key.includes(".zoom.topbarTitlePos") || 
          key.includes(".descriptionZoomSize") || 
          key.includes(".descriptionZoomPos")) {
        localStorage.removeItem(key);
      }
    }
  });
  localStorage.setItem(MIGRATION_ZOOM_RESET_V3, "true");
}

