/* ==========================================================================
   APP.JS
   ==========================================================================
   Router + rendering + comportamento (viewer galleria a scorrimento
   orizzontale + modalità modifica dimensioni a trascinamento). Il contenuto
   e le dimensioni di default vivono in content.js (PROJECTS, ARCHIVE, LAYOUT).

   Indice:
     1. Costanti regolabili
     2. Helpers generici
     3. Dimensioni regolabili a trascinamento (localStorage + export)
     4. Placeholder immagini (SVG generato al volo)
     5. Render: HOME (lista statica, nessuna animazione)
     6. Render: GALLERY (progetti + core archive) — slide orizzontale
     7. Render: CONTACTS / ABOUT
     8. Router
   ========================================================================== */

/* -------------------------------------------------------------------------
   1. Costanti regolabili
   ------------------------------------------------------------------------- */
const AUTOPLAY_DELAY = 5000;   // ms di pausa su ogni foto prima di avanzare
const TRANSITION_MS = 2000;    // durata dello slide orizzontale tra le foto

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

// Rende "node" ridimensionabile a trascinamento in modalità modifica.
// "key" identifica il blocco (es. "project.lines.image.0") per salvare e
// riproporre la dimensione scelta. "defaults" sono width/height di partenza
// (da LAYOUT o dal singolo progetto/foto in content.js).
function makeResizable(node, key, defaults = {}) {
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
    if (document.body.classList.contains("edit-mode")) {
      saveSizeOverride(key, { width: node.style.width, height: node.style.height });
    }
  });
  observer.observe(node);

  return observer;
}

function setupEditMode(observers) {
  const toggle = el("button", { class: "edit-toggle", "aria-label": "Modifica dimensioni", title: "Modifica dimensioni" }, "⇲");
  const exportBtn = el("button", { class: "export-toggle", "aria-label": "Esporta dimensioni", title: "Esporta dimensioni" }, "⇩");

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("edit-mode");
  });
  exportBtn.addEventListener("click", () => openExportPanel());

  document.body.appendChild(toggle);
  document.body.appendChild(exportBtn);

  return () => {
    toggle.remove();
    exportBtn.remove();
  };
}

// Ferma l'app.js corrente (i toggle di modifica restano tra una pagina e
// l'altra, non vengono ricreati dal router).
let editModeTeardown = null;
function ensureEditModeUI() {
  if (editModeTeardown) return;
  editModeTeardown = setupEditMode();
}

function describeOverrideKey(key) {
  const homeMatch = key === "home.list";
  if (homeMatch) return `LAYOUT.home  →  aggiorna listWidth/listHeight in content.js`;

  const descMatch = key.match(/^project\.(.+)\.description$/);
  if (descMatch) return `Progetto "${descMatch[1]}"  →  aggiungi/aggiorna "descriptionBox" su quel progetto in PROJECTS`;

  const imgMatch = key.match(/^project\.(.+)\.image\.(\d+)$/);
  if (imgMatch) return `Progetto "${imgMatch[1]}", foto #${Number(imgMatch[2]) + 1}  →  aggiorna width/height su quella voce di "images"`;

  if (key === "archive.description") return `Core archive  →  aggiorna "descriptionBox" sull'oggetto ARCHIVE`;

  const archiveImgMatch = key.match(/^archive\.image\.(\d+)$/);
  if (archiveImgMatch) return `Core archive, foto #${Number(archiveImgMatch[1]) + 1}  →  aggiorna width/height su quella voce di ARCHIVE.images`;

  return key;
}

function buildExportText() {
  const overrides = loadSizeOverrides();
  const keys = Object.keys(overrides);
  if (!keys.length) {
    return "Non hai ancora ridimensionato nulla.\n\nAttiva la modalità modifica (bottone ⇲ in basso a destra), trascina l'angolo in basso a destra di un blocco per cambiarne larghezza/altezza, poi torna qui.";
  }
  const lines = [
    "Dimensioni personalizzate — copia i valori qui sotto dentro content.js",
    "(sostituendo/aggiungendo i campi indicati), poi puoi anche azzerare",
    "queste modifiche dal pulsante \"Reset\" qui sotto.",
    "",
  ];
  keys.forEach((key) => {
    const size = overrides[key];
    lines.push(`# ${describeOverrideKey(key)}`);
    lines.push(`  width: "${size.width || "auto"}", height: "${size.height || "auto"}"`);
    lines.push("");
  });
  return lines.join("\n");
}

