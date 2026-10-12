/* ==========================================================================
   STATE-MERGE.JS — fusione "a tre vie" delle modifiche del sito
   --------------------------------------------------------------------------
   Perché esiste: le modifiche fatte in modalità modifica vivono in DUE posti,
   la memoria del browser e il file js/site-state.js sul disco, e il file può
   essere cambiato da un altro browser (Safari, Vivaldi...) o da un'altra scheda.
   Prima, quando i due non coincidevano, uno dei due veniva buttato via per
   intero: è così che alcune didascalie "sparivano" dopo aver riavviato il sito.

   Adesso si confrontano TRE copie, voce per voce:
     - base   = com'era il file l'ultima volta che questo browser lo ha salvato/letto
     - local  = quello che c'è ora in questo browser
     - remote = quello che c'è ora sul disco

   Per ogni voce:
     - uguale in local e remote           → niente da fare
     - cambiata solo qui (local ≠ base)   → si tiene la versione di questo browser
     - cambiata solo sul disco            → si tiene la versione del disco
     - cambiata in entrambi in modo diverso → "conflitto": vince "prefer"
       ("local" = quello che hai appena fatto qui, "remote" = quello su disco)
   Così una modifica non cancella MAI quelle fatte altrove su voci diverse; e se
   davvero si toglie qualcosa (es. si svuota una didascalia) la rimozione vale.

   Un valore che è un dizionario (posizioni, misure, didascalie...) viene
   confrontato anche voce per voce al suo interno: due finestre che toccano
   didascalie DIVERSE si sommano. Gli elenchi "a insieme" (foto eliminate, righe
   nascoste in home) si sommano per elemento. Tutto il resto (es. le pagine del
   Core Archive) è un blocco unico.

   Usato sia dal sito (js/app_v58.js, in modalità modifica) sia dal server
   locale (server.js): un solo codice, stesso risultato ovunque.
   Lavora su testi JSON, come la memoria del browser: { chiave: "testo JSON" }.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SiteStateMerge = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Elenchi in cui l'ORDINE non conta e si aggiunge/toglie per elemento
  const SET_WHOLE = ["site-home-hidden-v1"]; // il valore intero è un elenco (righe nascoste in home)
  const SET_CHILDREN = ["site-removed-images-v1"]; // ogni voce del dizionario è un elenco (foto eliminate)

  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  function sortDeep(value) {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (isPlainObject(value)) {
      const out = {};
      Object.keys(value).sort().forEach((key) => { out[key] = sortDeep(value[key]); });
      return out;
    }
    return value;
  }

  // Impronta di un valore: stesso contenuto = stessa impronta, qualunque sia l'ordine delle chiavi
  function fingerprint(value) {
    return value === undefined ? "\u0000assente" : JSON.stringify(sortDeep(value));
  }

  // Una voce di stato è un testo: JSON quasi sempre, testo semplice ogni tanto (es. "dev")
  function parseEntry(text) {
    if (text === undefined) return { kind: "absent" };
    try {
      return { kind: "json", value: JSON.parse(text) };
    } catch (e) {
      return { kind: "raw", value: text };
    }
  }
  function entryFingerprint(entry) {
    if (entry.kind === "absent") return "A";
    if (entry.kind === "raw") return "R" + entry.value;
    return "J" + fingerprint(entry.value);
  }
  const sameEntry = (a, b) => entryFingerprint(a) === entryFingerprint(b);

  // Stesso contenuto (ordine delle chiavi a parte)?
  function sameText(a, b) {
    return sameEntry(parseEntry(a), parseEntry(b));
  }

  function sameState(a, b) {
    const ka = Object.keys(a || {}).sort();
    const kb = Object.keys(b || {}).sort();
    return ka.length === kb.length && ka.every((key, i) => key === kb[i] && sameText(a[key], b[key]));
  }

  // Unione di elenchi (a insieme): parte da quello di "remote", toglie quello che "local" ha tolto
  // rispetto a "base", aggiunge quello che "local" ha aggiunto.
  function mergeSet(base, local, remote) {
    const inBase = new Set(base.map(fingerprint));
    const inLocal = new Set(local.map(fingerprint));
    const used = new Set();
    const out = [];
    remote.forEach((item) => {
      const f = fingerprint(item);
      if (inBase.has(f) && !inLocal.has(f)) return; // tolto da local
      if (used.has(f)) return;
      used.add(f);
      out.push(item);
    });
    local.forEach((item) => {
      const f = fingerprint(item);
      if (inBase.has(f) || used.has(f)) return; // non è una novità di local, oppure c'è già
      used.add(f);
      out.push(item);
    });
    return out;
  }

  /**
   * @param {Object<string,string>} base   com'era l'ultima volta che questo browser ha sincronizzato ({} se non si sa)
   * @param {Object<string,string>} local  quello che c'è in questo browser
   * @param {Object<string,string>} remote quello che c'è sul disco
   * @param {{prefer?: "local"|"remote"}} [options] chi vince in caso di conflitto (default: local)
   * @returns {{merged: Object<string,string>, conflicts: string[]}}
   */
  function mergeState(base, local, remote, options) {
    const preferRemote = !!options && options.prefer === "remote";
    const conflicts = [];
    const B = base || {};
    const L = local || {};
    const R = remote || {};

    const pick = (l, r) => {
      return preferRemote ? r : l;
    };

    // Un valore dentro un dizionario (già interpretato, non testo)
    function mergeValue(b, l, r, where, asSets) {
      if (fingerprint(l) === fingerprint(r)) return l;
      if (fingerprint(l) === fingerprint(b)) return r;
      if (fingerprint(r) === fingerprint(b)) return l;
      if (asSets && Array.isArray(l) && Array.isArray(r) && (b === undefined || Array.isArray(b))) {
        return mergeSet(b || [], l, r);
      }
      conflicts.push(where);
      return pick(l, r);
    }

    function mergeEntry(key, bText, lText, rText) {
      const b = parseEntry(bText);
      const l = parseEntry(lText);
      const r = parseEntry(rText);
      if (sameEntry(l, r)) return lText !== undefined ? lText : rText;
      if (sameEntry(l, b)) return rText; // cambiata solo sul disco (o tolta là)
      if (sameEntry(r, b)) return lText; // cambiata solo qui (o tolta qui)

      // Cambiata da entrambe le parti in modo diverso.
      const asObject = (entry) => (entry.kind === "absent" ? {} : entry.kind === "json" && isPlainObject(entry.value) ? entry.value : null);
      const ob = asObject(b);
      const ol = asObject(l);
      const or = asObject(r);
      if (ob && ol && or) {
        const asSets = SET_CHILDREN.indexOf(key) >= 0;
        const subKeys = [];
        const seen = new Set();
        [or, ol, ob].forEach((object) => Object.keys(object).forEach((k) => { if (!seen.has(k)) { seen.add(k); subKeys.push(k); } }));
        const out = {};
        subKeys.forEach((k) => {
          const value = mergeValue(
            has(ob, k) ? ob[k] : undefined,
            has(ol, k) ? ol[k] : undefined,
            has(or, k) ? or[k] : undefined,
            key + " / " + k,
            asSets
          );
          if (value !== undefined) out[k] = value;
        });
        return JSON.stringify(out);
      }
      if (SET_WHOLE.indexOf(key) >= 0) {
        const asList = (entry) => (entry.kind === "absent" ? [] : entry.kind === "json" && Array.isArray(entry.value) ? entry.value : null);
        const lb = asList(b);
        const ll = asList(l);
        const lr = asList(r);
        if (lb && ll && lr) return JSON.stringify(mergeSet(lb, ll, lr));
      }
      conflicts.push(key);
      return pick(lText, rText);
    }

    const keys = [];
    const seen = new Set();
    [R, L, B].forEach((object) => Object.keys(object).forEach((k) => { if (!seen.has(k)) { seen.add(k); keys.push(k); } }));
    const merged = {};
    keys.forEach((key) => {
      const text = mergeEntry(key, has(B, key) ? B[key] : undefined, has(L, key) ? L[key] : undefined, has(R, key) ? R[key] : undefined);
      if (text !== undefined) merged[key] = text;
    });
    return { merged, conflicts };
  }

  return { mergeState, sameState, sameText };
});
