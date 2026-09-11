/* ==========================================================================
   CONTENT.JS
   ==========================================================================
   Tutto il contenuto reale del sito vive qui, separato dalla logica
   (app.js). Per aggiungere/modificare una galleria basta lavorare in
   questo file — non serve toccare app.js o style.css.

   Come aggiungere una foto reale:
     images: [
       { caption: "winery, sicily", src: "images/lines/01.jpg" }
     ]
   Finché "src" è null, app.js genera automaticamente un placeholder SVG
   colorato al posto della foto (vedi placeholderImg() in app.js).

   DIMENSIONI — sei tu a decidere quanto è grande un blocco di testo o una
   foto: ogni valore width/height qui sotto accetta qualsiasi unità CSS
   ("620px", "80%", "60vw", "auto", ...). "auto" per height mantiene le
   proporzioni naturali dell'immagine/del testo.

   L'ordine dell'array PROJECTS è l'ordine in cui i nomi appaiono nella
   lista della home.
   ========================================================================== */

const SITE = {
  kicker: "Photography",
  author: "Lorenzo Romani",
};

/* -------------------------------------------------------------------------
   LAYOUT — dimensioni di default. Ogni progetto/immagine può sovrascriverle
   (vedi "descriptionBox" sui progetti e "width"/"height" sulle singole
   immagini più sotto) — se non le sovrascrivi, si usano questi valori.
   ------------------------------------------------------------------------- */
const LAYOUT = {
  home: {
    // Il blocco con l'elenco dei progetti in home. width limita la colonna
    // di testo; height "auto" lascia che sia alta quanto il contenuto — se
    // vuoi una fascia fissa (es. con scroll interno) metti un valore fisso
    // tipo "480px".
    listWidth: "420px",
    listHeight: "auto",
  },
  gallery: {
    // Larghezza di default del blocco di descrizione sopra le foto.
    descriptionWidth: "620px",
    // Dimensioni di default di OGNI foto in galleria, sovrascrivibili
    // singolarmente (vedi esempio in "lines" qui sotto).
    imageWidth: "100%",
    imageHeight: "auto",
  },
};

const PROJECTS = [
  {
    slug: "lines",
    name: "Lines",
    description: [
      "I'm drawn to ordinary architecture, anonymous buildings, unremarkable structures, the kind of places that don't ask to be looked at. What interests me is what happens when you look anyway: the geometry that becomes visible when context falls away, the weight of a wall, the line where two materials meet, the moment when something background becomes the thing itself.",
      "I shoot on film, which slows the process down and changes what I notice. Light and grain do work that description can't.",
      "Each image is a single encounter with a specific place and a specific quality of light. As for my stills, they form a growing archive, i will endlessly keep returning to.",
    ],
    // descriptionBox: { width: "620px" },  // <- decommenta per sovrascrivere LAYOUT.gallery.descriptionWidth per questo solo progetto
    images: [
      { caption: "winery, sicily", src: null },
      { caption: "mountain pasture", src: null },
      { caption: "cocoon", src: null },
      // Esempio di dimensioni personalizzate per una singola foto:
      // { caption: "cocoon", src: null, width: "480px", height: "600px" },
    ],
  },
  { slug: "stills", name: "Stills", description: ["Descrizione da definire per il progetto “Stills”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "tower", name: "Tower", description: ["Descrizione da definire per il progetto “Tower”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "recognition", name: "Recognition", description: ["Descrizione da definire per il progetto “Recognition”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "michelin", name: "Michelin", description: ["Descrizione da definire per il progetto “Michelin”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "paper-tape", name: "Paper tape", description: ["Descrizione da definire per il progetto “Paper tape”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "mediality", name: "Mediality", description: ["Descrizione da definire per il progetto “Mediality”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "cement", name: "Cement", description: ["Descrizione da definire per il progetto “Cement”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "estrangement", name: "Estrangement", description: ["Descrizione da definire per il progetto “Estrangement”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "suspension", name: "Suspension", description: ["Descrizione da definire per il progetto “Suspension”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "plastic", name: "Plastic", description: ["Descrizione da definire per il progetto “Plastic”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "tech", name: "Tech", description: ["Descrizione da definire per il progetto “Tech”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "pink", name: "Pink", description: ["Descrizione da definire per il progetto “Pink”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "stasis", name: "Stasis", description: ["Descrizione da definire per il progetto “Stasis”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "hair", name: "Hair", description: ["Descrizione da definire per il progetto “Hair”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "maniac", name: "Maniac", description: ["Descrizione da definire per il progetto “Maniac”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "eating", name: "Eating", description: ["Descrizione da definire per il progetto “Eating”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "vacation", name: "Vacation", description: ["Descrizione da definire per il progetto “Vacation”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "toy", name: "Toy", description: ["Descrizione da definire per il progetto “Toy”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "perfume", name: "Perfume", description: ["Descrizione da definire per il progetto “Perfume”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "whitening", name: "Whitening", description: ["Descrizione da definire per il progetto “Whitening”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
];

// Link del footer, sotto alla lista in home e nella pagina di ogni galleria.
const FOOTER_LINKS = [
  { label: "core archive", hash: "#/archive" },
  { label: "contacts", hash: "#/contacts" },
  { label: "about", hash: "#/about" },
];

/* -------------------------------------------------------------------------
   CORE ARCHIVE — selezione curata a mano (non generata automaticamente).
   Stessa struttura di un progetto: aggiungi/rimuovi/riordina le immagini
   che vuoi mostrare qui, con didascalie e dimensioni a tua scelta.
   ------------------------------------------------------------------------- */
const ARCHIVE = {
  title: "core archive",
  description: ["Una selezione trasversale, aggiornata a mano."],
  images: [
    { caption: "lines — winery, sicily", src: null, width: "420px" },
    { caption: "lines — cocoon", src: null, width: "420px" },
    // Aggiungi qui le altre foto della selezione, stesso formato:
    // { caption: "didascalia", src: "images/archive/01.jpg", width: "420px" },
  ],
};

// Testo placeholder per le pagine statiche — da sostituire con i tuoi contenuti.
const CONTACTS = {
  title: "Contacts",
  paragraphs: [
    "Per commissioni, stampe o collaborazioni scrivimi.",
  ],
  lines: [
    { label: "email", value: "hello@lorenzoromani.example" },
    { label: "instagram", value: "@lorenzoromani" },
  ],
};

const ABOUT = {
  title: "About",
  paragraphs: [
    "Lorenzo Romani è un fotografo. Testo biografico da definire.",
  ],
};
