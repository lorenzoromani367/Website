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
const AUTOPLAY_DELAY = 5000;   // ms di pausa su ogni foto prima di avanzare
const TRANSITION_MS = 3000;    // durata dello slide orizzontale tra le foto (già coerente con --transition-ms in style.css)
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
function getOrderedProjects() {
  const order = loadOrderOverrides()["home.order"];
  if (!order) return PROJECTS.slice();
  const bySlug = new Map(PROJECTS.map((p) => [p.slug, p]));
  const ordered = order.map((slug) => bySlug.get(slug)).filter(Boolean);
  PROJECTS.forEach((p) => {
    if (!ordered.includes(p)) ordered.push(p); // progetti nuovi non ancora nell'ordine salvato
  });
  return ordered;
}

// L'ordine delle foto di una galleria (progetto o archivio), come array di
// indici ORIGINALI di content.js — es. [2,0,1] mostra prima la terza foto.
function currentImageOrder(key, length) {
  const stored = loadOrderOverrides()[key];
  if (stored && stored.length === length) return stored.slice();
  return Array.from({ length }, (_, i) => i);
}

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
function makeMovableFree(node, key, title = "Trascina per spostare") {
  if (!node.style.position) node.style.position = "relative";

  const pos = Object.assign({ x: 0, y: 0 }, loadPositionOverrides()[key]);
  if (pos.x || pos.y) node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;

  const handle = el("div", { class: "move-handle free-move", title });
  node.appendChild(handle);

  let dragState = null;

  handle.addEventListener("pointerdown", (e) => {
    if (!isEditMode()) return;
    e.preventDefault();
    e.stopPropagation();
    dragState = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
    handle.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });

  function onPointerMove(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    pos.x = snapToGrid(dragState.baseX + (e.clientX - dragState.startX));
    pos.y = snapToGrid(dragState.baseY + (e.clientY - dragState.startY));
    node.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  }

  function onPointerUp(e) {
    if (!dragState || e.pointerId !== dragState.pointerId) return;
    handle.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    dragState = null;
    savePositionOverride(key, { x: pos.x, y: pos.y });
  }
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
function makeResizable(node, key, defaults = {}, { lockRatioTo } = {}) {
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

function describeOverrideKey(key) {
  if (key === "home.list") return `LAYOUT.home  →  aggiorna listWidth/listHeight in content.js`;

  const descMatch = key.match(/^project\.(.+)\.description$/);
  if (descMatch) return `Progetto "${descMatch[1]}"  →  aggiungi/aggiorna "descriptionBox" su quel progetto in PROJECTS`;

  const imgMatch = key.match(/^project\.(.+)\.image\.(\d+)$/);
  if (imgMatch) return `Progetto "${imgMatch[1]}", foto #${Number(imgMatch[2]) + 1}  →  aggiorna width/height su quella voce di "images"`;

  if (key === "archive.description") return `Core archive  →  aggiorna "descriptionBox" sull'oggetto ARCHIVE`;

  const archiveImgMatch = key.match(/^archive\.image\.(\d+)$/);
  if (archiveImgMatch) return `Core archive, foto #${Number(archiveImgMatch[1]) + 1}  →  aggiorna width/height su quella voce di ARCHIVE.images`;

  return key;
}

function describeOrderKey(key) {
  if (key === "home.order") return `Home  →  riordina l'array PROJECTS in content.js mettendo i progetti in quest'ordine`;

  const imgOrderMatch = key.match(/^project\.(.+)\.imageOrder$/);
  if (imgOrderMatch) return `Progetto "${imgOrderMatch[1]}"  →  riordina l'array "images" mettendo le foto in quest'ordine (0 = prima foto originale, 1 = seconda, ...)`;

  if (key === "archive.imageOrder") return `Core archive  →  riordina l'array ARCHIVE.images mettendo le foto in quest'ordine (0 = prima foto originale, 1 = seconda, ...)`;

  return key;
}

function describePositionKey(key) {
  const captionMatch = key.match(/^project\.(.+)\.caption\.(\d+)$/);
  if (captionMatch) return `Progetto "${captionMatch[1]}", didascalia foto #${Number(captionMatch[2]) + 1}  →  aggiungi "captionOffset: { x, y }" su quella voce di "images"`;

  const archiveCaptionMatch = key.match(/^archive\.caption\.(\d+)$/);
  if (archiveCaptionMatch) return `Core archive, didascalia foto #${Number(archiveCaptionMatch[1]) + 1}  →  aggiungi "captionOffset: { x, y }" su quella voce di ARCHIVE.images`;

  const imagePosMatch = key.match(/^project\.(.+)\.imagePos\.(\d+)$/);
  if (imagePosMatch) return `Progetto "${imagePosMatch[1]}", foto #${Number(imagePosMatch[2]) + 1}  →  aggiungi "offset: { x, y }" su quella voce di "images"`;

  const archiveImagePosMatch = key.match(/^archive\.imagePos\.(\d+)$/);
  if (archiveImagePosMatch) return `Core archive, foto #${Number(archiveImagePosMatch[1]) + 1}  →  aggiungi "offset: { x, y }" su quella voce di ARCHIVE.images`;

  return key;
}

function buildExportText() {
  const sizeOverrides = loadSizeOverrides();
  const orderOverrides = loadOrderOverrides();
  const positionOverrides = loadPositionOverrides();
  const sizeKeys = Object.keys(sizeOverrides);
  const orderKeys = Object.keys(orderOverrides);
  const positionKeys = Object.keys(positionOverrides);

  if (!sizeKeys.length && !orderKeys.length && !positionKeys.length) {
    return "Non hai ancora modificato nulla.\n\nAttiva la modalità modifica (bottone ⇲ in basso a destra): angolo in basso a destra = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta liberamente la didascalia. Poi torna qui.";
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

  return lines.join("\n");
}

function openExportPanel() {
  const overlay = el("div", { class: "export-panel" });
  const textarea = el("textarea", { readonly: "readonly" });
  textarea.value = buildExportText();

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
    location.reload();
  });

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const inner = el("div", { class: "export-panel-inner" }, [
    el("h2", {}, "Esporta modifiche"),
    el("p", {}, "Queste sono le dimensioni e l'ordine che hai regolato trascinando. Copiali (o mandami questo testo in chat) per renderli permanenti sul sito pubblicato."),
    textarea,
    el("div", { class: "export-panel-actions" }, [copyBtn, resetBtn, closeBtn]),
  ]);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}

// Il bottone di modifica e quello di esportazione restano identici tra una
// pagina e l'altra: si creano una volta sola, non li ricrea il router.
let editModeUIReady = false;
function ensureEditModeUI() {
  if (editModeUIReady) return;
  editModeUIReady = true;

  const toggle = el("button", { class: "edit-toggle", "aria-label": "Modifica", title: "Modifica: angolo = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta la didascalia" }, "⇲");
  const exportBtn = el("button", { class: "export-toggle", "aria-label": "Esporta modifiche", title: "Esporta modifiche" }, "⇩");

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("edit-mode");
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
function openLightbox(src, alt) {
  const overlay = el("div", { class: "lightbox" }, [
    el("img", { src, alt: alt || "" }),
  ]);
  const closeBtn = el("button", { class: "lightbox-close", "aria-label": "Chiudi" }, "×");

  function close() {
    overlay.remove();
    document.removeEventListener("keydown", onKeydown);
  }
  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", close);
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  document.addEventListener("keydown", onKeydown);

  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);
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

  const orderedProjects = getOrderedProjects();
  const listItems = orderedProjects.map((p) =>
    el("li", {}, [el("a", { href: `#/project/${p.slug}` }, p.name)])
  );
  const list = el("ul", { class: "home-list" }, listItems);

  listItems.forEach((li) => {
    makeReorderable(li, {
      container: list,
      axis: "y",
      onReorder: (from, to) => {
        const order = orderedProjects.map((p) => p.slug);
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        saveOrderOverride("home.order", order);
        renderRoute();
      },
    });
  });

  const spacer = el("div", { class: "home-spacer" });

  const footer = el(
    "footer",
    { class: "home-footer" },
    FOOTER_LINKS.map((l) => el("a", { href: l.hash, class: "footer-link" }, l.label))
  );

  app.appendChild(header);
  app.appendChild(list);
  app.appendChild(spacer);
  app.appendChild(footer);

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
function renderGallery({ total, title, description, descriptionBox, images, projectNav }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  ensureEditModeUI();

  const resizeObservers = [];
  const sizeKeyPrefix = projectNav ? `project.${projectNav.slug}` : "archive";

  const topbar = el("div", { class: "topbar" }, [
    el("span", { class: "topbar-index" }, String(total)),
    el("span", { class: "topbar-title" }, title),
    el("a", { href: "#/", class: "hamburger", "aria-label": "Torna alla home" }, [
      el("span", {}), el("span", {}), el("span", {}),
    ]),
  ]);

  // Il testo scorre in verticale in loop continuo (marquee): il contenuto
  // è ripetuto due volte in fila dentro ".description-track", che si anima
  // di metà della propria altezza — la seconda copia (nascosta a chi usa
  // uno screen reader) prende il posto della prima esattamente quando
  // questa esce di scena, quindi il giro si ripete senza scatti visibili.
  const makeParagraphs = () => description.map((paragraph) => el("p", {}, paragraph));
  const secondCopy = makeParagraphs();
  secondCopy.forEach((p) => p.setAttribute("aria-hidden", "true"));
  const descTrack = el("div", { class: "description-track" }, [...makeParagraphs(), ...secondCopy]);
  const descBlock = el("div", { class: "description" }, [descTrack]);
  resizeObservers.push(
    makeResizable(descBlock, `${sizeKeyPrefix}.description`, {
      width: (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
      height: descriptionBox && descriptionBox.height,
    })
  );

  const figures = images.map((image, i) => {
    const origIndex = image._index != null ? image._index : i;
    const img = el("img", { src: image._src, alt: image.caption || "", loading: i === 0 ? "eager" : "lazy" });
    const frame = el("div", { class: "photo-frame" }, [img]);
    resizeObservers.push(
      makeResizable(
        frame,
        `${sizeKeyPrefix}.image.${origIndex}`,
        {
          width: image.width || LAYOUT.gallery.imageWidth,
          height: image.height || LAYOUT.gallery.imageHeight,
        },
        { lockRatioTo: img }
      )
    );
    makeZoomable(frame, img);
    makeMovableFree(frame, `${sizeKeyPrefix}.imagePos.${origIndex}`, "Trascina per spostare la foto");

    const figcaption = image.caption ? el("figcaption", {}, image.caption) : null;
    if (figcaption) makeMovableFree(figcaption, `${sizeKeyPrefix}.caption.${origIndex}`, "Trascina per spostare la didascalia");

    return el("figure", { class: "photo", "data-index": i }, [frame, figcaption]);
  });

  const track = el("div", { class: "photo-track" }, figures);
  const viewport = el("div", { class: "photo-viewport" }, [track]);

  const prevBtn = el("button", { class: "nav-arrow prev", "aria-label": "Precedente" }, "←");
  const nextBtn = el("button", { class: "nav-arrow next", "aria-label": "Successivo" }, "→");
  const counter = el("span", { class: "nav-counter" }, `${images.length ? 1 : 0} / ${images.length}`);
  const footerBar = el("div", { class: "gallerybar" }, [prevBtn, counter, nextBtn]);

  app.appendChild(topbar);
  app.appendChild(descBlock);
  app.appendChild(viewport);
  app.appendChild(footerBar);

  // Velocità di lettura costante indipendentemente da quanto è lungo il
  // testo: più paragrafi = giro più lungo, non più veloce. scrollHeight
  // del binario è già DOPPIO (due copie del testo), quindi lo dimezziamo
  // per avere l'altezza di una sola copia (= quanto deve viaggiare prima
  // di ripetersi).
  const MARQUEE_PX_PER_SEC = 28;
  const oneCopyHeight = descTrack.scrollHeight / 2;
  descTrack.style.animationDuration = `${Math.max(8, oneCopyHeight / MARQUEE_PX_PER_SEC)}s`;

  /* ---- viewer foto: slide orizzontale, autoplay 5s + transizione 2s ----
     Questo scorrimento automatico tra le foto della galleria funziona
     sempre, sia per un progetto sia per core archive. Cambia solo cosa
     fanno le frecce: su un progetto portano al progetto precedente/
     successivo (vedi sotto), su core archive scorrono le foto. */
  let current = 0;
  let autoplayTimer = null;
  let paused = false;

  function updateCounter() {
    counter.textContent = `${current + 1} / ${images.length}`;
  }

  function updateViewportHeight() {
    const activeFigure = figures[current];
    if (!activeFigure) return;
    viewport.style.height = `${activeFigure.getBoundingClientRect().height}px`;
  }

  function applyPosition() {
    track.style.transform = `translateX(-${current * 100}%)`;
    updateViewportHeight();
    updateCounter();
  }

  function goTo(i, { user = false } = {}) {
    if (!figures.length) return;
    current = (i + figures.length) % figures.length;
    applyPosition();
    if (user) restartAutoplay();
  }

  function scheduleNext() {
    clearTimeout(autoplayTimer);
    if (paused || figures.length < 2) return;
    autoplayTimer = setTimeout(() => {
      goTo(current + 1);
      scheduleNext();
    }, AUTOPLAY_DELAY);
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

  // se un'immagine è ancora in caricamento, ricalcola l'altezza quando arriva
  figures.forEach((figure, i) => {
    const img = figure.querySelector("img");
    img.addEventListener("load", () => {
      if (i === current) updateViewportHeight();
    });
  });

  window.addEventListener("resize", updateViewportHeight);

  applyPosition();
  scheduleNext();

  currentTeardown = () => {
    clearTimeout(autoplayTimer);
    window.removeEventListener("resize", updateViewportHeight);
    resizeObservers.forEach((o) => o.disconnect());
  };
}

function renderProject(slug) {
  const project = findProject(slug);
  if (!project) {
    renderNotFound();
    return;
  }
  const orderKey = `project.${project.slug}.imageOrder`;
  const order = currentImageOrder(orderKey, project.images.length);
  const images = order.map((origIndex) => {
    const img = project.images[origIndex];
    return { ...img, _index: origIndex, _src: resolveImageSrc(project.slug, origIndex, img) };
  });

  const orderedProjects = getOrderedProjects();
  const idx = orderedProjects.findIndex((p) => p.slug === project.slug);
  const prevSlug = orderedProjects[(idx - 1 + orderedProjects.length) % orderedProjects.length].slug;
  const nextSlug = orderedProjects[(idx + 1) % orderedProjects.length].slug;

  renderGallery({
    total: images.length,
    title: project.name.toLowerCase(),
    description: project.description,
    descriptionBox: project.descriptionBox,
    images,
    projectNav: { slug: project.slug, prevSlug, nextSlug },
  });
}

function renderArchive() {
  const orderKey = "archive.imageOrder";
  const order = currentImageOrder(orderKey, ARCHIVE.images.length);
  const images = order.map((origIndex) => {
    const img = ARCHIVE.images[origIndex];
    return { ...img, _index: origIndex, _src: resolveImageSrc("archive", origIndex, img) };
  });
  renderGallery({
    total: images.length,
    title: ARCHIVE.title,
    description: ARCHIVE.description,
    images,
  });
}

/* -------------------------------------------------------------------------
   8. Render: CONTACTS / ABOUT
   ------------------------------------------------------------------------- */
function renderSimplePage({ title, paragraphs, extraLines = [] }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  ensureEditModeUI();

  const topbar = el("div", { class: "topbar" }, [
    el("span", { class: "topbar-index" }, ""),
    el("span", { class: "topbar-title" }, title.toLowerCase()),
    el("a", { href: "#/", class: "hamburger", "aria-label": "Torna alla home" }, [
      el("span", {}), el("span", {}), el("span", {}),
    ]),
  ]);

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
