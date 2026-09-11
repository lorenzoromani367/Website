/* ==========================================================================
   APP.JS
   ==========================================================================
   Router + rendering + comportamento (marquee, autoplay galleria, menu).
   Nessuna dipendenza esterna. Il contenuto vive in content.js.

   Indice:
     1. Costanti regolabili
     2. Helpers generici
     3. Placeholder immagini (SVG generato al volo)
     4. Render: HOME
     5. Render: GALLERY (progetti + core archive)
     6. Render: CONTACTS / ABOUT
     7. Menu ad hamburger (overlay di navigazione)
     8. Router
   ========================================================================== */

/* -------------------------------------------------------------------------
   1. Costanti regolabili
   ------------------------------------------------------------------------- */
const AUTOPLAY_DELAY = 5000;   // ms di pausa su ogni foto prima di avanzare
const TRANSITION_MS = 2000;    // durata dello scroll/transizione tra le foto
const MARQUEE_SPEED_PX_S = 22; // velocità del marquee in home (px al secondo, più basso = più lento)

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
// seed (slug+indice), così ogni progetto ha una sua tinta riconoscibile.
// Quando hai le foto vere, sostituisci "src" in content.js e questa
// funzione non verrà più chiamata per quel progetto.
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

function resolveImageSrc(project, index, image) {
  return image.src || placeholderImg(`${project.slug}-${index}`, `${project.name} ${index + 1}`);
}

/* -------------------------------------------------------------------------
   4. Render: HOME
   ------------------------------------------------------------------------- */
function renderHome() {
  app.innerHTML = "";
  app.classList.remove("has-fixed-bars");

  const header = el("header", { class: "home-header" }, [
    el("span", { class: "kicker" }, SITE.kicker),
    el("span", { class: "author" }, SITE.author),
  ]);

  const viewport = el("div", { class: "marquee-viewport" });
  const track = el("div", { class: "marquee-track" });

  const makeList = () =>
    el(
      "ul",
      { class: "marquee-list" },
      PROJECTS.map((p) =>
        el("li", {}, [
          el("a", { href: `#/project/${p.slug}`, class: "marquee-link" }, p.name),
        ])
      )
    );

  // Il contenuto è duplicato per ottenere un loop verticale continuo e
  // impercettibile: quando la prima copia esce dal basso, la seconda la
  // sta già seguendo esattamente allo stesso punto.
  const listA = makeList();
  const listB = makeList();
  track.appendChild(listA);
  track.appendChild(listB);
  viewport.appendChild(track);

  const spacer = el("div", { class: "marquee-spacer" });

  const footer = el(
    "footer",
    { class: "home-footer" },
    FOOTER_LINKS.map((l) => el("a", { href: l.hash, class: "footer-link" }, l.label))
  );

  app.appendChild(header);
  app.appendChild(viewport);
  app.appendChild(spacer);
  app.appendChild(footer);

  // --- animazione marquee: durata calcolata dall'altezza reale del contenuto,
  // così la velocità (px/s) resta costante indipendentemente da quante voci
  // ci sono nella lista.
  let rafId = null;
  let paused = false;
  let lastNow = null;
  let offset = 0; // px già percorsi in questo ciclo (0 -> listHeight)
  let listHeight = 0;

  function measure() {
    listHeight = listA.getBoundingClientRect().height;
    // Il contenitore è alto esattamente quanto una copia della lista: così a
    // riposo (offset 0 o listHeight) si vede l'elenco intero una sola volta,
    // com'è nel riferimento, e lo spazio restante lo occupa lo spacer sotto.
    viewport.style.height = `${listHeight}px`;
  }

  function tick(now) {
    if (lastNow == null) lastNow = now;
    const delta = now - lastNow;
    lastNow = now;
    if (!paused && listHeight > 0) {
      offset += (MARQUEE_SPEED_PX_S / 1000) * delta;
      if (offset >= listHeight) offset -= listHeight;
      // Scorre verso il basso: partiamo dalla seconda copia "sopra" (-listHeight)
      // e ci spostiamo verso 0, dando la sensazione che la lista scenda.
      track.style.transform = `translateY(${offset - listHeight}px)`;
    }
    rafId = requestAnimationFrame(tick);
  }

  function handlePause() {
    paused = true;
    viewport.classList.add("is-paused");
  }
  function handleResume() {
    paused = false;
    viewport.classList.remove("is-paused");
  }

  measure();
  rafId = requestAnimationFrame(tick);

  window.addEventListener("resize", measure);
  viewport.addEventListener("mouseenter", handlePause);
  viewport.addEventListener("mouseleave", handleResume);
  viewport.addEventListener("touchstart", handlePause, { passive: true });
  viewport.addEventListener("touchend", handleResume);

  currentTeardown = () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", measure);
  };
}

/* -------------------------------------------------------------------------
   5. Render: GALLERY (usata sia per i progetti sia per "core archive")
   ------------------------------------------------------------------------- */
