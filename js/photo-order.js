/* ==========================================================================
   PHOTO-ORDER.JS — l'ordine STABILE delle foto di una cartella
   --------------------------------------------------------------------------
   Perché esiste (20 novembre): ogni foto di un progetto ha un NUMERO, la sua posizione nell'elenco delle foto (dopo le voci scritte in content.js), e le
   misure, l'ordine e il posto delle didascalie che salvi in modalità modifica (js/site-state.js) sono legati a quel numero. Con l'elenco in ordine
   alfabetico, una foto nuova con un nome che viene PRIMA di altre spingeva avanti tutte le seguenti: ognuna prendeva le misure e il posto di un'altra
   (successo con le foto aggiunte il 20 novembre in Stills, Homes e Complicity: in Stills «murano» è diventata più alta della finestra e la pagina non
   scendeva più fino in fondo).

   Regola: le foto che c'erano restano dove sono, quelle nuove vanno IN FONDO (in ordine alfabetico fra loro). «Dove sono» è scritto in
   js/images-order.js (window.IMAGE_ORDER), che il server locale e la pubblicazione tengono aggiornato (watch_images.js).

   Un solo codice per tutti e due: lo usa il sito (app_v58.js, mergeDynamicImages) per mettere le foto nell'ordine giusto, e lo usa watch_images.js per
   scrivere l'ordine. Così l'ordine che il sito calcola è per forza quello che il generatore ha scritto. Maiuscole e minuscole non contano per riconoscere
   una foto (sul Mac «a.JPG» e «a.jpg» sono lo stesso file).
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PhotoOrder = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // files  = i percorsi delle foto che ci sono adesso (in qualunque ordine)
  // memory = l'ordine ricordato (percorsi, anche con maiuscole diverse, anche di foto che non ci sono più); può mancare o essere vuoto
  // Restituisce i percorsi di "files": prima quelli già ricordati, nell'ordine ricordato; poi i nuovi, in ordine alfabetico.
  function arrange(files, memory) {
    const rank = new Map();
    (Array.isArray(memory) ? memory : []).forEach((path, i) => {
      const key = typeof path === "string" ? path.toLowerCase() : null;
      if (key !== null && !rank.has(key)) rank.set(key, i);
    });
    const remembered = [];
    const fresh = [];
    (Array.isArray(files) ? files : []).forEach((path) => {
      (rank.has(String(path).toLowerCase()) ? remembered : fresh).push(path);
    });
    remembered.sort((a, b) => rank.get(String(a).toLowerCase()) - rank.get(String(b).toLowerCase()));
    fresh.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); // sort() semplice: stesso ordine su Mac, Windows e sul server di pubblicazione
    return remembered.concat(fresh);
  }

  return { arrange };
});
