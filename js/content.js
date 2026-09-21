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
    topbarTitleOffset: { x: 0, y: 40 },
    bottomIndexOffset: { x: 0, y: 0 },
    hamburgerOffset: { x: 0, y: -20 },
    spacerBottomHeight: "60px",
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
    // Nessuna "descriptionBox" desktop qui: la dimensione/posizione di
    // quel blocco resta quella di default in LAYOUT.gallery. Solo su
    // mobile ha una misura sua (vedi pickLayout() in app.js).
    descriptionBox: {
      mobile: { width: "360px", height: "340px", offset: { x: 0, y: 100 } },
    },
    // Ordine, didascalie e "mobile: {...}" aggiornati dall'export panel
    // (foto #N = indice N-1, sempre quello ORIGINALE: vedi photoLabel in
    // app.js — non cambia se riordini). "mobile" è un override letto
    // SOLO sotto i 700px (vedi pickLayout() in app.js): stessa idea
    // di offset/captionOffset/width/height, ma non tocca la versione
    // desktop, che resta quella di sempre.
    images: [
      {
        caption: "house, norway",
        src: "images/lines/lines-1.jpg",
        width: "480px",
        height: "673px",
        captionOffset: { x: 100, y: 360 },
        mobile: { offset: { x: 0, y: 100 } },
      },
      {
        caption: "winery, sicily",
        src: "images/lines/lines-4.jpg",
        captionOffset: { x: 80, y: 380 },
      },
      {
        caption: "sky",
        src: "images/lines/lines-2.jpg",
        width: "440px",
        height: "630px",
        mobile: { offset: { x: 0, y: 120 }, captionOffset: { x: 0, y: 100 } },
      },
      { caption: "church", src: "images/lines/lines-5.jpg", width: "440px", height: "622px" },
      { caption: "olympus", src: "images/lines/lines-6.jpg", width: "520px", height: "599px", captionOffset: { x: 100, y: 360 } },
      { caption: "construction", src: "images/lines/lines-7.jpg", width: "520px", height: "590px" },
      { caption: "unfinished", src: "images/lines/lines-8.jpg" },
      { caption: "mountain pasture", src: "images/lines/lines-9.jpg", width: "480px", height: "568px" },
      { caption: "home", src: "images/lines/lines-10.jpg", width: "420px", height: "663px", offset: { x: 120, y: 300 }, captionOffset: { x: -120, y: 400 } },
      { caption: "field", src: "images/lines/lines-11.jpg", width: "460px", height: "575px", captionOffset: { x: 100, y: 360 } },
      {
        caption: "ignored column",
        src: "images/lines/lines-12.jpg",
        mobile: {
          width: "340px",
          height: "385px",
          offset: { x: 0, y: 180 },
          captionOffset: { x: 0, y: 240 },
        },
      },
      { caption: "emst", src: "images/lines/lines-13.jpg", width: "480px", height: "640px" },
    ],
  },
  {
    slug: "stills",
    name: "Stills",
    description: [
      `These images begin with an attraction, an object that holds my attention for reasons I can't always explain, and that sometimes become clear after the photograph is made. A piece of porcelain, a bowl, a perfume bottle, fruit on a surface. I don't choose them for what they represent. I choose them because something in their presence gets me.`,
      `I chose to show only one image of each subject. The one that best rejects the label under which the subject would fall.`,
    ],
    images: [
      { caption: "J. Kronester Bavaria Tea Settt", src: "images/stills/stills-1.jpg" },
      { caption: "pot and bowl", src: "images/stills/stills-2.jpg" },
      { caption: "furla men’s bag", src: "images/stills/stills-3.jpg" },
      { caption: "apples", src: "images/stills/stills-4.jpg" },
      { caption: "ionia porcelain set", src: "images/stills/stills-5.jpg" },
      { caption: "ikea flowers", src: "images/stills/stills-6.jpg" },
      { caption: "perfume bottle", src: "images/stills/stills-7.jpg" },
      { caption: "table cloth", src: "images/stills/stills-8.jpg" },
      { caption: "chairs", src: "images/stills/stills-9.jpg" },
      { caption: "jewelry, rabat", src: "images/stills/stills-10.jpg" },
      { caption: "mercedes, back seat", src: "images/stills/stills-11.jpg" },
      { caption: "tie, yves saint laurent", src: "images/stills/stills-13.jpg" },
      { caption: "twins", src: "images/stills/stills-14.jpg" },
      { caption: "car window", src: "images/stills/stills-15.jpg" },
      { caption: "cutlery", src: "images/stills/stills-16.jpg" },
    ],
  },
  {
    slug: "tower",
    name: "Tower",
    description: [], // blocco di testo tolto dall'export panel, vedi commento su "michelin"
    images: [
      { caption: "repetition", src: "images/tower/tower-1.jpg" },
      { caption: "repetition", src: "images/tower/tower-2.jpg" },
    ],
  },
  {
    slug: "recognition",
    name: "Recognition",
    description: [
      `Whatever persists of a thing that has shattered, withered, or been severed from the whole to which it once belonged, continues to be; it carries with it a volume and a form that are simply different. It is through this transformation that it slips from view. Its state, its lack of utility, and its failure to belong to anything recognizable, render it invisible to the passerby.`,
      `There is a quality in these fragments that mirrors me. They have been reduced to shards, components stripped of agency, relentlessly hemmed in by the miniature world that encompasses and imprisons them. A stray breeze suffices to displace them, to deposit them where they have no desire to be and they are voiceless in the transaction. To photograph them is an act of solidarity. It is a means of drawing near, of taking their part. In the act of capturing their image, I recognize a condition I know well: that sense of being unmoored, of never quite belonging to a whole. It is not a constant state, nor is it always identical, but it is there.`,
      `I find solace in naming them, not with the identifiers we impose upon one another as humans, but with words that allow me to witness them exactly as they appear in that fleeting moment. Doing so, for reasons I cannot entirely grasp, it's relieving.`,
    ],
    images: [
      { caption: "fetus", src: "images/recognition/recognition-1.jpg" },
      { caption: "jumping jack", src: "images/recognition/recognition-2.jpg" },
      { caption: "cake, sponge", src: "images/recognition/recognition-3.jpg" },
      { caption: "self portrait", src: "images/recognition/recognition-4.jpg" },
      { caption: "circuit", src: "images/recognition/recognition-5.jpg" },
      { caption: "bacon", src: "images/recognition/recognition-6.jpg" },
      { caption: "belvedere", src: "images/recognition/recognition-7.jpg" },
      { caption: "dreamy landscape", src: "images/recognition/recognition-8.jpg" },
      { caption: "fishes", src: "images/recognition/recognition-9.jpg" },
      { caption: "cocoon", src: "images/recognition/recognition-10.jpg" },
      { caption: "iceberg", src: "images/recognition/recognition-11.jpg" },
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
    description: [],
    images: [
      { caption: "delta, restaurant", src: "images/michelin/michelin-1.jpg" },
      { caption: "delta, restaurant", src: "images/michelin/michelin-2.jpg" },
      { caption: "delta, restaurant", src: "images/michelin/michelin-3.jpg" },
      { caption: "delta, restaurant", src: "images/michelin/michelin-4.jpg" },
      { caption: "delta, restaurant", src: "images/michelin/michelin-5.jpg" },
    ],
  },
  { slug: "paper-tape", name: "Paper tape", description: [], images: [{ caption: "", src: "images/paper-tape/rock.JPG" }] },
  {
    slug: "mediality",
    name: "Mediality",
    description: [
      `Every gesture carries a direction. An arm reaching out, a hand grasping, a body turning. Movement bears its own end within itself, and in that finality, it closes, concludes, and becomes legible. What we call the understanding of a gesture is, in large part, the recognition of its destination: we see where it is headed, and in that knowledge, the gesture disappears, subsumed by its function.`,
      `This project intervenes in that mechanism of closure. These images isolate intentional, complete movements from which the segment revealing their end has been removed. It is not a matter of interrupting an action, but of extracting the moment when the direction is already present in the body but not yet yielded to the gaze. What remains is what Agamben calls the gesture in its pure form: a means without end—a movement that produces no result but exhibits its own mediality. It is the fact of being a body in relation to the world, prior to and independent of any destination.`,
      `The distinction is precise. An interrupted gesture carries the trace of what should have been fulfilled; it is a readable absence. The gesture pursued in this project is not interrupted: it is liberated from its own destination. Finality has not been thwarted; it has been removed, restoring to the movement a space that its conclusion would have sealed off.`,
      `The origin of this research lies in the observation of visual material produced at the end of the 19th century by Gilles de la Tourette, a neurologist and student of human movement whose patients exhibited gestures devoid of coordination or a recognizable end. Isolated from their sequence, those frames became open fields of interpretation: the same movement could be mourning, dance, prayer, or waiting. Not because the gesture was ambiguous, but because it had been returned to a state prior to classification. The project stems from that observation: if a gesture without an end becomes manifold to the gaze, then a gesture with an end, photographically stripped of its purpose, generates the same openness through the opposite path.`,
      `Incompleteness is not a flaw of the image or the gaze. It is its most expressive condition.`,
      `The images presented here constitute a selection from an ongoing project and should be considered as part of a broader body of work currently in development. These images may change as the project unfolds.`,
    ],
    images: [
      { caption: "", src: "images/mediality/mediality-1.jpg" },
      { caption: "", src: "images/mediality/mediality-2.jpg" },
      { caption: "", src: "images/mediality/mediality-3.jpg" },
      { caption: "", src: "images/mediality/mediality-4.jpg" },
      { caption: "", src: "images/mediality/mediality-5.jpg" },
      { caption: "", src: "images/mediality/mediality-6.jpg" },
    ],
  },
  {
    slug: "cement",
    name: "Cement",
    description: [
      `I believe one of the greatest tragedies of our time is humanity's gradual detachment from reality. This detachment is not only technological or social — it is perceptual. We begin to lose the ability to inhabit what surrounds us, and slowly, even the ability to inhabit ourselves. Presence becomes unstable, incomplete, as if existence were unfolding in a suspended register.`,
      `About a year ago I began blending concrete and figurative painting, attempting to give form to a condition of mental dissociation that felt both personal and widely shared. I was no longer craving what was within my reach but only what eluded me, turning what was truly important into an irritating distraction. What emerged was not simply desire, but a persistent state of suspension, a threshold that could be seen but never crossed.`,
      `I spent too long lingering at the edge of a world glimpsed through a half-open door, one I could perceive but never fully enter. With time, my thirst fixated on the unattainable, growing insatiable, leading toward a quiet and lonesome alienation. This restless hunger, one many of us recognize, fuels an endless chase for validation, trapping us in cycles of consumption and performance. The relief it offers is fleeting, dissolving quickly into monotony, leaving behind numbness and exhaustion.`,
      `Gradually, imagination — once a vessel for expansion and transformation — suffocates under the weight of unreachable ideals. As children we move outward; as adults we often contract, shaped by invisible pressures and internal distortions. While appearing active within the structures of daily life, we may already be drifting into deeper solitude, inhabiting a temporal condition where movement is possible yet never fully realized. Time does not flow — it accumulates, thickening around us.`,
      `Within this condition a deeper fracture emerges: the separation between body and environment. The individual no longer fully inhabits their surroundings, nor their own body. Identity becomes externalized, dependent on perception rather than lived experience. We begin to define ourselves not by who we are, but by how we are seen, until presence itself feels displaced.`,
      `The figures within my work emerge from this disjunction. Fragmented anatomies, unstable postures, and fragile material surfaces attempt to give form to a corporeality that is no longer cohesive; bodies perceived from within a state of disconnection rather than observed from the outside. They are not portraits, but manifestations of an internal condition: attempts to reconstruct an inhabitable self.`,
      `Concrete, with its associations of solidity and permanence, becomes paradoxically fragile. It cracks, erodes, and destabilizes, mirroring the tension between structural weight and psychological vulnerability. The material resists control, echoing the instability of perception itself.`,
      `Each work becomes both trace and residue — evidence of a looping mental and physical state, a slow suffocation in which existence continues yet never fully consolidates into presence. A condition of stasis where we remain alive, but not entirely able to inhabit our own experience.`,
      `What remains is not death, nor survival, but suspension: a prolonged threshold where the body persists, the environment surrounds us, yet the connection between them feels momentarily, and sometimes permanently, interrupted.`,
    ],
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
    description: ["Descrizione da definire per il progetto “Beach”."],
    images: [{ caption: "", src: "images/beach/beach-1.jpg" }],
  },
  {
    slug: "estrangement",
    name: "Estrangement",
    description: [
      `These photographs begin with the body, not as subject, but as site. What I am trying to photograph is not a person but a condition: bodies that persist, that move and go through the motions, but where something in the experience of being alive doesn't quite land. Not absence, not pain. Something quieter.`,
      `Shot close, over time, with people I know. The photographs are not portraits, they are records of a state that shows in the body itself, in skin, in posture, in the way someone occupies a space without filling it.`,
      `Each photograph is a single instance of the same condition, contained, unresolved, and ongoing.`,
    ],
    images: [
      { caption: "", src: "images/estrangement/estrangement-1.jpg" },
      { caption: "", src: "images/estrangement/estrangement-3.jpg" },
      { caption: "", src: "images/estrangement/estrangement-4.jpg" },
      { caption: "", src: "images/estrangement/estrangement-5.jpg" },
    ],
  },
  {
    slug: "plastic",
    name: "Plastic",
    description: ["Descrizione da definire per il progetto “Plastic”."],
    images: [{ caption: "", src: "images/plastic/plastic-1.jpg" }],
  },
  {
    slug: "stasis",
    name: "Stasis",
    description: [
      `This project explores photographic situations in which time loses direction and narrative function. The images do not depict events or decisive moments, but conditions, states in which nothing appears to happen and nothing seems destined to occur, places where meaning and action recede from their usual prominence.`,
      `By disrupting the viewer's instinct to construct temporal sequences, the work proposes a non-narrative perception of reality, where the world is encountered as a condition rather than an event.`,
      `An enduring state; a paradoxical form of motion without transformation, perceptible only through attentive looking.`,
      `The images presented here constitute a selection from an ongoing project and should be considered as part of a broader body of work currently in development. These images may change as the project unfolds.`,
    ],
    images: [
      { caption: "untitled (part of series)", src: "images/stasis/recognition-1.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-2.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-3.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-4.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-6.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-7.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-8.jpg" },
      { caption: "untitled (part of series)", src: "images/stasis/recognition-9.jpg" },
    ],
  },
  { slug: "hair", name: "Hair", description: ["Descrizione da definire per il progetto “Hair”."], images: [{ caption: "", src: "images/hair/hair-1.jpg" }] },
  { slug: "eating", name: "Eating", description: ["Descrizione da definire per il progetto “Eating”."], images: [{ caption: "", src: "images/eating/dreams.jpg" }] },
  {
    slug: "maniac",
    name: "Maniac",
    description: [
      `Every social space generates unspoken expectations about who belongs there. Neighborhoods, parties, markets, urban fringes, places where relationships are already in motion, roles are already assigned, and bodies are already read according to a code that precedes their arrival. The presence of someone who does not match that code produces something the system cannot process: a figure who is there, yet remains out of place within the logic of the scene.`,
      `The sociologist Erving Goffman used the term "maniac" to describe not the clinically insane, but those who fail to keep to their place, simply because no place was ever assigned to them. An indecipherable presence within the standard categories of social interaction, whose incongruity is not aggressive or intentional, but structural. It is a condition many recognize: existing in a context one did not choose and which has not reconfigured itself to accommodate us.`,
      `The figures in this project inhabit that condition. Anonymous bodies placed in scenes that did not expect them: present without being welcomed, visible without being recognized. They emerge from eras, environments, and aesthetic codes foreign to their surroundings. Some are ignored. Others are viewed through the wrong lens. The scene may react or remain indifferent, but in no case does it absorb them.`,
      `Their anonymity is a condition of existence before it is a formal choice. Bodies with no declared history, no recognizable identity, no sense of belonging to the surrounding context. A tangible disjunction between the self and the world, that sensation of being a system error within a reality that continues to function without you.`,
    ],
    images: [
      { caption: "unknown II", src: "images/maniac/maniac-1.jpg" },
      { caption: "unknown III", src: "images/maniac/maniac-2.jpg" },
      { caption: "unknown IV", src: "images/maniac/maniac-3.jpg" },
      { caption: "unknown V", src: "images/maniac/maniac-4.jpg" },
      { caption: "unknown I", src: "images/maniac/maniac-5.jpg" },
      { caption: "", src: "images/maniac/maniac-6.jpg" },
    ],
  },
  { slug: "vacation", name: "Vacation", description: ["Descrizione da definire per il progetto “Vacation”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "toy", name: "Toy", description: ["Descrizione da definire per il progetto “Toy”."], images: [{ caption: "", src: "images/toy/toy-1.jpg" }] },
  { slug: "perfume", name: "Perfume", description: ["Descrizione da definire per il progetto “Perfume”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "whitening", name: "Whitening", description: ["Descrizione da definire per il progetto “Whitening”."], images: [{ caption: "", src: "images/whitening/whitening-1.jpg" }] },
  {
    slug: "bar",
    name: "Bar",
    description: ["Descrizione da definire per il progetto “Bar”."],
    images: [
      { caption: "", src: "images/bar/bar-1.jpg" },
      { caption: "", src: "images/bar/bar-2.jpg" },
    ],
  },
  // Progetto ricreato da zero (era rimasto bloccato da un'eliminazione
  // fatta tempo fa in modalità modifica sul vecchio "orig:0" di questa
  // posizione — vedi imageRemovalId/descriptionRemovalId in app.js, che
  // ora identificano foto/descrizione dal loro contenuto invece che dalla
  // posizione, proprio per evitare che torni a succedere).
  {
    slug: "fluoxetine",
    name: "Fluoxetine",
    description: ["Descrizione da definire per il progetto “Fluoxetine”."],
    images: [{ caption: "", src: "images/fluoxetine/dinner.JPG" }],
  },
  {
    slug: "licking",
    name: "Licking",
    description: [], // blocco di testo tolto dall'export panel, vedi commento su "michelin"
    images: [{ caption: "father", src: "images/licking/licking-1.jpg" }],
  },
  {
    slug: "moon",
    name: "Moon",
    description: [], // blocco di testo tolto dall'export panel, vedi commento su "michelin"
    images: [{ caption: "embossing", src: "images/moon/moon-1.jpg" }],
  },
  {
    slug: "compression",
    name: "Compression",
    description: ["Descrizione da definire per il progetto “Compression”."],
    images: [
      { caption: "", src: "images/compression/compression-1.jpg" },
      { caption: "", src: "images/compression/compression-3.jpg" },
      { caption: "", src: "images/compression/compression-4.jpg" },
      { caption: "", src: "images/compression/compression-5.jpg" },
      { caption: "", src: "images/compression/compression-6.jpg" },
    ],
  },
  { slug: "tech", name: "Tech", description: ["Descrizione da definire per il progetto “Tech”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  { slug: "pink", name: "Pink", description: ["Descrizione da definire per il progetto “Pink”."], images: [{ caption: "placeholder 01", src: null }, { caption: "placeholder 02", src: null }] },
  {
    slug: "sofa",
    name: "Sofa",
    description: ["Descrizione da definire per il progetto “Sofa”."],
    images: [{ caption: "", src: "images/sofa/sushi discotheque.jpg" }],
  },
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
    { caption: "", src: "images/core archive/beach-1.jpg" },
    { caption: "", src: "images/core archive/compression-5.jpg" },
    { caption: "", src: "images/core archive/estrangement-1.jpg" },
    { caption: "", src: "images/core archive/lines-11.jpg" },
    { caption: "", src: "images/core archive/lines-5.jpg" },
    { caption: "", src: "images/core archive/michelin-1.jpg" },
    { caption: "", src: "images/core archive/michelin-5.jpg" },
    { caption: "", src: "images/core archive/recognition-10.jpg" },
    { caption: "", src: "images/core archive/recognition-3.jpg" },
    { caption: "", src: "images/core archive/recognition-9.jpg" },
    { caption: "", src: "images/core archive/springtime.jpg" },
    { caption: "", src: "images/core archive/stills-1.jpg" },
    { caption: "", src: "images/core archive/stills-10.jpg" },
    { caption: "", src: "images/core archive/stills-11.jpg" },
    { caption: "", src: "images/core archive/stills-16.jpg" },
    { caption: "", src: "images/core archive/stills-3.jpg" },
    { caption: "", src: "images/core archive/stills-5.jpg" },
    // Aggiungi qui altre foto della selezione, stesso formato:
    // { caption: "didascalia", src: "images/core archive/01.jpg" },
  ],
};

// Testo placeholder per le pagine statiche — da sostituire con i tuoi contenuti.
const CONTACTS = {
  title: "Contacts",
  paragraphs: [],
  lines: [
    { label: "email", value: "scrivi@la-tua-email.com" },
    { label: "cellulare", value: "+39 123 456 7890" },
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
