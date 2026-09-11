/* ==========================================================================
   APP.JS
   ==========================================================================
   Router + rendering + comportamento (viewer galleria a scorrimento
   orizzontale). Il contenuto e le dimensioni di default vivono in
   content.js (PROJECTS, ARCHIVE, LAYOUT).

   Indice:
     1. Costanti regolabili
     2. Helpers generici
     3. Placeholder immagini (SVG generato al volo)
     4. Render: HOME (lista statica, nessuna animazione)
     5. Render: GALLERY (progetti + core archive) — slide orizzontale
     6. Render: CONTACTS / ABOUT
     7. Router (con gestione errori: se content.js ha un errore di sintassi
        o un valore mancante, la pagina mostra un messaggio invece di
        restare vuota)
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

// Applica width/height (in qualsiasi unità CSS) a un elemento, se definiti.
function applyBoxSize(node, { width, height } = {}) {
  if (width) node.style.width = width;
  if (height && height !== "auto") node.style.height = height;
  return node;
}

// Tiene traccia degli event listener/timer della vista corrente, così il
// router può ripulirli prima di disegnare la vista successiva.
let currentTeardown = null;
function teardownCurrentView() {
  if (typeof currentTeardown === "function") currentTeardown();
  currentTeardown = null;
}

/* -------------------------------------------------------------------------
   3. Placeholder immagini
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
   4. Render: HOME — lista statica, dimensioni da LAYOUT.home
   ------------------------------------------------------------------------- */
function renderHome() {
  app.innerHTML = "";
  app.classList.remove("has-fixed-bars");

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
  applyBoxSize(list, LAYOUT.home);

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

  currentTeardown = null;
}

/* -------------------------------------------------------------------------
   5. Render: GALLERY (usata sia per i progetti sia per "core archive")
   Le foto scorrono in ORIZZONTALE (slide) tra loro; la pagina scorre in
   VERTICALE quando testo o foto corrente non entrano nello schermo.

   Le frecce in basso, per un progetto, portano al progetto precedente/
   successivo (passa "projectNav"); per core archive, invece, scorrono le
   foto della selezione (projectNav assente).
   ------------------------------------------------------------------------- */
function renderGallery({ total, title, description, descriptionBox, images, projectNav }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");

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
  applyBoxSize(descBlock, {
    width: (descriptionBox && descriptionBox.width) || LAYOUT.gallery.descriptionWidth,
    height: descriptionBox && descriptionBox.height,
  });

  const figures = images.map((image, i) => {
    const img = el("img", { src: image._src, alt: image.caption || "", loading: i === 0 ? "eager" : "lazy" });
    const frame = el("div", { class: "photo-frame" }, [img]);
    applyBoxSize(frame, {
      width: image.width || LAYOUT.gallery.imageWidth,
      height: image.height || LAYOUT.gallery.imageHeight,
    });
    return el("figure", { class: "photo", "data-index": i }, [
      frame,
      image.caption ? el("figcaption", {}, image.caption) : null,
    ]);
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
  };
}

function renderProject(slug) {
  const project = findProject(slug);
  if (!project) {
    renderNotFound();
    return;
  }
  const images = project.images.map((img, i) => ({ ...img, _src: resolveImageSrc(project.slug, i, img) }));

  const idx = PROJECTS.indexOf(project);
  const prevSlug = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length].slug;
  const nextSlug = PROJECTS[(idx + 1) % PROJECTS.length].slug;

  renderGallery({
    total: images.length,
    title: project.name.toLowerCase(),
    description: project.description,
    descriptionBox: project.descriptionBox,
    images,
    projectNav: { prevSlug, nextSlug },
  });
}

function renderArchive() {
  const images = ARCHIVE.images.map((img, i) => ({ ...img, _src: resolveImageSrc("archive", i, img) }));
  renderGallery({
    total: images.length,
    title: ARCHIVE.title,
    description: ARCHIVE.description,
    images,
  });
}

/* -------------------------------------------------------------------------
   6. Render: CONTACTS / ABOUT
   ------------------------------------------------------------------------- */
function renderSimplePage({ title, paragraphs, extraLines = [] }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");

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
   7. Router
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