function renderGallery({ index, total, title, description, images, variant = "default" }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  if (variant === "polaroid") app.classList.add("variant-polaroid");
  else app.classList.remove("variant-polaroid");

  const topbar = el("div", { class: "topbar" }, [
    el("span", { class: "topbar-index" }, String(total)),
    el("span", { class: "topbar-title" }, title),
    el("button", { class: "hamburger", "aria-label": "Menu", onclick: openMenu }, [
      el("span", {}), el("span", {}), el("span", {}),
    ]),
  ]);

  const descBlock = el(
    "div",
    { class: "description" },
    description.map((paragraph) => el("p", {}, paragraph))
  );

  const figures = images.map((image, i) =>
    el("figure", { class: "photo", "data-index": i }, [
      el("img", { src: image._src, alt: image.caption || "", loading: i === 0 ? "eager" : "lazy" }),
      image.caption ? el("figcaption", {}, image.caption) : null,
    ])
  );

  const feed = el("div", { class: "photo-feed" }, figures);

  const prevBtn = el("button", { class: "nav-arrow prev", "aria-label": "Foto precedente" }, "←");
  const nextBtn = el("button", { class: "nav-arrow next", "aria-label": "Foto successiva" }, "→");
  const counter = el("span", { class: "nav-counter" }, `${images.length ? 1 : 0} / ${images.length}`);
  const footerBar = el("div", { class: "gallerybar" }, [prevBtn, counter, nextBtn]);

  app.appendChild(topbar);
  app.appendChild(descBlock);
  app.appendChild(feed);
  app.appendChild(footerBar);

  /* ---- viewer: autoplay 5s + transizione 2s + frecce manuali ---- */
  let current = 0;
  let autoplayTimer = null;
  let paused = false;

  function updateCounter() {
    counter.textContent = `${current + 1} / ${images.length}`;
  }

  function scrollToIndex(i, behavior = "smooth") {
    const target = figures[i];
    if (!target) return;
    target.scrollIntoView({ behavior, block: "start" });
  }

  function goTo(i, { user = false } = {}) {
    if (!figures.length) return;
    current = (i + figures.length) % figures.length;
    scrollToIndex(current);
    updateCounter();
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
  feed.addEventListener("mouseenter", handlePause);
  feed.addEventListener("mouseleave", handleResume);
  feed.addEventListener("touchstart", handlePause, { passive: true });

  // Se l'utente scrolla manualmente nel feed, teniamo il contatore
  // sincronizzato con la foto più visibile.
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) {
        const i = Number(visible.target.dataset.index);
        if (!Number.isNaN(i)) {
          current = i;
          updateCounter();
        }
      }
    },
    { root: null, threshold: [0.6] }
  );
  figures.forEach((f) => observer.observe(f));

  document.documentElement.style.setProperty("--transition-ms", `${TRANSITION_MS}ms`);
  updateCounter();
  scheduleNext();

  currentTeardown = () => {
    clearTimeout(autoplayTimer);
    observer.disconnect();
  };
}

function renderProject(slug) {
  const project = findProject(slug);
  if (!project) {
    renderNotFound();
    return;
  }
  const images = project.images.map((img, i) => ({ ...img, _src: resolveImageSrc(project, i, img) }));
  renderGallery({
    index: PROJECTS.indexOf(project) + 1,
    total: images.length,
    title: project.name.toLowerCase(),
    description: project.description,
    images,
    variant: "default",
  });
}

function renderArchive() {
  // "core archive": una selezione (qui: la prima foto di ogni progetto) in
  // variante polaroid. Cambia questa logica in content.js/app.js quando
  // avrai una selezione curata definitiva.
  const images = PROJECTS.map((p, pi) => {
    const first = p.images[0];
    return {
      caption: p.name.toLowerCase(),
      _src: resolveImageSrc(p, 0, first || { src: null }),
    };
  });
  renderGallery({
    total: images.length,
    title: "core archive",
    description: ["Una selezione trasversale, in continuo aggiornamento."],
    images,
    variant: "polaroid",
  });
}

/* -------------------------------------------------------------------------
   6. Render: CONTACTS / ABOUT
   ------------------------------------------------------------------------- */
function renderSimplePage({ title, paragraphs, extraLines = [] }) {
  app.innerHTML = "";
  app.classList.add("has-fixed-bars");
  app.classList.remove("variant-polaroid");

  const topbar = el("div", { class: "topbar" }, [
    el("span", { class: "topbar-index" }, ""),
    el("span", { class: "topbar-title" }, title.toLowerCase()),
    el("button", { class: "hamburger", "aria-label": "Menu", onclick: openMenu }, [
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
   7. Menu ad hamburger (overlay di navigazione)
   ------------------------------------------------------------------------- */
function openMenu() {
  if (document.querySelector(".menu-overlay")) return;

  const overlay = el("div", { class: "menu-overlay" });
  const closeBtn = el("button", { class: "menu-close", "aria-label": "Chiudi menu" }, "×");

  const list = el(
    "ul",
    { class: "menu-list" },
    PROJECTS.map((p) => el("li", {}, el("a", { href: `#/project/${p.slug}` }, p.name)))
  );

  const footer = el(
    "div",
    { class: "menu-footer" },
    FOOTER_LINKS.map((l) => el("a", { href: l.hash, class: "footer-link" }, l.label))
  );

  overlay.appendChild(closeBtn);
  overlay.appendChild(list);
  overlay.appendChild(footer);
  document.body.appendChild(overlay);
  document.body.classList.add("menu-open");

  function close() {
    overlay.remove();
    document.body.classList.remove("menu-open");
  }

  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
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