function openExportPanel() {
  const overlay = el("div", { class: "export-panel" });
  const textarea = el("textarea", { readonly: "readonly" });
  textarea.value = buildExportText();

  const copyBtn = el("button", {}, "Copia");
  const resetBtn = el("button", {}, "Reset dimensioni");
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
    location.reload();
  });

  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const inner = el("div", { class: "export-panel-inner" }, [
    el("h2", {}, "Esporta dimensioni"),
    el("p", {}, "Queste sono le dimensioni che hai regolato trascinando. Copiale in content.js per renderle permanenti sul sito pubblicato."),
    textarea,
    el("div", { class: "export-panel-actions" }, [copyBtn, resetBtn, closeBtn]),
  ]);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}

/* -------------------------------------------------------------------------
   4. Placeholder immagini
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
   5. Render: HOME — lista statica, dimensioni da LAYOUT.home
   ------------------------------------------------------------------------- */
function renderHome() {
  app.innerHTML = "";
  app.classList.remove("has-fixed-bars");
  ensureEditModeUI();

  const header = el("header", { class: "home-header" }, [
    el("span", { class: "kicker" }, SITE.kicker),
    el("span", { class: "author" }, SITE.author),
  ]);

  const list = el(
    "ul",
    { class: "home-list" },
    PROJECTS.map((p) =>
      el("li", {}, [el("a", { href: `#/project/${p.slug}` }, p.name)])
    )
  );

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
   6. Render: GALLERY (usata sia per i progetti sia per "core archive")
   Le foto scorrono in ORIZZONTALE (slide) tra loro; la pagina scorre in
   VERTICALE quando testo o foto corrente non entrano nello schermo.
   ------------------------------------------------------------------------- */
function renderGallery({ keyPrefix, total, title, description, descriptionBox, images }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  ensureEditModeUI();

  const resizeObservers = [];

  const topbar = el("div", { class: "topbar" }, [
    el("span", { class: "topbar-index" }, String(total)),
    el("span", { class: "topbar-title" }, title),
    el("a", { href: "#/", class: "hamburger", "aria-label": "Torna alla home" }, [
      el("span", {}), el("span", {}), el("span", {}),
    ]),
  ]);

  const descBlock = el(
    "div",
    { class: "description" },
    description.map((paragraph) => el("p", {}, paragraph))
  );
  resizeObservers.push(
    makeResizable(descBlock, `${keyPrefix}.description`, {
      width: (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
      height: descriptionBox && descriptionBox.height,
    })
  );

  const frames = [];
  const figures = images.map((image, i) => {
    const img = el("img", { src: image._src, alt: image.caption || "", loading: i === 0 ? "eager" : "lazy" });
    const frame = el("div", { class: "photo-frame" }, [img]);
    frames.push(frame);
    const figure = el("figure", { class: "photo", "data-index": i }, [
      frame,
      image.caption ? el("figcaption", {}, image.caption) : null,
    ]);
    resizeObservers.push(
      makeResizable(frame, `${keyPrefix}.image.${i}`, {
        width: image.width || LAYOUT.gallery.imageWidth,
        height: image.height || LAYOUT.gallery.imageHeight,
      })
    );
    return figure;
  });

  const track = el("div", { class: "photo-track" }, figures);
  const viewport = el("div", { class: "photo-viewport" }, [track]);

  const prevBtn = el("button", { class: "nav-arrow prev", "aria-label": "Foto precedente" }, "←");
  const nextBtn = el("button", { class: "nav-arrow next", "aria-label": "Foto successiva" }, "→");
  const counter = el("span", { class: "nav-counter" }, `${images.length ? 1 : 0} / ${images.length}`);
  const footerBar = el("div", { class: "gallerybar" }, [prevBtn, counter, nextBtn]);

  app.appendChild(topbar);
  app.appendChild(descBlock);
  app.appendChild(viewport);
  app.appendChild(footerBar);

  /* ---- viewer: slide orizzontale, autoplay 5s + transizione 2s + frecce ---- */
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

  prevBtn.addEventListener("click", () => goTo(current - 1, { user: true }));
  nextBtn.addEventListener("click", () => goTo(current + 1, { user: true }));
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
  const images = project.images.map((img, i) => ({ ...img, _src: resolveImageSrc(project.slug, i, img) }));
  renderGallery({
    keyPrefix: `project.${project.slug}`,
    total: images.length,
    title: project.name.toLowerCase(),
    description: project.description,
    descriptionBox: project.descriptionBox,
    images,
  });
}

function renderArchive() {
  const images = ARCHIVE.images.map((img, i) => ({ ...img, _src: resolveImageSrc("archive", i, img) }));
  renderGallery({
    keyPrefix: "archive",
    total: images.length,
    title: ARCHIVE.title,
    description: ARCHIVE.description,
    images,
  });
}

/* -------------------------------------------------------------------------
   7. Render: CONTACTS / ABOUT
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
   8. Router
   ------------------------------------------------------------------------- */
function parseHash() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [route, param] = hash.split("/");
  return { route: route || "home", param };
}

function renderRoute() {
  teardownCurrentView();
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

  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);
