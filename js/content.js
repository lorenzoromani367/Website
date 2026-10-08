/* ==========================================================================
   CONTENT.JS
   ==========================================================================
   Tutto il contenuto reale del sito vive qui, separato dalla logica
   (app.js). Per aggiungere/modificare una galleria basta lavorare in
   questo file — non serve toccare app.js o style.css.

   Come aggiungere una foto reale:
     images: [
       { caption: "winery, sicily", src: "images/boudaries/01.jpg" }
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
    // Larghezza/altezza di default del blocco di descrizione sopra le
    // foto, e di quanto lo sposti dalla sua posizione naturale — presi
    // dall'impaginazione scelta per "lines" e resi lo standard per ogni
    // galleria (progetto o core archive). Un progetto può sovrascriverli
    // con "descriptionBox: { width, height, offset: { x, y } }".
    descriptionWidth: "700px",
    descriptionHeight: "380px",
    descriptionOffset: { x: 0, y: 140 },
    // Le foto NON hanno una larghezza/altezza di default qui: finché non
    // le tocchi hanno tutte la STESSA ALTEZZA, calcolata automaticamente
    // da app.js in base allo spazio che resta libero sotto il testo (si
    // aggiorna da sola se il testo cambia altezza o la finestra viene
    // ridimensionata). Vuoi una foto diversa dalle altre? Aggiungi
    // "width"/"height" su quella singola voce di "images" (vedi esempio
    // in "lines" qui sotto), o trascina le sue maniglie rosse.
    //
    // "imageOffset"/"captionOffset" invece SONO uno spostamento di
    // default (stesso "lines"): ogni foto/didascalia parte già spostata
    // così, a meno che quella singola voce di "images" non abbia il suo
    // proprio "offset"/"captionOffset" (vedi esempio in "lines").
    imageOffset: { x: 0, y: 300 },
    captionOffset: { x: 80, y: 360 },
    // Posizione di default della "cornice" della pagina (numero e titolo
    // in alto, hamburger, numero in basso vicino alle frecce) — uguale
    // per ogni galleria, così tutte le pagine hanno la stessa impagina-
    // zione di "lines" senza doverla ritrascinare una per una.
    topbarIndexOffset: { x: 120, y: 20 },
    topbarTitleOffset: { x: 120, y: 80 },
    bottomIndexOffset: { x: -180, y: 0 },
    hamburgerOffset: { x: 0, y: -20 },
    // Altezza di default dei due spazi vuoti trascinabili (prima delle
    // frecce, e in fondo alla pagina) — 0 = invisibili finché non li
    // trascini tu; qui invece partono già con un po' d'aria, come in
    // "lines".
    spacerBeforeBarHeight: "100px",
    spacerBottomHeight: "40px",
  },
  // Stessi campi di "gallery" qui sopra, ma letti SOLO sotto i 700px (vedi
  // pickLayout() in app.js) — presi dall'impaginazione mobile scelta
  // per "lines" (vedi anche il commento sul progetto "lines" più sotto) e
  // resi lo standard per ogni galleria su schermo stretto. Un campo non
  // presente qui vuol dire "nessun offset" su mobile (parte da zero/auto),
  // non "usa il valore desktop qui sopra".
  galleryMobile: {
    descriptionWidth: "340px",
    descriptionHeight: "340px",
    descriptionOffset: { x: 0, y: 100 },
    imageOffset: { x: 0, y: 160 },
    captionOffset: { x: 0, y: 220 },
    topbarTitleOffset: { x: 60, y: 40 },
    topbarIndexOffset: { x: 60, y: 0 },
    bottomIndexOffset: { x: 0, y: 0 },
    hamburgerOffset: { x: 0, y: -20 },
    spacerBeforeBarHeight: "100px",
    spacerBottomHeight: "60px",
  },
};

const PROJECTS = [
  {
    slug: "boudaries",
    name: "Boundaries",
        // Nessuna "descriptionBox" qui: la dimensione/posizione di
    // quel blocco resta quella di default in LAYOUT sia per desktop che per mobile.
    // Ordine, didascalie e "mobile: {...}" aggiornati dall'export panel
    // (foto #N = indice N-1, sempre quello ORIGINALE: vedi photoLabel in
    // app.js — non cambia se riordini). "mobile" è un override letto
    // SOLO sotto i 700px (vedi pickLayout() in app.js): stessa idea
    // di offset/captionOffset/width/height, ma non tocca la versione
    // desktop, che resta quella di sempre.
    images: [
{
caption: "wire",
src: "images/boudaries/1 wire.JPG",
mobile: { width: "280px" },
captionOffset: { x: 101, y: 0 },
width: "559.221px",
zoomBox: { width: "1109.31px", height: "916.76px" }
},
{
caption: "hill",
src: "images/boudaries/2 hill.JPG",
mobile: { width: "320px" },
width: "560.086px",
captionOffset: { x: 80, y: 380 }
},
{ caption: "field", src: "images/boudaries/3 field.jpg", width: "440px", height: "622px", mobile: { width: "280px", height: "396px" } },
{ caption: "sky", src: "images/boudaries/4 sky.jpg", mobile: { width: "320px" }, width: "426.007px", captionOffset: { x: 88, y: 0 }, offset: { x: 0, y: 300 }, zoomBox: { width: "1519.8px", height: "916.76px" } },
{ caption: "olympus", src: "images/boudaries/5 olympus.jpg", width: "520px", height: "590px", mobile: { width: "300px", height: "340px" } },
{ caption: "stage", src: "images/boudaries/6 stage.JPG", mobile: { width: "300px" }, width: "565.492px", zoomBox: { width: "912.41px", height: "916.76px" } },
{ caption: "tapestry", src: "images/boudaries/7 tapestry.JPG", width: "480px", height: "568px", mobile: { width: "300px", height: "355px" } },
{ caption: "decay", src: "images/boudaries/8 decay.jpg", mobile: { width: "260px" }, offset: { x: 8, y: 300 }, width: "382.062px", captionOffset: { x: 74, y: 0 }, zoomBox: { width: "1519.8px", height: "679.489px" } },
{ caption: "emst", src: "images/boudaries/lines-13.jpg", width: "460px", height: "575px", captionOffset: { x: 100, y: 360 }, mobile: { width: "300px", height: "375px" } },
{
caption: "construction",
src: "images/boudaries/lines-7.jpg",
mobile: { width: "320px", height: "363px" },
}
],
  },
  {
slug: "homes",
name: "Homes",
images: [
{ caption: "wine", src: "images/homes/1 wine.jpg", width: "583.004px", zoomBox: { width: "1000.86px", height: "900.3599999999999px" } },
{ caption: "family", src: "images/homes/2 family.jpg", width: "463.138px", zoomBox: { width: "1519.8px", height: "910.779px" } },
{ caption: "left", src: "images/homes/3 left.jpg", width: "548.138px" },
{ caption: "squatting", src: "images/homes/4 squatting.jpg", width: "391.37px", zoomBox: { width: "1519.8px", height: "1022px" } },
{ caption: "church", src: "images/homes/5 church.jpg", width: "445.187px", zoomBox: { width: "1519.8px", height: "951.308px" } },
{ caption: "huts", src: "images/homes/6 huts.jpg", width: "507.508px", zoomBox: { width: "1519.8px", height: "795.33px" } },
{ caption: "ongoing", src: "images/homes/7 ongoing.jpg", width: "533.627px", zoomBox: { width: "1519.8px", height: "882.311px" } },
],
},
  {
    slug: "stills",
    name: "Stills",
        images: [
      { caption: "J. Kronester Bavaria Tea Settt", src: "images/stills/stills-1.jpg" },
      { caption: "pot and bowl", src: "images/stills/stills-2.jpg", width: "562.798px" },
      { caption: "furla men’s bag", src: "images/stills/stills-3.jpg", width: "408.808px" },
      { caption: "apples", src: "images/stills/stills-4.jpg" },
      { caption: "ionia porcelain set", src: "images/stills/stills-5.jpg", width: "587.294px" },
      { caption: "ikea flowers", src: "images/stills/stills-6.jpg", zoomBox: { width: "1519.8px", height: "1003.05px" } },
      { caption: "perfume bottle", src: "images/stills/stills-7.jpg", width: "488.255px" },
      { caption: "table cloth", src: "images/stills/stills-8.jpg", width: "429.924px" },
      { caption: "chairs", src: "images/stills/stills-9.jpg", width: "415.242px" },
      { caption: "jewelry, rabat", src: "images/stills/stills-10.jpg", width: "448.578px", zoomBox: { width: "1519.8px", height: "1022px" } },
      { caption: "mercedes, back seat", src: "images/stills/stills-11.jpg", width: "500.959px" },
      { caption: "tie, yves saint laurent", src: "images/stills/stills-13.jpg", width: "373.051px", zoomBox: { width: "1519.8px", height: "990.037px" } },
      { caption: "twins", src: "images/stills/stills-14.jpg" },
      { caption: "car window", src: "images/stills/stills-15.jpg", width: "341.82px" },
      { caption: "cutlery", src: "images/stills/stills-16.jpg" },
    ],
  },
  {
    slug: "tower",
    name: "Tower",
    images: [
      { caption: "repetition", src: "images/tower/tower-1.jpg", align: "left", offset: { x: 0, y: 52 }, width: "426.695px", zoomBox: { width: "852.727px", height: "916.76px" } },
      { caption: "repetition", src: "images/tower/tower-2.jpg", width: "359.703px", align: "left", offset: { x: 0, y: 52 }, zoomBox: { width: "1519.8px", height: "758.273px" } }
    ],
  },
  {
    slug: "recognition",
    name: "Recognition",
        images: [
      { caption: "fetus", src: "images/recognition/recognition-1.jpg", width: "399.352px" },
      { caption: "jumping jack", src: "images/recognition/recognition-2.jpg", width: "444.039px", zoomBox: { width: "1519.8px", height: "984.44px" } },
      { caption: "cake, sponge", src: "images/recognition/recognition-3.jpg", width: "424.93px", zoomBox: { width: "1519.8px", height: "986.118px" } },
      { caption: "self portrait", src: "images/recognition/recognition-4.jpg", width: "420.817px" },
      { caption: "circuit", src: "images/recognition/recognition-5.jpg", width: "469.29px" },
      { caption: "bacon", src: "images/recognition/recognition-6.jpg", width: "533.742px" },
      { caption: "belvedere", src: "images/recognition/recognition-7.jpg", width: "465.988px" },
      { caption: "dreamy landscape", src: "images/recognition/recognition-8.jpg" },
      { caption: "fishes", src: "images/recognition/recognition-9.jpg", width: "577.02px" },
      { caption: "cocoon", src: "images/recognition/recognition-10.jpg", width: "400.021px", zoomBox: { width: "1519.8px", height: "1013.19px" } },
      { caption: "iceberg", src: "images/recognition/recognition-11.jpg", width: "428.314px" },
    ],
  },
  {
    slug: "michelin",
    name: "Michelin",
    // Blocco di testo tolto dall'export panel ("elimina descrizione"):
    // array vuoto invece del campo del tutto assente, così renderGallery
    // (che chiama sempre description.map(...)) non deve gestire un caso
    // speciale — vedi descriptionRemoved in app.js, che nasconde il
    // blocco anche quando l'array è vuoto, non solo col flag salvato.
        images: [
      { caption: "delta, restaurant", src: "images/michelin/michelin-1.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 } },
      { caption: "delta, restaurant", src: "images/michelin/michelin-2.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }, zoomBox: { width: "1519.8px", height: "996.333px" } },
      { caption: "delta, restaurant", src: "images/michelin/michelin-3.jpg", align: "left", offset: { x: 0, y: 52 }, width: "412.973px" },
      { caption: "delta, restaurant", src: "images/michelin/michelin-4.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }, zoomBox: { width: "1519.8px", height: "601.846px" } },
      { caption: "delta, restaurant", src: "images/michelin/michelin-5.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 } },
    ],
  },
  {
    slug: "paper-tape",
    name: "Paper tape",
    images: [{ caption: "", src: "images/paper-tape/rock.jpg", align: "left", offset: { x: 0, y: 52 }, width: "455.569px", zoomBox: { width: "714.016px", height: "916.76px" } }]
  },
  {
    slug: "cement",
    name: "Cement",
        images: [
      { caption: "dancing", src: "images/cement/dancing.jpg" },
      { caption: "disassembled body", src: "images/cement/disassembled-body.jpg" },
      { caption: "employee looking outside his window", src: "images/cement/employee-looking-outside-his-window.jpg" },
      { caption: "springtime", src: "images/cement/springtime.jpg" },
      { caption: "the sunset of flower X1 45 (part I)", src: "images/cement/sunset-of-flower.jpg" },
      { caption: "you're ugly catherine, just ugly. Do something. I'm trying, I'm failing", src: "images/cement/youre-ugly-catherine.jpg" },
    ],
  },
  {
    slug: "beach",
    name: "Beach",
        images: [{ caption: "back", src: "images/beach/beach-1.jpg" , width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }, zoomBox: { width: "1519.8px", height: "645.914px" } }],
  },

  {
    slug: "plastic",
    name: "Plastic",
        images: [{ caption: "horse", src: "images/plastic/plastic-1.jpg" , width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }}],
  },
  {
    slug: "sospension",
    name: "Sospension",
        images: [
      { caption: "untitled (part of series)", src: "images/sospension/recognition-1.jpg", captionOffset: { x: 80, y: 0 }, width: "330.219px", zoomBox: { width: "1519.8px", height: "1011.32px" } },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-2.jpg", width: "382.496px" },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-3.jpg", width: "580.746px" },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-4.jpg", width: "539.758px", captionOffset: { x: 80, y: 0 }, zoomBox: { width: "780.406px", height: "916.76px" } },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-6.jpg", width: "416.055px", zoomBox: { width: "1519.8px", height: "1002.29px" } },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-7.jpg" },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-8.jpg", width: "347.432px", zoomBox: { width: "1519.8px", height: "1022px" } },
      { caption: "untitled (part of series)", src: "images/sospension/recognition-9.jpg", width: "563.422px", zoomBox: { width: "869.961px", height: "916.76px" } },
    ],
  },
  {
    slug: "hair",
    name: "Hair",
    images: [{ caption: "", src: "images/hair/hair-1.jpg", align: "left", offset: { x: 0, y: 52 }, width: "430.547px" }]
  },

  // Progetto ricreato da zero (era rimasto bloccato da un'eliminazione
  // fatta tempo fa in modalità modifica sul vecchio "orig:0" di questa
  // posizione — vedi imageRemovalId/descriptionRemovalId in app.js, che
  // ora identificano foto/descrizione dal loro contenuto invece che dalla
  // posizione, proprio per evitare che torni a succedere).
  {
    slug: "fluoxetine",
    name: "Fluoxetine",
        images: [{ caption: "dinner", src: "images/fluoxetine/dinner.JPG" , width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }}],
  },
  {
    slug: "licking",
    name: "Licking",
    images: [{ caption: "father", src: "images/licking/licking-1.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }, zoomBox: { width: "1519.8px", height: "1003.09px" } }],
  },
  {
    slug: "moon",
    name: "Moon",
    images: [{ caption: "embossing", src: "images/moon/moon-1.jpg", align: "left", offset: { x: 0, y: 52 }, width: "413.504px", zoomBox: { width: "863.727px", height: "916.76px" } }],
  },
  {
    slug: "compression",
    name: "Compression",
        images: [
      { caption: "sunset", src: "images/compression/sunset.JPG", align: "left", offset: { x: 0, y: 52 }, width: "413.033px", zoomBox: { width: "1272.2px", height: "916.76px" } }
    ],
  },

  {
    slug: "pile",
    name: "Pile",
        images: [{ caption: "cars", src: "images/pile/cars.JPG" , width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 }, zoomBox: { width: "1519.8px", height: "778.367px" } }],
  },
  {
    slug: "maniac",
    name: "Maniac",
    images: [
      { caption: "", src: "images/maniac/maniac-1.jpg", zoomBox: { width: "1050.8px", height: "916.76px" } },
      { caption: "", src: "images/maniac/maniac-2.jpg", zoomBox: { width: "1149.93px", height: "916.76px" } },
      { caption: "", src: "images/maniac/maniac-3.jpg" },
      { caption: "", src: "images/maniac/maniac-4.jpg", zoomBox: { width: "1519.8px", height: "1022px" } },
      { caption: "", src: "images/maniac/maniac-5.jpg" },
      { caption: "", src: "images/maniac/maniac-6.JPG" },
    ]
  },
  {
    slug: "mediality",
    name: "Mediality",
    images: [
      { caption: "", src: "images/mediality/mediality-1.jpg", zoomBox: { width: "1519.8px", height: "1022px" } },
      { caption: "", src: "images/mediality/mediality-2.jpg" },
      { caption: "", src: "images/mediality/mediality-3.jpg", zoomBox: { width: "915.969px", height: "916.76px" } },
      { caption: "", src: "images/mediality/mediality-4.jpg" },
      { caption: "", src: "images/mediality/mediality-5.jpg", zoomBox: { width: "1519.8px", height: "900.339px" } },
      { caption: "", src: "images/mediality/senza titolo-1-2.JPG", width: "503.383px", zoomBox: { width: "1519.8px", height: "994.45px" } },
    ]
  },
  {
    slug: "sofa",
    name: "Sofa",
    images: [{ caption: "", src: "images/sofa/sushi discotheque.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 } }]
  },
  {
    slug: "whitening",
    name: "Whitening",
    images: [{ caption: "", src: "images/whitening/smile.jpg", align: "left", offset: { x: 0, y: 52 }, width: "338.301px" }]
  }
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
    pages: [
      {
          "id": "page_1",
          "images": [
              {
                  "type": "word",
                  "text": "back",
                  "uid": "uid_1791286888502_1417",
                  "linkedImageSrc": "images/beach/beach-1.jpg",
                  "linkedImageLinkTo": "project/beach"
              },
              {
                  "type": "word",
                  "text": "field",
                  "uid": "uid_1791300174629_6130",
                  "linkedImageSrc": "images/core archive/lines-11.jpg"
              },
              {
                  "type": "word",
                  "text": "church",
                  "uid": "uid_1791300315480_7880",
                  "linkedImageSrc": "images/core archive/lines-5.jpg"
              },
              {
                  "type": "word",
                  "text": "fishes",
                  "uid": "uid_1791300380946_5945",
                  "linkedImageSrc": "images/recognition/recognition-9.jpg",
                  "linkedImageLinkTo": "project/recognition"
              },
              {
                  "type": "word",
                  "text": "horse",
                  "uid": "uid_1791300691867_6144",
                  "linkedImageSrc": "images/plastic/plastic-1.jpg",
                  "linkedImageLinkTo": "project/plastic"
              },
              {
                  "type": "word",
                  "text": "jewelry, rabat",
                  "uid": "uid_1791300744404_2431",
                  "linkedImageSrc": "images/core archive/stills-10.jpg",
                  "linkedImageLinkTo": "archive"
              },
              {
                  "type": "word",
                  "text": "tie, saint laurent",
                  "uid": "uid_1791300788906_8601",
                  "linkedImageSrc": "images/stills/stills-13.jpg",
                  "linkedImageLinkTo": "project/stills"
              },
              {
                  "type": "word",
                  "text": "hill",
                  "uid": "uid_1791300840051_1654",
                  "linkedImageSrc": "images/lines/2 hill.JPG",
                  "linkedImageLinkTo": "project/lines"
              },
              {
                  "type": "word",
                  "text": "sunset",
                  "uid": "uid_1791300932325_7275",
                  "linkedImageSrc": "images/compression/sunset.JPG",
                  "linkedImageLinkTo": "project/compression"
              },
              {
                  "type": "word",
                  "text": "upside down",
                  "uid": "uid_1791300954219_5972",
                  "linkedImageSrc": "images/stills/upside down.JPG",
                  "linkedImageLinkTo": "project/stills"
              },
              {
                  "type": "word",
                  "text": "cocoon",
                  "uid": "uid_1791301098682_8677",
                  "linkedImageSrc": "images/recognition/recognition-10.jpg",
                  "linkedImageLinkTo": "project/recognition"
              },
              {
                  "type": "word",
                  "text": "upper middle-class",
                  "uid": "uid_1791304250928_133",
                  "linkedImageSrc": "images/home/2 family.jpg"
              },
              {
                  "type": "word",
                  "text": "delta",
                  "uid": "uid_1791304281103_1664",
                  "linkedImageSrc": "images/core archive/michelin-5.jpg",
                  "linkedImageLinkTo": "archive"
              },
              {
                  "type": "word",
                  "text": "porcelain",
                  "uid": "uid_1791304323352_9307",
                  "linkedImageSrc": "images/core archive/stills-5.jpg",
                  "linkedImageLinkTo": "archive"
              },
              {
                  "type": "word",
                  "text": "cars",
                  "uid": "uid_1791304360871_8891",
                  "linkedImageSrc": "images/pile/cars.JPG"
              },
              {
                  "type": "word",
                  "text": "murano",
                  "uid": "uid_1791305668347_6899"
              }
          ]
      }
  ]
};

// Testo placeholder per le pagine statiche — da sostituire con i tuoi contenuti.
const CONTACTS = {
  title: "Contacts",
  paragraphs: [],
  lines: [
    { label: "email", value: "lorenzoromani1@gmail.com" },
    { label: "cellulare", value: "+39 3911618380" },
  ],
};

const ABOUT = {
  title: "About",
  paragraphs: [
    `I work mainly with films because they fail in a very good way. The grain, the loss of detail, the colours that slide slightly off, these are not flaws but the conditions under which a photograph starts to resemble how things actually look when you pay attention to them. Digital imaging has become too precise, too complete. It has stopped corresponding to reality and people are starting to notice that too.`,
    `My background is in painting, and the two practices share the same passions — suspensions, fragmentations, an incomplete gesture, surfaces or forms that carry meaning without explaining it. These themes move between paint and film depending on what the subject requires. When photographing, I shoot on film when the grain and the colour shift will enrich the work. Whereas I use digital when a brief or a particular product asks for it.`,
    `I now work from Athens.`,
    `What I find here, and nowhere else quite like this, is that it's the decadence, hidden or visible, seems to give me a good deal of hope for the future. This tension runs through most of what I make.`,
  ],
};
