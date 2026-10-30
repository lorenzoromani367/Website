
let saveSuccessTimeout;
function showSaveSuccess(timestamp, target = "content.js") {
  let badge = document.getElementById("save-success-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "save-success-badge";
    badge.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #2b7a4b; color: white; padding: 8px 16px; border-radius: 4px; font-family: var(--mono); font-size: 12px; --sans-stroke: 0; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: opacity 0.3s; pointer-events: none;";
    document.body.appendChild(badge);
  }
  badge.textContent = `Salvato su ${target} alle ${timestamp}`;
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
    alarm.style.cssText = "position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(220, 38, 38, 0.95); color: white; display: flex; align-items: center; justify-content: center; font-family: sans-serif; font-size: 32px; font-weight: bold; --sans-stroke: 0; z-index: 100000; text-align: center; padding: 40px; box-sizing: border-box; cursor: pointer; flex-direction: column; white-space: pre-wrap;";
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

/* ==========================================================================
   DOVE VIVONO LE MODIFICHE ("siteStore")
   ==========================================================================
   Tutto quello che sistemi in modalità modifica (misure, posizioni, voci
   tolte dalla home, parole dell'archivio...) finiva SOLO nella memoria del
   browser in cui lavoravi: per questo il sito sembrava diverso in Vivaldi e
   negli altri browser. Adesso:
     - sul tuo computer (localhost) le modifiche restano nella memoria del
       browser come prima E vengono copiate su disco, in js/site-state.js
       (le scrive il server locale): basta poi pubblicare quel file;
     - per chi visita il sito pubblicato, js/site-state.js è l'unica fonte:
       non legge e non scrive nulla nella memoria del proprio browser.
   Ha le stesse funzioni di localStorage (getItem/setItem/removeItem).
   ========================================================================== */
// Chi può modificare: solo sul tuo computer (localhost, o un file aperto
// direttamente), mai chi visita il sito pubblicato. Con "?edit" in fondo
// all'indirizzo si forza la modalità modifica, con "?visitor" si vede il sito
// esattamente come lo vede un visitatore.
const IS_EDITOR = (() => {
  try {
    const params = new URLSearchParams(location.search);
    if (params.has("visitor")) return false;
    if (params.has("edit")) return true;
  } catch (e) {
    /* indirizzo non leggibile: si usa la regola qui sotto */
  }
  const host = location.hostname;
  return location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
})();
const IS_LOCAL_SERVER = location.protocol !== "file:" && ["localhost", "127.0.0.1", "[::1]", "::1"].includes(location.hostname);

// Il sito aperto dal tuo computer o dalla tua rete di casa (e non dal sito pubblicato).
const IS_AT_HOME = (() => {
  const host = String(location.hostname || "").toLowerCase();
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host) || host.endsWith(".local")
    || /^10\.\d+\.\d+\.\d+$/.test(host) || /^192\.168\.\d+\.\d+$/.test(host) || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
})();

// Contatore di fluidità (js/fps-meter.js): si accende e si spegne con Opzione+Maiusc+F, o aprendo il sito con "?fps" in fondo
// all'indirizzo. Il file si scarica solo in quel momento: per chi visita il sito normalmente non esiste. (Vivaldi nasconde ciò che sta
// dopo il "?" nella barra degli indirizzi, ed è per questo che c'è anche la scorciatoia.)
(() => {
  let loading = false;
  const toggle = (on) => {
    if (window.__fpsMeterToggle) { window.__fpsMeterToggle(on); return; }
    if (loading) return;
    loading = true;
    const script = document.createElement("script");
    script.src = `js/fps-meter.js?v=${encodeURIComponent(window.SITE_VERSION || "dev")}`;
    script.onload = () => { loading = false; if (window.__fpsMeterToggle) window.__fpsMeterToggle(true); };
    script.onerror = () => { loading = false; };
    document.head.appendChild(script);
  };
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === "KeyF") { e.preventDefault(); toggle(); }
  });
  try {
    if (new URLSearchParams(location.search).has("fps")) toggle(true);
  } catch (e) {
    /* indirizzo non leggibile: niente contatore all'apertura */
  }
})();

// Avviso in alto al centro, fatto con le sole funzioni del browser (non dipende dal resto del sito). Un clic lo chiude, o fa "onClick".
function showPageNotice(text, { onClick = null, seconds = 12 } = {}) {
  try {
    if (!document.body) return;
    const box = document.createElement("div");
    box.setAttribute("role", "status");
    box.textContent = text;
    box.style.cssText = "position: fixed; top: 12px; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: calc(100vw - 24px); box-sizing: border-box; z-index: 100001; background: #2b2b28; color: #edebe0; font-family: var(--mono); font-size: 13px; line-height: 1.45; --sans-stroke: 0; padding: 10px 18px; border-radius: 22px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); text-align: center; cursor: pointer; opacity: 0; transition: opacity 0.3s;";
    const close = () => { box.style.opacity = "0"; setTimeout(() => box.remove(), 400); };
    box.addEventListener("click", () => { if (onClick) onClick(); else close(); });
    document.body.appendChild(box);
    requestAnimationFrame(() => { box.style.opacity = "1"; });
    setTimeout(close, seconds * 1000);
  } catch (e) {
    /* l'avviso è solo un aiuto: se non si può mostrare, il sito funziona lo stesso */
  }
}

// Il sito del tuo computer aperto SENZA pulsanti di modifica (con "?visitor", o da un indirizzo di rete come quello per l'iPhone):
// il titolo della scheda comincia con "Vista visitatore" e, su un computer, per qualche secondo compare nella pagina un avviso con
// un clic per tornare alla modifica. Serve perché Vivaldi nella barra degli indirizzi nasconde tutto ciò che sta dopo il "?" (resta
// scritto solo "localhost:8000" anche con "?visitor") e può completare da solo "localhost:8000" con un "?visitor" usato in passato:
// ⇲ e l'icona del telefono sembrano spariti senza motivo. L'avviso non compare sul sito pubblicato (lì l'indirizzo non è del tuo
// computer né della tua rete di casa), né su un telefono, né quando il sito è aperto da un programma di prova (navigator.webdriver).
(() => {
  if (!IS_AT_HOME || IS_EDITOR) return;
  document.title = `Vista visitatore · ${document.title}`;
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent || "") || navigator.webdriver || window.top !== window) return;
  const onThisComputer = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(String(location.hostname || "").toLowerCase());
  showPageNotice("Vista visitatore: qui non ci sono i pulsanti di modifica. Clicca qui per modificare.", {
    onClick: () => {
      // Stessa pagina, senza "?visitor"; da un indirizzo di rete si va su localhost (la modifica funziona solo da lì).
      const base = onThisComputer ? location.origin : `http://localhost${location.port ? ":" + location.port : ""}`;
      location.href = base + location.pathname + location.hash;
    },
  });
})();

const siteStore = (() => {
  const SYNC_VERSION_KEY = "osd-synced-version"; // quale versione di site-state.js ha già visto questo browser
  const LEGACY_BACKUP_KEY = "osd-legacy-backup"; // copia di sicurezza delle voci di questo browser che in una fusione hanno perso
  const BASE_KEY = "osd-synced-base"; // com'era il file su disco l'ultima volta che questo browser lo ha letto/salvato (per la fusione)
  // Segni di "operazione già fatta" delle vecchie migrazioni (vedi più sotto): chi parte da zero non ha nulla da migrare.
  const MIGRATION_FLAGS = [
    "fixed_single_pages_v2",
    "core_archive_reset_v1",
    "site-words-promoted-v1",
    "site-words-promoted-v2",
    "site-caption-rebuild-v1",
    "site-zoom-rebuild-v2",
    "site-layout-scope-migration-v1",
    "zoom_reset_v3",
  ];
  // Le foto caricate con "+" sono enormi (dentro ci sono le foto vere): restano solo in questo browser.
  const NOT_SAVED_TO_DISK = ["site-uploaded-images-v1"];
  const isTracked = (key) => {
    if (NOT_SAVED_TO_DISK.includes(key) || key.startsWith("site-pos-v1-")) return false;
    return key.startsWith("site-") || MIGRATION_FLAGS.includes(key);
  };

  const disk = window.SITE_STATE;
  const diskReady = !!disk && typeof disk.version === "number" && !!disk.data && typeof disk.data === "object";
  // Su disco ogni voce è JSON leggibile; { __raw: "..." } per i rari testi che non lo sono.
  const decode = (value) => (value && typeof value === "object" && Object.keys(value).length === 1 && typeof value.__raw === "string" ? value.__raw : JSON.stringify(value));
  const diskStrings = () => {
    const out = {};
    if (diskReady) Object.keys(disk.data).forEach((key) => { out[key] = decode(disk.data[key]); });
    return out;
  };

  /* ---- chi visita il sito: sola lettura dal file su disco, tutto in memoria ---- */
  if (!IS_EDITOR) {
    const memory = new Map(Object.entries(diskStrings()));
    MIGRATION_FLAGS.forEach((key) => memory.set(key, "1"));
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => { memory.set(key, String(value)); },
      removeItem: (key) => { memory.delete(key); },
      keys: () => Array.from(memory.keys()),
      flushNow: () => Promise.resolve(true),
    };
  }

  /* ---- sul tuo computer: memoria del browser + copia su disco ---- */
  let storage = null;
  try {
    storage = window.localStorage;
    storage.getItem(SYNC_VERSION_KEY);
  } catch (e) {
    storage = null; // memoria del browser bloccata (es. finestra privata): si lavora comunque, ma nulla resta
  }
  const fallback = new Map();
  const backend = storage
    ? {
        get: (key) => storage.getItem(key),
        set: (key, value) => storage.setItem(key, value),
        del: (key) => storage.removeItem(key),
        keys: () => Array.from({ length: storage.length }, (_, i) => storage.key(i)),
      }
    : {
        get: (key) => (fallback.has(key) ? fallback.get(key) : null),
        set: (key, value) => { fallback.set(key, value); },
        del: (key) => { fallback.delete(key); },
        keys: () => Array.from(fallback.keys()),
      };

  // Il server locale fa il lavoro vero (fonde con quello che c'è su disco); basta che ci sia. Se il file
  // js/site-state.js non si legge (es. righe di conflitto lasciate da GitHub Desktop) il server lo ricrea da qui.
  const syncEnabled = IS_LOCAL_SERVER;
  const merger = window.SiteStateMerge || null; // js/state-merge.js: fusione a tre vie (vedi quel file)
  let dirty = false;
  let timer = null;
  let chain = Promise.resolve(true);
  let lastAlarm = 0;

  const trackedKeys = () => backend.keys().filter(isTracked);
  const collect = () => {
    const out = {};
    trackedKeys().sort().forEach((key) => {
      const value = backend.get(key);
      if (value !== null) out[key] = value;
    });
    return out;
  };
  const sortDeep = (value) => {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).sort().forEach((key) => { out[key] = sortDeep(value[key]); });
      return out;
    }
    return value;
  };
  const canonical = (text) => {
    try { return JSON.stringify(sortDeep(JSON.parse(text))); } catch (e) { return text; }
  };
  const sameState = (a, b) => {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((key, i) => key === kb[i] && canonical(a[key]) === canonical(b[key]));
  };

  // "Com'era il file su disco l'ultima volta che questo browser lo ha letto o salvato" (con la sua versione):
  // serve alla fusione per capire cosa è cambiato QUI e cosa è cambiato ALTROVE, voce per voce.
  const loadBase = () => {
    try {
      const saved = JSON.parse(backend.get(BASE_KEY));
      return saved && typeof saved === "object" && saved.state && typeof saved.state === "object" ? saved : null;
    } catch (e) {
      return null;
    }
  };
  const saveBase = (version, state) => {
    try { backend.set(BASE_KEY, JSON.stringify({ version, state })); } catch (e) { /* memoria piena: la volta dopo si salva senza base (non si toglie nulla) */ }
  };
  // Fa diventare lo stato di questo browser esattamente "next" (scrive solo ciò che cambia)
  const applyLocal = (next) => {
    const current = collect();
    Object.keys(current).forEach((key) => { if (!(key in next)) backend.del(key); });
    Object.keys(next).forEach((key) => { if (current[key] !== next[key]) backend.set(key, next[key]); });
  };

  function showSyncConflict() {
    let box = document.getElementById("sync-conflict-alarm");
    if (!box) {
      box = document.createElement("div");
      box.id = "sync-conflict-alarm";
      box.style.cssText = "position: fixed; left: 0; right: 0; bottom: 0; background: #a33; color: #fff; padding: 14px 20px; font-family: var(--mono); font-size: 13px; --sans-stroke: 0; z-index: 100000; text-align: center; cursor: pointer;";
      box.textContent = "Il server del sito è una versione vecchia (riavvialo con Start_Website.command): le ultime modifiche fatte qui NON sono state salvate. Clicca per ricaricare la pagina.";
      box.addEventListener("click", () => location.reload());
      document.body.appendChild(box);
    }
    box.style.display = "block";
  }

  // Dopo un salvataggio riuscito il server risponde con lo stato FUSO (il suo + le modifiche di tutti i browser):
  // lo si adotta, tenendo le modifiche fatte qui mentre la richiesta viaggiava.
  function adoptServerState(sent, data) {
    try {
      const serverState = data.state && typeof data.state === "object" ? data.state : sent; // un server vecchio non lo manda
      let next = collect();
      if (merger && data.state) {
        next = merger.mergeState(sent, next, serverState, { prefer: "local" }).merged;
        applyLocal(next);
      }
      saveBase(Number(data.version), serverState);
      backend.set(SYNC_VERSION_KEY, String(data.version));
      // Se qui è cambiato qualcosa mentre la richiesta viaggiava, va salvato anche quello
      if (merger && data.state && !sameState(next, serverState)) scheduleFlush();
    } catch (e) {
      /* la memoria del browser non risponde (es. piena): il file su disco è comunque salvato */
    }
  }

  async function sendToDisk() {
    if (!dirty) return true;
    dirty = false;
    const state = collect();
    try {
      const baseVersion = Number(backend.get(SYNC_VERSION_KEY)) || 0;
      // Al server si dice cosa è cambiato QUI rispetto all'ultima volta (solo le voci diverse, com'erano prima):
      // il resto è uguale a "state". Senza base (primo salvataggio dopo l'aggiornamento) il server non toglie nulla.
      const saved = loadBase();
      let changes;
      if (saved && saved.version === baseVersion) {
        changes = {};
        Object.keys(state).forEach((key) => {
          if (!(key in saved.state) || canonical(saved.state[key]) !== canonical(state[key])) changes[key] = key in saved.state ? saved.state[key] : null;
        });
        Object.keys(saved.state).forEach((key) => { if (!(key in state)) changes[key] = saved.state[key]; });
      }
      const body = JSON.stringify({ baseVersion, changes, state });
      const res = await fetch("/api/sync-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: body.length < 60000,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        adoptServerState(state, data);
        showSaveSuccess(data.timestamp, "disco");
        return true;
      }
      if (res.status === 409) {
        // Solo un server rimasto alla versione vecchia risponde così (il nuovo fonde, non rifiuta).
        showSyncConflict();
        return false;
      }
      throw new Error(data.error || `risposta ${res.status}`);
    } catch (e) {
      dirty = true;
      if (Date.now() - lastAlarm > 20000) {
        lastAlarm = Date.now();
        showSaveError();
      }
      return false;
    }
  }

  function flushNow() {
    clearTimeout(timer);
    chain = chain.then(sendToDisk);
    return chain;
  }
  function scheduleFlush() {
    if (!syncEnabled) return;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(flushNow, 600);
  }

  if (diskReady) {
    const diskState = diskStrings();
    const localKeys = trackedKeys();
    const rawSynced = backend.get(SYNC_VERSION_KEY);
    const synced = rawSynced === null ? null : Number(rawSynced);
    const adoptDisk = () => {
      localKeys.forEach((key) => backend.del(key));
      Object.keys(diskState).forEach((key) => backend.set(key, diskState[key]));
      backend.set(SYNC_VERSION_KEY, String(disk.version));
      saveBase(disk.version, diskState);
    };

    if (!localKeys.length) {
      // Browser nuovo (o memoria svuotata): parte da quello che c'è su disco.
      adoptDisk();
      MIGRATION_FLAGS.forEach((key) => { if (backend.get(key) === null) backend.set(key, "1"); });
    } else if (synced !== null && disk.version < synced) {
      // Il file su disco è più VECCHIO di quello che questo browser aveva già salvato (es. in GitHub Desktop è stato rimesso
      // all'ultima versione pubblicata): il lavoro più recente è qui, si riscrive il file da questo browser.
      if (syncEnabled) dirty = true;
    } else if (!merger) {
      // Manca js/state-merge.js: senza la fusione non si decide nulla al posto tuo. Si lavora solo se i due coincidono.
      if (synced === disk.version && sameState(collect(), diskState)) saveBase(disk.version, diskState);
      else if (synced === disk.version && syncEnabled) dirty = true;
    } else {
      // Caso normale. Si fonde lo stato di questo browser con quello su disco; non si butta via niente.
      //  - base = com'era il file quando questo browser lo ha salvato/letto l'ultima volta. Se non c'è (primo avvio dopo
      //    l'aggiornamento) e il file non è cambiato da allora, la base è il file stesso; se non si sa, nulla viene tolto.
      //  - Se una voce è cambiata sia qui sia sul disco, vince il disco e quella di questo browser resta nella copia di
      //    sicurezza (osd-legacy-backup, recuperabile con "?ripristina").
      const saved = loadBase();
      let baseState = saved && synced !== null && saved.version === synced ? saved.state : null;
      if (!baseState && synced !== null && synced === disk.version) baseState = diskState;
      const before = collect();
      const { merged, conflicts } = merger.mergeState(baseState || {}, before, diskState, { prefer: "remote" });
      if (conflicts.length) {
        try { backend.set(LEGACY_BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state: before })); } catch (e) { /* copia di sicurezza non possibile */ }
      }
      applyLocal(merged);
      backend.set(SYNC_VERSION_KEY, String(disk.version));
      saveBase(disk.version, diskState);
      if (syncEnabled && !sameState(merged, diskState)) dirty = true; // qui c'è qualcosa che sul disco non c'è ancora
    }
    if (syncEnabled && dirty) scheduleFlush();
  }

  // Le voci che in una fusione hanno perso (cambiate sia qui sia sul disco) restano in osd-legacy-backup:
  // aprendo il sito con "?ripristina" in fondo all'indirizzo si rimettono, SOMMANDOLE a quelle di adesso (non si toglie nulla).
  try {
    if (new URLSearchParams(location.search).has("ripristina")) {
      const raw = backend.get(LEGACY_BACKUP_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (!saved || !saved.state) {
        alert("In questo browser non c'è nessuna copia di modifiche da ripristinare.");
      } else if (confirm("Rimettere le modifiche che questo browser aveva prima?\nSi aggiungono a quelle attuali del progetto (se una voce c'è in tutte e due, vale quella ripristinata).")) {
        const current = collect();
        const restored = merger ? merger.mergeState({}, saved.state, current, { prefer: "local" }).merged : Object.assign({}, current, saved.state);
        applyLocal(restored);
        if (syncEnabled) { dirty = true; scheduleFlush(); }
        history.replaceState(null, "", location.pathname + location.hash);
      }
    }
  } catch (e) {
    /* indirizzo o memoria non leggibili: niente da ripristinare */
  }

  if (syncEnabled) {
    // Se si chiude la scheda subito dopo una modifica, la copia su disco parte comunque.
    window.addEventListener("pagehide", () => { if (dirty) flushNow(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && dirty) flushNow(); });
  }

  return {
    getItem: (key) => backend.get(key),
    setItem: (key, value) => {
      backend.set(key, String(value));
      if (isTracked(key)) scheduleFlush();
    },
    removeItem: (key) => {
      backend.del(key);
      if (isTracked(key)) scheduleFlush();
    },
    keys: () => backend.keys(),
    flushNow,
  };
})();

// TEMPORARY CLEANUP FOR SINGLE PAGES
(function() {
  if (!siteStore.getItem('fixed_single_pages_v2')) {
    siteStore.setItem('fixed_single_pages_v2', 'true');
    const posObj = JSON.parse(siteStore.getItem('site-position-overrides-v1:d') || '{}');
    const sizeObj = JSON.parse(siteStore.getItem('site-size-overrides-v1:d') || '{}');
    
    const singleSlugs = ['beach', 'hair', 'eating', 'toy', 'whitening', 'bar', 'fluoxetine', 'compression', 'sofa', 'Pile'];
    
    singleSlugs.forEach(slug => {
      delete posObj[`project.${slug}.singleImagePos.0`];
      delete posObj[`project.${slug}.imagePos.0`];
      delete posObj[`project.${slug}.captionPos.0`];
      delete sizeObj[`project.${slug}.image.0`];
      delete sizeObj[`project.${slug}.captionSize.0`];
    });
    
    siteStore.setItem('site-position-overrides-v1:d', JSON.stringify(posObj));
    siteStore.setItem('site-size-overrides-v1:d', JSON.stringify(sizeObj));
    
    const posObjM = JSON.parse(siteStore.getItem('site-position-overrides-v1:m') || '{}');
    const sizeObjM = JSON.parse(siteStore.getItem('site-size-overrides-v1:m') || '{}');
    
    singleSlugs.forEach(slug => {
      delete posObjM[`project.${slug}.singleImagePos.0`];
      delete posObjM[`project.${slug}.imagePos.0`];
      delete posObjM[`project.${slug}.captionPos.0`];
      delete sizeObjM[`project.${slug}.image.0`];
      delete sizeObjM[`project.${slug}.captionSize.0`];
    });
    
    siteStore.setItem('site-position-overrides-v1:m', JSON.stringify(posObjM));
    siteStore.setItem('site-size-overrides-v1:m', JSON.stringify(sizeObjM));
    
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
// Spazio minimo (px) tra la FINE del testo scorrevole e il suo ricominciare: è quello del testo "recognition".
// Con meno spazio, appena si apre la pagina si vedeva la coda del testo sopra il suo inizio, come se partisse
// da un punto a caso (succedeva in "homes", "stills"...).
const MARQUEE_MIN_GAP = 129;
const GRID_SIZE = 20;          // px: passo della griglia di allineamento in modalità modifica (resize/spostamenti si agganciano a questo)
const MOBILE_BREAKPOINT = 700; // px: stessa soglia del media query in style.css — sopra/sotto cambia lo "scope" di posizioni/dimensioni salvate
// Le foto vere (src in content.js) restano in cache nel browser di chi
// visita il sito anche a lungo, a differenza di css/js che hanno già il
// loro "?v=" in index.html: senza questo, sostituire o ripristinare un
// file con lo STESSO NOME (es. dopo che una foto era sparita dal
// repository) può continuare a mostrare la versione vecchia — o un 404
// già in cache — a chi l'ha già vista prima. Bump ad ogni foto
// aggiunta/sostituita/ripristinata in content.js (vedi resolveImageSrc).
// Sul sito pubblicato la versione è quella della pubblicazione (la scrive
// il processo di pubblicazione dentro index.html): le foto restano in memoria
// nel browser del visitatore finché non pubblichi qualcosa di nuovo, invece di
// essere riscaricate da zero ad ogni ricarica (un primo caricamento "a freddo"
// era proprio quello in cui la pagina sembrava rotta).
const IS_PUBLISHED_BUILD = !!window.SITE_VERSION && window.SITE_VERSION !== "dev";
let IMAGE_VERSION = IS_PUBLISHED_BUILD ? String(window.SITE_VERSION) : sessionStorage.getItem("APP_IMAGE_VERSION") || "3";
// Sul tuo computer, se ricarichi la pagina (es. F5 o hard refresh), generiamo una
// nuova versione per forzare il browser a scaricare le immagini nuove/modificate.
if (!IS_PUBLISHED_BUILD && performance.navigation && performance.navigation.type === 1) { // 1 = TYPE_RELOAD
  IMAGE_VERSION = Date.now().toString();
  sessionStorage.setItem("APP_IMAGE_VERSION", IMAGE_VERSION);
}

// Reset the core archive offsets once to ensure it perfectly aligns with boundaries
if (!siteStore.getItem("core_archive_reset_v1")) {
  siteStore.removeItem("archive.topbarTitlePos");
  siteStore.removeItem("archive.topbarIndexPos");
  siteStore.removeItem("archive.bottomIndexPos");
  siteStore.setItem("core_archive_reset_v1", "true");
}

// Cartelle delle foto rinominate (vedi projectImageFolder): [cartella di adesso, cartella che ha il nome interno del progetto],
// tutte e due "images/<nome>/" in minuscolo. Servono a stablePhotoPath.
const PHOTO_FOLDER_ALIASES = [];

// La cartella delle foto di un progetto è images/<slug>/ (lo slug è il nome interno del progetto, che non cambia quando lo si rinomina).
// Se però esiste una cartella che porta il NOME che il progetto ha adesso ("images/collusion/" per "Collusion") e contiene delle foto,
// è quella — così rinominare un progetto e la sua cartella funziona (prima la galleria restava vuota: il sito toglieva le foto che non
// trovava più nella cartella col vecchio nome). Una cartella che è lo slug di un altro progetto non vale mai.
function projectImageFolder(project) {
  const slug = String(project.slug).toLowerCase();
  const files = window.DYNAMIC_IMAGES;
  if (!Array.isArray(files)) return slug;
  const hasPhotos = (folder) => files.some((path) => path.toLowerCase().startsWith(`images/${folder}/`));
  const name = String(project.name || "").trim().toLowerCase();
  for (const candidate of [name, name.replace(/\s+/g, "-"), name.replace(/\s+/g, "_")]) {
    if (!candidate || candidate === slug || /[\\/]/.test(candidate)) continue;
    if (PROJECTS.some((other) => other !== project && String(other.slug).toLowerCase() === candidate)) continue;
    if (hasPhotos(candidate)) return candidate;
  }
  return slug;
}

// L'IDENTITÀ di una foto nello stato salvato (didascalie, misure dell'ingrandimento, foto tolte, didascalie ritrovate) è il suo
// percorso con la cartella che ha il nome interno del progetto: se la cartella viene rinominata ("images/boudaries/" →
// "images/collusion/") tutto quello che è già salvato continua a valere, e quello che si salva da adesso è coerente con il resto.
function stablePhotoPath(path) {
  const text = String(path);
  const lower = text.toLowerCase();
  for (const [folder, legacy] of PHOTO_FOLDER_ALIASES) {
    if (lower.startsWith(folder)) return legacy + text.slice(folder.length);
  }
  return text;
}

// Assorbe automaticamente le modifiche alla cartella "images" usando l'elenco
// generato dal watcher (images-data.js), mantenendo le impostazioni salvate in content.js.
(function mergeDynamicImages() {
  if (typeof window.DYNAMIC_IMAGES === "undefined" || typeof PROJECTS === "undefined" || typeof ARCHIVE === "undefined") return;

  const mergeProjectImages = (project, folderSlug, ownSlug) => {
    const folderPrefix = `images/${folderSlug.toLowerCase()}/`;
    const projectFiles = window.DYNAMIC_IMAGES.filter(path => path.toLowerCase().startsWith(folderPrefix));
    // Cartella rinominata: content.js può ricordare ancora le foto nella cartella di prima (images/<slug>/)
    const previousPrefix = ownSlug && ownSlug.toLowerCase() !== folderSlug.toLowerCase() ? `images/${ownSlug.toLowerCase()}/` : null;
    if (previousPrefix) PHOTO_FOLDER_ALIASES.push([folderPrefix, previousPrefix]);

    if (!project.images) project.images = [];
    if (previousPrefix) {
      // quelle foto passano alla cartella nuova (stesso nome di file); se il file non c'è più, resta com'è e qui sotto viene tolta
      project.images.forEach(img => {
        if (!img.src || !img.src.toLowerCase().startsWith(previousPrefix)) return;
        const fileName = img.src.slice(previousPrefix.length).toLowerCase();
        const moved = projectFiles.find(pf => pf.slice(folderPrefix.length).toLowerCase() === fileName);
        if (moved) img.src = moved;
      });
    }

    // Rimuove i file fisicamente cancellati, ignorando i placeholder (src == null)
    // o i file che puntano ad altre cartelle
    project.images = project.images.filter(img => {
      if (!img.src) return true;
      const lowerSrc = img.src.toLowerCase();
      if (!lowerSrc.startsWith(folderPrefix) && !(previousPrefix && lowerSrc.startsWith(previousPrefix))) return true;
      return projectFiles.some(pf => pf.toLowerCase() === lowerSrc);
    });

    // Su Mac "rock.jpg" e "rock.JPG" sono lo stesso file, sul sito pubblicato (e su Windows/Linux
    // server) no: se content.js scrive il nome con maiuscole/minuscole diverse dal file vero,
    // si usa il nome vero — altrimenti la foto spariva (404) solo fuori dal tuo computer.
    project.images.forEach(img => {
      if (!img.src) return;
      const realName = projectFiles.find(pf => pf.toLowerCase() === img.src.toLowerCase());
      if (realName && realName !== img.src) img.src = realName;
    });

    // Aggiunge i nuovi file trovati nella cartella
    projectFiles.forEach(file => {
      const exists = project.images.find(img => img.src && img.src.toLowerCase() === file.toLowerCase());
      if (!exists) {
        project.images.push({ caption: "", src: file });
      }
    });
  };

  PROJECTS.forEach(project => mergeProjectImages(project, projectImageFolder(project), project.slug));
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

// Il testo di un progetto sta in testi/<nome>.txt. Di solito <nome> è lo "slug" del progetto (il suo indirizzo interno, che NON cambia
// quando lo si rinomina: "sospension" per "Suspension"). Se però c'è un file che porta il NOME che il progetto ha adesso
// ("collusion.txt" per "Collusion"), vale quello, anche se esiste ancora il vecchio file col vecchio indirizzo: così rinominare un
// progetto e scrivere il testo in un file col nuovo nome funziona (prima il testo non compariva più: si cercava solo lo slug).
// Restituisce il nome del file senza ".txt" (lo slug, se non c'è nessun file o se l'elenco dei testi non c'è).
function projectTextFile(project) {
  if (!project) return "";
  const files = Array.isArray(window.DYNAMIC_TEXTS) ? window.DYNAMIC_TEXTS : null;
  if (!files) return project.slug;
  const byLowerCase = new Map(files.map((file) => [file.toLowerCase(), file]));
  const name = String(project.name || "").trim().toLowerCase();
  for (const candidate of [name, name.replace(/\s+/g, "-"), name.replace(/\s+/g, "_"), project.slug]) {
    const real = candidate && byLowerCase.get(`${candidate}.txt`);
    if (real) return real.replace(/\.txt$/i, "");
  }
  return project.slug;
}

function isEditMode() {
  return document.body.classList.contains("edit-mode");
}

// Sugli schermi tattili, dopo ogni tocco il browser inventa anche i movimenti del "mouse" (mouseenter, click...) e il
// "mouseleave" non arriva finché non si tocca un altro punto: usare "mouseenter" per fermare la galleria o il testo
// scorrevole li lasciava fermi per sempre (dopo un tocco sul margine della galleria, o sul testo). Si ricorda l'ultimo
// tocco: un "mouseenter" arrivato subito dopo non è un vero mouse e non deve fermare nulla.
let lastTouchAt = -Infinity;
function noteTouch() { lastTouchAt = performance.now(); }
document.addEventListener("touchstart", noteTouch, { passive: true, capture: true });
document.addEventListener("touchend", noteTouch, { passive: true, capture: true });
function isTouchEcho() { return performance.now() - lastTouchAt < 1000; }

// Chi muove la pagina? Serve alla barra ferma (startBarHold, in renderGallery): non deve mai portare via la pagina a chi la
// sta muovendo (leggere il testo in alto, guardare altro). Si ricorda quando l'ha mossa per ultimo l'utente (rotella, tasti, tocco,
// barra di scorrimento) e chi la sta portando in fondo si ferma appena l'utente la tocca. I movimenti fatti dal sito stesso (cambio
// pagina, inquadratura) si segnano con noteProgrammaticScroll(): i loro eventi "scroll" non passano per movimenti dell'utente.
let lastUserScrollAt = -Infinity; // l'ultima volta che l'utente ha mosso la pagina (input o scroll che il sito non ha chiesto)
let lastUserInputAt = -Infinity; // l'ultima volta che ha usato rotella, tasti di scorrimento o dito: il gesto in sé, non il suo strascico
let lastProgrammaticScrollAt = performance.now() + 1500; // (all'apertura il browser può rimettere la pagina dov'era: non è l'utente)
function noteProgrammaticScroll(extraMs = 0) { lastProgrammaticScrollAt = performance.now() + extraMs; }
function noteUserScroll() { lastUserScrollAt = performance.now(); }
(() => {
  const SCROLL_KEYS = new Set([" ", "Spacebar", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);
  const noteUserInput = () => { lastUserInputAt = performance.now(); noteUserScroll(); };
  window.addEventListener("wheel", noteUserInput, { passive: true, capture: true });
  window.addEventListener("touchmove", noteUserInput, { passive: true, capture: true });
  window.addEventListener("keydown", (e) => {
    if (!SCROLL_KEYS.has(e.key)) return;
    const target = e.target;
    if (target && target.closest && target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) return; // scrive, non scorre
    noteUserInput();
  }, true);
  // Trascinare la barra di scorrimento non manda né rotella né tasti: si riconosce da uno 'scroll' che il sito non ha chiesto.
  // (L'evento arriva al fotogramma dopo quello in cui il sito ha spostato la pagina: se in mezzo c'è un blocco lungo, anche di mezzo
  // secondo, deve ancora contare come del sito. Mentre il sito la sta spostando, chi trascina la barra lo vede comunque
  // startBarHold, che a ogni fotogramma controlla che la pagina sia dov'era stata messa.)
  window.addEventListener("scroll", () => {
    if (performance.now() - lastProgrammaticScrollAt > 600) noteUserScroll();
  }, { passive: true });
  // Pulsante del mouse premuto (si trascina una maniglia, un testo): in quel momento la pagina non si sposta da sola.
  window.addEventListener("pointerdown", () => { pointerHeld = true; pointerHeldAt = performance.now(); }, { capture: true, passive: true });
  ["pointerup", "pointercancel", "dragend", "blur"].forEach((type) => window.addEventListener(type, () => { pointerHeld = false; }, { capture: true, passive: true }));
  window.addEventListener("pointermove", (e) => { if (pointerHeld && e.buttons === 0) pointerHeld = false; }, { capture: true, passive: true });
})();
let pointerHeld = false;
let pointerHeldAt = -Infinity;
function isPointerHeld() { return pointerHeld && performance.now() - pointerHeldAt < 20000; } // (dopo 20 s si considera rilasciato: non resta mai bloccato)

// Registro degli ultimi scorrimenti della galleria: dice se la barra è stata tenuta ferma e, se no, perché. Lo legge il contatore di fluidità
// (js/fps-meter.js, "Copia rapporto"): serve a capire cosa succede sul computer vero, dove non posso guardare.
const framingLog = (window.__framingLog = []);
function logFraming(info) {
  framingLog.push({ at: Date.now(), hash: location.hash, ...info });
  if (framingLog.length > 12) framingLog.shift();
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

// Larghezza utile per le foto nel foglio da computer (740px di foglio meno 40px di margine per lato): serve a portare su
// telefono, in scala, la disposizione scelta per il computer.
const DESKTOP_PHOTO_AREA = 660;

// Una foto che su computer hai messo a sinistra, vicina al titolo e con una larghezza tua (content.js: align "left", width,
// offset: sono le pagine senza testo, come Beach o Tower) e che non ha misure apposta per il telefono ("mobile: {…}") prende
// sul telefono LA STESSA disposizione in scala: a sinistra, con la stessa parte di foglio occupata e, in proporzione, la stessa
// distanza dal titolo. Prima su telefono occupava tutta la larghezza e stava circa il doppio più in basso. Le misure e le
// posizioni trascinate a mano sul telefono (si salvano a parte, chiavi ":m") valgono sempre più di questo. Su computer: null.
function phoneLayoutFromDesktop(image) {
  if (!isMobileViewport() || !image || image.align !== "left") return null;
  const k = Math.max(0.3, Math.min(1, (window.innerWidth - 40) / DESKTOP_PHOTO_AREA)); // foglio del telefono / foglio del computer
  const widthPx = /px\s*$/i.test(String(image.width || "")) ? parseFloat(image.width) : NaN;
  const offset = image.offset && typeof image.offset === "object" ? image.offset : null;
  return {
    width: widthPx > 0 ? `${Math.round(widthPx * k * 100) / 100}px` : undefined,
    offset: offset ? { x: Math.round((offset.x || 0) * k), y: Math.round((offset.y || 0) * k) } : undefined,
  };
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
    return JSON.parse(siteStore.getItem(SIZE_STORE_KEY + layoutScopeSuffix())) || {};
  } catch (e) {
    return {};
  }
}

function saveSizeOverride(key, size) {
  const all = loadSizeOverrides();
  all[key] = size;
  try {
    siteStore.setItem(SIZE_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la dimensione resta comunque applicata per questa sessione */
  }
}

function clearSizeOverride(key) {
  const all = loadSizeOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    siteStore.setItem(SIZE_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
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
    return JSON.parse(siteStore.getItem(ORDER_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveOrderOverride(key, order) {
  const all = loadOrderOverrides();
  all[key] = order;
  try {
    siteStore.setItem(ORDER_STORE_KEY, JSON.stringify(all));
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
    return JSON.parse(siteStore.getItem(HOME_HIDDEN_STORE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function hideHomeRow(tag) {
  const hidden = loadHiddenHomeRows();
  if (!hidden.includes(tag)) hidden.push(tag);
  try {
    siteStore.setItem(HOME_HIDDEN_STORE_KEY, JSON.stringify(hidden));
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
  // Le righe tolte con "×" non compaiono più: né in home né nelle frecce avanti/indietro tra progetti.
  const hidden = new Set(loadHiddenHomeRows());
  return rows.filter((tag) => !hidden.has(tag));
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
    return JSON.parse(siteStore.getItem(REMOVED_STORE_KEY)) || {};
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
  return image.src ? `src:${stablePhotoPath(image.src)}` : `orig:${origIndex}`;
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
    siteStore.setItem(REMOVED_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la rimozione resta comunque applicata per questa sessione */
  }
}

const EXTRA_IMAGES_STORE_KEY = "site-extra-images-v1";
const LINK_STORE_KEY = "site-links-v1";

function loadExtraImagesOverrides() {
  try {
    return JSON.parse(siteStore.getItem(EXTRA_IMAGES_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function loadLinkOverrides() {
  try {
    return JSON.parse(siteStore.getItem(LINK_STORE_KEY)) || {};
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
    siteStore.setItem(LINK_STORE_KEY, JSON.stringify(all));
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
    siteStore.setItem(EXTRA_IMAGES_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la foto aggiunta resta comunque per questa sessione */
  }
  return id;
}

function removeExtraImage(key, id) {
  const all = loadExtraImagesOverrides();
  all[key] = (all[key] || []).filter((img) => img.id !== id);
  try {
    siteStore.setItem(EXTRA_IMAGES_STORE_KEY, JSON.stringify(all));
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
    return JSON.parse(siteStore.getItem(UPLOADED_IMAGE_STORE_KEY)) || {};
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
    siteStore.setItem(UPLOADED_IMAGE_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    alert("La foto è troppo grande (o lo spazio del browser è pieno): riprova con un file più leggero.");
  }
}

function clearUploadedImage(key, photoId) {
  const all = loadUploadedImages();
  if (!all[key] || !(photoId in all[key])) return;
  delete all[key][photoId];
  try {
    siteStore.setItem(UPLOADED_IMAGE_STORE_KEY, JSON.stringify(all));
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
    return JSON.parse(siteStore.getItem(EXTRA_TEXT_STORE_KEY)) || {};
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
    siteStore.setItem(EXTRA_TEXT_STORE_KEY, JSON.stringify(all));
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
    siteStore.setItem(EXTRA_TEXT_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: il testo resta comunque applicato per questa sessione */
  }
}

function removeExtraText(key, id) {
  const all = loadExtraTextOverrides();
  all[key] = (all[key] || []).filter((w) => w.id !== id);
  try {
    siteStore.setItem(EXTRA_TEXT_STORE_KEY, JSON.stringify(all));
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
    if (siteStore.getItem(FLAG_KEY)) return;
    const promotedNames = new Set(["bar", "fluoxetine", "licking", "moon", "plastic", "tower", "compression"]);
    extraTextFor("home").forEach((word) => {
      if (promotedNames.has(word.text.trim().toLowerCase())) removeExtraText("home", word.id);
    });
    siteStore.setItem(FLAG_KEY, "1");
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
    if (siteStore.getItem(FLAG_KEY)) return;
    const promotedNames = new Set(["beach", "solo"]);
    extraTextFor("home").forEach((word) => {
      if (promotedNames.has(word.text.trim().toLowerCase())) removeExtraText("home", word.id);
    });
    siteStore.setItem(FLAG_KEY, "1");
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
    return JSON.parse(siteStore.getItem(POSITION_STORE_KEY + layoutScopeSuffix())) || {};
  } catch (e) {
    return {};
  }
}

function savePositionOverride(key, pos) {
  const all = loadPositionOverrides();
  all[key] = pos;
  try {
    siteStore.setItem(POSITION_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: la posizione resta comunque applicata per questa sessione */
  }
}

function clearPositionOverride(key) {
  const all = loadPositionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    siteStore.setItem(POSITION_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
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
    return JSON.parse(siteStore.getItem(CAPTION_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCaptionOverride(key, text) {
  const all = loadCaptionOverrides();
  all[key] = text;
  try {
    siteStore.setItem(CAPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: il testo resta comunque applicato per questa sessione */
  }
}

function clearCaptionOverride(key) {
  const all = loadCaptionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    siteStore.setItem(CAPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile */
  }
}

/* -------------------------------------------------------------------------
   Le didascalie sono legate alla FOTO (al suo file), non alla sua posizione
   nell'elenco. Prima la chiave era il numero d'ordine ("...captionText.3"):
   bastava aggiungere, togliere o rinominare un file nella cartella e tutti i
   numeri dopo scorrevano, così una didascalia finiva sotto la foto sbagliata o
   spariva. Ora la chiave è "…captionText.@<cartella>/<file>" (tutto minuscolo).
   Le foto aggiunte con "+" (id "new-…") e le parole del Core Archive (uid)
   avevano già un id proprio e non cambiano.

   Cosa si scrive sotto una foto, in quest'ordine:
     1. quello che hai scritto tu nel browser (anche "vuoto" = nessuna didascalia);
     2. una didascalia ritrovata o corretta (js/recovered-captions.js);
     3. la "caption" in content.js;
     4. il NOME DEL FILE, se somiglia a un titolo ("upside down.JPG" → "upside down",
        "3 field.jpg" → "field"; non "stills-13.jpg" né "IMG_0412.JPG").
   ------------------------------------------------------------------------- */
function captionPhotoId(src) {
  // (con stablePhotoPath: se la cartella del progetto è stata rinominata, l'id resta quello di prima e le didascalie salvate valgono ancora)
  const path = stablePhotoPath(String(src)).replace(/^images\//i, "");
  return "@" + (path.normalize ? path.normalize("NFC") : path).toLowerCase();
}

// L'id con cui una foto compare nelle chiavi delle didascalie: il suo file, quando ce l'ha;
// altrimenti (segnaposto senza foto, foto aggiunte con "+") il suo numero/id di sempre.
function captionIdFor(image, fallbackId) {
  return image && image.src ? captionPhotoId(image.src) : String(fallbackId);
}

// Espressioni per leggere i nomi dei file (lettere di qualsiasi lingua). Costruite qui, non scritte "a mano" nel codice, così
// un browser molto vecchio che non le conosce ripiega su una versione più semplice invece di bloccare tutto il sito.
const FILE_NAME_RULES = (() => {
  let letter = "\\p{L}";
  let flags = "u";
  try {
    new RegExp(letter, flags);
  } catch (e) {
    letter = "[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]";
    flags = "";
  }
  return {
    hasLetter: new RegExp(letter, flags),
    leadingNumber: new RegExp("^\\d{1,3}(?:\\s*[-.):]\\s*|\\s+)(?=" + letter + ")", flags),
    hyphenatedWords: new RegExp("^" + letter + "+(?:-" + letter + "+)+$", flags),
  };
})();

// Il nome del file come didascalia, solo se somiglia a un titolo scritto da una persona.
function captionFromFileName(src) {
  if (!src) return "";
  let name = String(src).split("/").pop().replace(/\.[a-z0-9]{2,5}$/i, "");
  if (name.normalize) name = name.normalize("NFC");
  name = name.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  // duplicati del Finder: "wire copia", "wire copy 2", "wire (1)"
  name = name.replace(/\s*(\(\d+\)|\bcop(?:y|ia)\b(?:\s*\d+)?)\s*$/i, "").trim();
  // numero d'ordine davanti: "1 wire", "02 - wire", "3. wire", "4-wire"
  name = name.replace(FILE_NAME_RULES.leadingNumber, "").trim();
  if (!FILE_NAME_RULES.hasLetter.test(name)) return ""; // senza lettere
  if (/\d{4,}/.test(name)) return ""; // numeri lunghi: nome automatico di una macchina fotografica o una data
  if (/[-_ ]\d+$/.test(name)) return ""; // parola + numero: "stills-13", "lines-1-8", "paris 2"
  if (/^(img|dsc|dscn|dscf|dsf|pxl|mvimg|screenshot|schermata|image|immagine|foto|photo|pic|scan|senza titolo|untitled)\b/i.test(name)) return "";
  // "disassembled-body" → "disassembled body" (parole unite da trattini, senza spazi)
  if (!/\s/.test(name) && FILE_NAME_RULES.hyphenatedWords.test(name)) name = name.replace(/-/g, " ");
  return name;
}

// Cosa si scrive sotto la foto se nessuno ha scritto niente a mano (punti 2, 3 e 4 dell'elenco sopra)
function defaultCaptionFor(image) {
  if (!image) return "";
  const recovered = image.src && window.RECOVERED_CAPTIONS && window.RECOVERED_CAPTIONS[captionPhotoId(image.src)];
  if (recovered) return recovered;
  if (image.caption) return image.caption;
  return image.src ? captionFromFileName(image.src) : "";
}

// Una tantum e ogni volta che serve: le didascalie scritte con la vecchia chiave (numero d'ordine) passano alla foto
// che oggi sta in quel posto. Se la foto ha già una didascalia sua, resta quella. Quelle che non si possono legare a
// una foto (posizione che non esiste più, segnaposto) restano dove sono, intatte.
(function moveCaptionsToPhotos() {
  try {
    const all = loadCaptionOverrides();
    let changed = false;
    const lists = [];
    if (typeof PROJECTS !== "undefined") PROJECTS.forEach((project) => lists.push([`project.${project.slug}`, project.images || []]));
    if (typeof ARCHIVE !== "undefined") lists.push(["archive", ARCHIVE.images || []]);
    lists.forEach(([galleryKey, images]) => {
      const prefix = `${galleryKey}.captionText.`;
      Object.keys(all).forEach((key) => {
        if (!key.startsWith(prefix)) return;
        const id = key.slice(prefix.length);
        if (!/^\d+$/.test(id)) return; // già legata a una foto, o foto aggiunta con "+"
        const image = images[Number(id)];
        if (!image || !image.src) return;
        const newKey = prefix + captionPhotoId(image.src);
        if (!(newKey in all)) all[newKey] = all[key];
        delete all[key];
        changed = true;
      });
    });
    if (changed) siteStore.setItem(CAPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* storage non disponibile: le didascalie restano come sono */
  }
})();

const DESCRIPTION_STORE_KEY = "site-description-overrides-v1";

function loadDescriptionOverrides() {
  try {
    return JSON.parse(siteStore.getItem(DESCRIPTION_STORE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveDescriptionOverride(key, textArray) {
  const all = loadDescriptionOverrides();
  all[key] = textArray;
  try {
    siteStore.setItem(DESCRIPTION_STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* ignore */
  }
}

function clearDescriptionOverride(key) {
  const all = loadDescriptionOverrides();
  if (!(key in all)) return;
  delete all[key];
  try {
    siteStore.setItem(DESCRIPTION_STORE_KEY, JSON.stringify(all));
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
    if (siteStore.getItem(FLAG_KEY)) return;
    // Diretto sulla chiave desktop (":d"), non su loadPositionOverrides():
    // questa migrazione precede lo "scope" mobile/desktop di
    // layoutScopeSuffix() — tutti i dati vecchi da ripulire sono per
    // forza desktop (il mobile è uno store nuovo, nato già vuoto).
    const rawKey = POSITION_STORE_KEY + ":d";
    const all = JSON.parse(siteStore.getItem(rawKey)) || {};
    let changed = false;
    Object.keys(all).forEach((key) => {
      if (/\.captionPos\.\d+$/.test(key) || /\.caption\.\d+$/.test(key)) {
        delete all[key];
        changed = true;
      }
    });
    if (changed) siteStore.setItem(rawKey, JSON.stringify(all));
    siteStore.setItem(FLAG_KEY, "1");
  } catch (e) {
    /* storage non disponibile: non c'è nulla da migrare */
  }
})();

(function resetStaleZoomPositionsOnce() {
  const FLAG_KEY = "site-zoom-rebuild-v2";
  try {
    if (siteStore.getItem(FLAG_KEY)) return;
    
    // Clear size overrides for zoom
    const rawSizeKey = SIZE_STORE_KEY + ":d";
    let sizeAll = JSON.parse(siteStore.getItem(rawSizeKey)) || {};
    let sizeChanged = false;
    Object.keys(sizeAll).forEach((key) => {
      if (key.endsWith(".descriptionZoomSize")) {
        delete sizeAll[key];
        sizeChanged = true;
      }
    });
    if (sizeChanged) siteStore.setItem(rawSizeKey, JSON.stringify(sizeAll));

    // Clear position overrides for zoom
    const rawPosKey = POSITION_STORE_KEY + ":d";
    let posAll = JSON.parse(siteStore.getItem(rawPosKey)) || {};
    let posChanged = false;
    Object.keys(posAll).forEach((key) => {
      if (key.endsWith(".descriptionZoomPos")) {
        delete posAll[key];
        posChanged = true;
      }
    });
    if (posChanged) siteStore.setItem(rawPosKey, JSON.stringify(posAll));

    siteStore.setItem(FLAG_KEY, "1");
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
    // Dal telefono (anteprima mobile o schermo stretto) in content.js NON si scrive: lì offset/width/zoomBox sono quelli del
    // COMPUTER, e scriverci quelli del telefono rovinava il computer. La disposizione del telefono si salva a parte (qui sopra:
    // site-state.js, chiavi ":m") e vale per chi guarda da telefono.
    if (src && propType && !isMobileViewport()) {
      const props = {};
      props[propType] = { x: pos.x, y: pos.y };
      fetch('/api/save-image-props', {
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
    return JSON.parse(siteStore.getItem(GUIDES_STORE_KEY + layoutScopeSuffix())) || {};
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
    siteStore.setItem(GUIDES_STORE_KEY + layoutScopeSuffix(), JSON.stringify(all));
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
    if (siteStore.getItem(FLAG_KEY)) return;
    [POSITION_STORE_KEY, SIZE_STORE_KEY, GUIDES_STORE_KEY].forEach((baseKey) => {
      const legacy = siteStore.getItem(baseKey);
      if (legacy != null && siteStore.getItem(baseKey + ":d") == null) {
        siteStore.setItem(baseKey + ":d", legacy);
      }
    });
    siteStore.setItem(FLAG_KEY, "1");
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
// "sideHandles" (didascalie): al posto della maniglia d'angolo ce ne sono due, una per lato, a metà altezza — cambiano solo
// la larghezza e il blocco resta centrato (ogni lato si allarga della metà del trascinamento, così la maniglia segue il
// puntatore). "minWidth"/"maxWidth" (numero o funzione) limitano la larghezza, "onResize" scatta a ogni passo del trascinamento.
function makeResizable(node, key, defaults = {}, { lockRatioTo, onResizeEnd, alwaysVisible, src, propType = "size", sideHandles, minWidth = 40, maxWidth, onResize } = {}) {
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
  function addHandle(extraClass, signX, signY = 1, { side = false, title } = {}) {
    let classes = "resize-handle";
    if (alwaysVisible) classes += " always-visible";
    if (extraClass) classes += ` ${extraClass}`;
    const handle = el("div", title ? { class: classes, title } : { class: classes });
    node.appendChild(handle);

    let dragStart = null; // { pointerId, startX, startY, startWidth, startHeight, aspectRatio }

    function onPointerMove(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      // Maniglia laterale: solo larghezza, e doppia perché il blocco resta centrato (si allarga da entrambi i lati)
      const dx = (e.clientX - dragStart.startX) * signX * (side ? 2 : 1);
      const dy = side ? 0 : (e.clientY - dragStart.startY) * signY;

      let rawWidth = dragStart.startWidth;

      if (dragStart.aspectRatio) {
        // Per le foto, se stiamo trascinando una maniglia in alto o in basso,
        // l'utente potrebbe muoversi più verticalmente che orizzontalmente.
        // Prendiamo il movimento dominante in scala.
        const effectiveDx = Math.abs(dx) > Math.abs(dy * dragStart.aspectRatio) ? dx : dy * dragStart.aspectRatio;
        rawWidth = Math.max(minWidth, dragStart.startWidth + effectiveDx);
      } else {
        rawWidth = Math.max(minWidth, dragStart.startWidth + dx);
      }
      // Il limite non fa mai restringere di colpo un blocco già più largo: lo impedisce solo di allargarsi ancora
      const widthLimit = typeof maxWidth === "function" ? maxWidth() : maxWidth;
      if (widthLimit) rawWidth = Math.min(rawWidth, Math.max(minWidth, widthLimit, dragStart.startWidth));

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
      if (onResize) onResize();
    }

    function onPointerUp(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      handle.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      saveSizeOverride(key, { width: node.style.width, height: node.style.height });
      // Dal telefono in content.js non si scrive (vedi makeMovableFree): la misura del telefono resta in site-state.js (":m")
      if (src && propType === "size" && !isMobileViewport()) {
        fetch('/api/save-image-props', {
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

  if (sideHandles) {
    const sideTitle = "Trascina per allargare o restringere (il testo va a capo di conseguenza); Maiusc = a scatti";
    addHandle("resize-handle-side resize-handle-side-left", -1, 1, { side: true, title: sideTitle }); // lato sinistro
    addHandle("resize-handle-side resize-handle-side-right", 1, 1, { side: true, title: sideTitle }); // lato destro
  } else {
    addHandle(null, 1, 1); // Bottom-Right
    if (lockRatioTo) {
      addHandle("resize-handle-left", -1, 1); // Bottom-Left
      addHandle("resize-handle-top", 1, -1); // Top-Right
      // (Qui c'era anche una maniglia "Top-Left" senza posizione nel CSS: finiva nell'angolo in basso a destra, sopra quella
      // vera, e con i segni invertiti: trascinando verso destra la foto si RESTRINGEVA, verso sinistra si allargava. In alto a
      // sinistra c'è comunque l'etichetta con la misura.)
    }
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
      fetch('/api/save-image-props', {
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
  if (String(id).startsWith("@")) return `la foto "${String(id).slice(1)}"`; // didascalie legate al file (vedi captionPhotoId)
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

  const captionSizeMatch = key.match(/^project\.(.+?)\.captionSize\.(.+)$/);
  if (captionSizeMatch) return `Progetto "${captionSizeMatch[1]}", didascalia ${photoLabel(captionSizeMatch[2])}  →  larghezza della didascalia: aggiungi "captionWidth" su quella voce di "images" (regolata sul telefono vale solo per il telefono e resta in site-state.js)`;

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

  if (key === "archive.bottomIndexNudge") return `Core archive, numero in fondo (ritocco a mano sulla posizione calcolata)  →  posizione solo visiva, nessun equivalente in content.js`;

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
  const captionMatch = key.match(/^project\.(.+?)\.captionText\.(.+)$/);
  if (captionMatch) {
    return isExtraImageId(captionMatch[2])
      ? `Progetto "${captionMatch[1]}", ${photoLabel(captionMatch[2])}  →  usa questo testo come "caption" della nuova voce`
      : `Progetto "${captionMatch[1]}", ${photoLabel(captionMatch[2])}  →  aggiorna "caption" su quella voce di "images"`;
  }

  const archiveCaptionMatch = key.match(/^archive\.captionText\.(.+)$/);
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
        const str = siteStore.getItem(k);
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
          siteStore.setItem(k, JSON.stringify(obj));
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
        const str = siteStore.getItem(k);
        if (!str) return;
        const obj = JSON.parse(str);
        if (obj[prefix]) {
          delete obj[prefix];
          siteStore.setItem(k, JSON.stringify(obj));
        }
      } catch (e) {}
    });
    
    // Azzeramento specifico per home (lista nascosta) e core archive (struttura pagine)
    if (prefix === "home") {
      siteStore.removeItem(HOME_HIDDEN_STORE_KEY);
    }
    if (prefix === "archive") {
      siteStore.removeItem(ARCHIVE_PAGES_STORE_KEY);
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
       // Pagina di un progetto: anche la misura dell'ingrandimento salvata per ciascuna foto (vale in tutto il sito) torna quella di partenza
       if (src && !isArchive && !isSimple) {
         const photo = zoomPhoto(src);
         if (photo) clearSizeOverride(photo.key);
       }
       if (src) {
         fetchPromises.push(
           fetch('/api/save-image-props', {
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

    // Prima di ricaricare, anche la copia su disco deve aver registrato il ripristino
    Promise.all([...fetchPromises, siteStore.flushNow()]).then(() => {
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
  // I pulsanti di modifica (⇲ modifica, ⇩ esporta, anteprima mobile) compaiono solo sul tuo
  // computer: chi visita il sito pubblicato non li vede e non può cambiare nulla.
  if (!IS_EDITOR) return;
  if (document.querySelector(".edit-toggle")) return;

  const toggle = el("button", { class: "edit-toggle", style: "z-index: 99999 !important;", "aria-label": "Modifica", title: "Modifica: angolo = ridimensiona, icona blu ⠿ = riordina, icona verde = sposta liberamente, × = elimina una foto, + = aggiungine una nuova, clicca su una didascalia per scriverla/correggerla" }, "⇲");

  toggle.addEventListener("click", async () => {
    const turningOff = document.body.classList.contains("edit-mode");
    
    if (turningOff) {
      toggle.textContent = "Salvataggio...";
      toggle.disabled = true;
      // Save texts to server
      // Il testo di un progetto sta in testi/<nome>.txt. La chiave salvata è "project.<nome>" (core archive:
      // "archive"): prima si mandava la chiave intera ("project.stills"), quindi il testo finiva in un file
      // sbagliato (testi/project.stills.txt) e il testo vero non cambiava — la modifica andava persa.
      const textFileFor = (key) => {
        // Il testo va nello stesso file da cui il sito lo legge (vedi projectTextFile: lo slug, o il nome attuale del progetto).
        const projectSlug = key.startsWith("project.") ? key.slice("project.".length) : key.startsWith("project:") ? key.slice("project:".length) : null;
        if (projectSlug !== null) return findProject(projectSlug) ? projectTextFile(findProject(projectSlug)) : projectSlug;
        if (key === "core" || key === "archive") return "core archive";
        return null; // le pagine-parola non hanno un file di testo: la modifica resta nello stato salvato
      };
      const overrides = loadDescriptionOverrides();
      const savedKeys = [];
      for (const [key, textArray] of Object.entries(overrides)) {
        const slug = textFileFor(key);
        if (!slug) continue;
        try {
          const res = await fetch('/api/save-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug, text: textArray })
          });
          if (res.ok) savedKeys.push(key);
        } catch (e) {
          console.error("Failed to save", slug, e);
        }
      }

      // Si tolgono dalla memoria locale SOLO i testi davvero salvati nel file .txt (verranno riletti da lì)
      if (savedKeys.length > 0) {
        const remaining = loadDescriptionOverrides();
        savedKeys.forEach((key) => delete remaining[key]);
        if (Object.keys(remaining).length) siteStore.setItem(DESCRIPTION_STORE_KEY, JSON.stringify(remaining));
        else siteStore.removeItem(DESCRIPTION_STORE_KEY);
      }

      // Save archive pages to server
      try {
        const archivePagesLs = JSON.parse(siteStore.getItem(ARCHIVE_PAGES_STORE_KEY));
        if (archivePagesLs && archivePagesLs.length > 0) {
          await fetch('/api/save-archive-pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pages: archivePagesLs })
          });
        }
      } catch (e) {
        console.error("Failed to save archive pages", e);
      }

      // Le misure degli ingrandimenti finiscono anche in content.js ("zoomBox" di ogni foto di un progetto). Per ogni
      // foto vale la misura salvata PER LA FOTO (la più recente, ovunque l'hai regolata: pagina del progetto o Core
      // Archive); se non c'è, quella salvata per la pagina del progetto.
      const sizeOverrides = loadSizeOverrides();
      const zoomBoxesToWrite = [];
      PROJECTS.forEach((project) => (project.images || []).forEach((image, idx) => {
        if (!image.src) return;
        const photo = zoomPhoto(image.src);
        const size = (photo && sizeOverrides[photo.key]) || sizeOverrides[`project.${project.slug}.zoom.${idx}`];
        if (size) zoomBoxesToWrite.push({ src: image.src, size });
      }));
      // (Dal telefono non si scrive in content.js: lo "zoomBox" lì è la misura del COMPUTER, vedi makeMovableFree.)
      for (const { src, size } of (isMobileViewport() ? [] : zoomBoxesToWrite)) {
        try {
          await fetch('/api/save-image-props', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ src, props: { zoomBox: size } })
          });
        } catch (e) {
          console.error("Failed to save image props for", src, e);
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

  // Poco dopo si controlla che il browser non abbia nascosto il pulsante ⇲ (lo fanno alcune estensioni, per esempio i blocchi
  // pubblicità): se è sparito, un avviso lo dice, invece di lasciare una pagina senza modo di modificare e senza spiegazione.
  if (window.top === window && !navigator.webdriver) {
    setTimeout(() => {
      try {
        const style = getComputedStyle(toggle);
        if (!toggle.isConnected || style.display === "none" || style.visibility === "hidden" || toggle.getBoundingClientRect().width === 0) {
          showPageNotice("I pulsanti di modifica ci sono, ma il browser li nasconde: di solito è un'estensione (per esempio un blocco pubblicità). Disattivala per questo indirizzo e ricarica la pagina.", { seconds: 20 });
        }
      } catch (e) {
        /* niente da dire */
      }
    }, 1500);
  }

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
  // "100vh" su iPhone/iPad comprende anche la zona sotto la barra del browser: un pannello alto quanto "100vh" finisce in
  // parte nascosto e l'ultima parte di un testo lungo non si raggiunge. "100dvh" è l'altezza davvero visibile (sul computer
  // è identica a "100vh"); dove non esiste si resta su "100vh".
  zoomTextPanel.style.maxHeight = window.CSS && CSS.supports && CSS.supports("max-height", "100dvh") ? "100dvh" : "100vh";
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

  const closeBtn = el("button", { class: "lightbox-close", "aria-label": "Close", style: "color: var(--ink); z-index: 10;" }, "×");
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
  if (IS_EDITOR) panel.appendChild(editZoomBtn); // solo sul tuo computer, non per chi visita il sito

  const debugPanel = el("div", { style: "position: absolute; top: 50px; right: 60px; background: rgba(0,0,0,0.8); color: white; padding: 10px; font-family: var(--mono); font-size: 12px; --sans-stroke: 0; z-index: 1000; pointer-events: none; display: none; border-radius: 4px;" });
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

// Distanza (px) tra la foto ingrandita e il nome del progetto che le sta accanto: di lato su computer, sotto su
// telefono. (La scritta ha anche un margine interno di 10px, che si somma.)
const LIGHTBOX_LABEL_GAP = 120;
const LIGHTBOX_LABEL_GAP_MOBILE = 14;

/* ---- La misura dell'ingrandimento è UNA PER FOTO, uguale in tutto il sito ----
   La decidi tu trascinando le maniglie sulla foto ingrandita (in modalità modifica). Si salva sotto il nome della
   FOTO e non della pagina da cui l'hai ingrandita: la stessa foto si apre quindi uguale nella pagina del progetto e
   nel Core Archive. Una copia della foto nella cartella "core archive" conta come la foto del progetto (vedi
   IMAGE_TWINS in images-data.js). */

// "images/beach/beach-1.jpg" a partire da un indirizzo qualsiasi (assoluto, con "?v=...", con "%20" per gli spazi)
function photoPathOf(src) {
  if (!src || /^data:/i.test(String(src))) return null;
  let path = String(src).replace(/[?#].*$/, "");
  try { path = decodeURIComponent(path); } catch (e) { /* resta com'è */ }
  const at = path.toLowerCase().indexOf("images/");
  return at >= 0 ? path.slice(at) : null;
}

let imageTwinsByLowerPath = null;
// La foto "vera" dietro un indirizzo: { src: percorso com'è in content.js, key: nome con cui si salva la sua misura,
// ownKey: lo stesso nome ma per il file così com'è (se è una copia nel "core archive", non quello del progetto) }.
// ownKey serve solo a non perdere una misura salvata quando l'elenco delle copie non c'era ancora (computer non
// riavviato dopo l'aggiornamento): si cerca sotto "key", poi sotto "ownKey".
function zoomPhoto(src) {
  const path = photoPathOf(src);
  if (!path) return null;
  if (!imageTwinsByLowerPath) {
    imageTwinsByLowerPath = new Map(Object.entries(window.IMAGE_TWINS || {}).map(([copy, original]) => [copy.toLowerCase(), original]));
  }
  const original = imageTwinsByLowerPath.get(path.toLowerCase()) || path;
  // (con stablePhotoPath: le misure già salvate sotto il nome della cartella di prima valgono ancora dopo averla rinominata)
  return { src: original, key: `zoom:${stablePhotoPath(original).toLowerCase()}`, ownKey: `zoom:${stablePhotoPath(path).toLowerCase()}` };
}

// Dove sta il bordo sinistro di una foto ingrandita larga "width": al centro dello schermo, oppure (Core Archive) al
// centro dei tre quarti di sinistra — e mai più a sinistra del margine, se la foto è più larga di quello spazio.
function zoomLeftFor(width) {
  const area = zoomActiveArea;
  return area ? Math.max(area.left, area.left + (area.width - width) / 2) : (window.innerWidth - width) / 2;
}

// La voce di content.js (un progetto) che ha quella foto, se c'è: ha la misura salvata nel file ("zoomBox")
function contentImageOf(photo) {
  if (!photo || typeof PROJECTS === "undefined") return null;
  const wanted = photo.src.toLowerCase();
  for (const project of PROJECTS) {
    const found = (project.images || []).find((image) => image.src && String(image.src).toLowerCase() === wanted);
    if (found) return found;
  }
  return null;
}

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
let zoomActivePhoto = null;   // la foto aperta ora: { src, key, ownKey } (vedi zoomPhoto), o null se non è una foto del sito
let zoomActiveArea = null;    // Core Archive: { left, width, maxWidth } = lo spazio in cui sta la foto; null = centrata nello schermo
let zoomActiveBaseBox = null; // la misura salvata con cui si è aperta: da qui si ricalcola quella nuova

// La funzione di chiusura dell'apertura IN CORSO: il click su sfondo/
// immagine (agganciato una volta sola, vedi ensureZoomElements) deve
// sempre richiamare QUESTA, aggiornata a ogni apertura — non una copia
// fissata alla primissima foto mai aperta. Prima di questa correzione era
// una variabile locale a makeZoomable (quindi una per foto): il listener
// restava agganciato per sempre a quella della PRIMA foto cliccata in
// assoluto, quindi chiudere una foto diversa non faceva nulla (bug
// confermato: "chiudere funziona solo sulla prima foto, poi si blocca").
let zoomCurrentClose = null;

// Rimette a misura la foto ingrandita aperta ORA quando lo schermo cambia (telefono ruotato): impostata da makeZoomable a ogni
// apertura, tolta all'inizio della chiusura. null = nessuna foto ingrandita da adattare.
let zoomRefit = null;

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
      hud.style.cssText = "position: absolute; bottom: -35px; right: 0; background: rgba(0,0,0,0.8); color: white; padding: 6px 10px; border-radius: 4px; font-family: var(--mono); font-size: 12px; --sans-stroke: 0; pointer-events: none; opacity: 0; transition: opacity 0.2s; z-index: 1000;";
      frame.appendChild(hud);
    }

    // Il riquadro in basso a destra della foto: la misura mentre trascini, poi l'esito del salvataggio
    const showHud = (text, background, hideAfterMs) => {
      hud.textContent = text;
      hud.style.background = background;
      // Sotto l'angolo in basso a destra della foto; se la foto arriva quasi al bordo dello schermo (foto alte), lì
      // sotto non si vedrebbe: allora dentro la foto, sempre nell'angolo in basso a destra.
      const noRoomBelow = frame.getBoundingClientRect().bottom + 45 > window.innerHeight;
      hud.style.bottom = noRoomBelow ? "8px" : "-35px";
      hud.style.right = noRoomBelow ? "8px" : "0";
      hud.style.opacity = "1";
      if (hideAfterMs) setTimeout(() => { hud.style.opacity = "0"; }, hideAfterMs);
    };

    function onPointerMove(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      const dx = e.clientX - dragStart.startX;
      const isLeft = extraClass && extraClass.includes("resize-handle-top");
      const effectiveDx = isLeft ? -dx : dx;
      // Core Archive: la foto può crescere finché a destra resta posto per il nome del progetto
      const area = zoomActiveArea;
      // Su telefono le maniglie stanno DENTRO gli angoli della foto (vedi style_v58.css), quindi basta il margine di 8px per
      // lato: con i 96px di prima il primo spostamento faceva scattare la foto da 354px a 274px.
      const onPhone = window.innerWidth <= MOBILE_BREAKPOINT;
      const maxW = area ? area.maxWidth : window.innerWidth - (onPhone ? 16 : 96);
      const maxH = window.innerHeight - (onPhone ? 16 : 96);
      let newWidth = Math.max(120, Math.min(maxW, dragStart.startWidth + effectiveDx));
      let newHeight = newWidth / dragStart.aspectRatio;
      if (newHeight > maxH) {
        newHeight = maxH;
        newWidth = newHeight * dragStart.aspectRatio;
      }
      frame.style.width = `${newWidth}px`;
      frame.style.height = `${newHeight}px`;
      // Ricentrata a ogni trascinamento nello STESSO punto in cui si è aperta: al centro dello schermo, oppure (Core
      // Archive) al centro del suo spazio. Cambiare solo larghezza/altezza senza aggiornare anche left/top la farebbe
      // "scivolare" verso l'angolo in basso a destra a ogni resize.
      frame.style.left = `${zoomLeftFor(newWidth)}px`;
      frame.style.top = `${(window.innerHeight - newHeight) / 2}px`;

      showHud(`${Math.round(newWidth)} × ${Math.round(newHeight)} px`, "rgba(0,0,0,0.8)");
    }

    async function onPointerUp(e) {
      if (!dragStart || e.pointerId !== dragStart.pointerId) return;
      handle.classList.remove("is-dragging");
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      const drag = dragStart;
      dragStart = null;

      // Quello che si salva è un INGOMBRO MASSIMO (la foto ci sta dentro con le sue proporzioni, mai stirata):
      // se si cambia una foto verticale (l'altezza è il vincolo principale) si aggiorna l'altezza massima ma non si
      // distrugge la larghezza massima, altrimenti la prossima foto orizzontale apparirebbe piccolissima. Si parte
      // dalla misura con cui la foto si è aperta (la sua, quella salvata per lei in tutto il sito).
      const activeKey = zoomActiveSizeKey || LIGHTBOX_SIZE_KEY;
      const photo = zoomActivePhoto;
      const base = zoomActiveBaseBox || {};
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const defaultMaxW = isMobile ? window.innerWidth - 16 : window.innerWidth * 0.85;
      const defaultMaxH = isMobile ? window.innerHeight - 16 : window.innerHeight * 0.82;

      let newMaxW = base.width ? parseFloat(base.width) : defaultMaxW;
      let newMaxH = base.height ? parseFloat(base.height) : defaultMaxH;

      const w = parseFloat(frame.style.width);
      const h = parseFloat(frame.style.height);
      const ratio = drag.aspectRatio;

      if (ratio >= 1) {
        newMaxW = w;
        if (h > newMaxH) newMaxH = h;
      } else {
        newMaxH = h;
        if (w > newMaxW) newMaxW = w;
      }
      const size = { width: `${newMaxW}px`, height: `${newMaxH}px` };

      // 1) Nello stato del sito, sotto il nome della FOTO (vale in tutto il sito) e, come prima, sotto quello di questo punto.
      saveSizeOverride(activeKey, size);
      if (photo) {
        saveSizeOverride(photo.key, size);
        if (photo.ownKey !== photo.key) saveSizeOverride(photo.ownKey, size);
      }
      zoomActiveBaseBox = size;
      showHud("Salvataggio...", "rgba(0,0,0,0.8)");

      // 2) Su disco: lo stato (js/site-state.js) e, se la foto sta in content.js, anche la sua misura lì ("zoomBox").
      const contentImage = photo ? contentImageOf(photo) : null;
      // Dal telefono in content.js non si scrive (vedi makeMovableFree): lo zoomBox lì è la misura del COMPUTER
      const writeContent = contentImage && !isMobile
        ? fetch("/api/save-image-props", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ src: contentImage.src, props: { zoomBox: size } }),
          }).then((res) => res.ok).catch((err) => { console.error("Salvataggio in content.js non riuscito", err); return false; })
        : Promise.resolve(true);
      const [stateOnDisk, contentOk] = await Promise.all([siteStore.flushNow(), writeContent]);

      // Il segno verde compare SOLO se la misura è davvero finita su disco
      if (stateOnDisk && contentOk) {
        showHud(`✓ Salvato (${Math.round(w)} × ${Math.round(h)} px)`, "#2b7a4b", 2500);
      } else {
        showHud("✗ NON salvato su disco", "#dc2626", 6000);
      }
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
  // Il carattere della scritta (come i nomi della home) sta nel foglio di stile: ".lightbox-project-label"
  zoomProjectLabel = el("div", { class: "lightbox-project-label", style: `display: none; position: absolute; left: calc(100% + ${LIGHTBOX_LABEL_GAP}px); top: 50%; transform: translateY(-50%); cursor: pointer; white-space: nowrap; pointer-events: auto; padding: 10px;` });
  zoomActiveFrame.appendChild(zoomActiveImg);
  zoomActiveFrame.appendChild(zoomProjectLabel);
  makeZoomResizable(zoomActiveFrame, zoomActiveImg);
  const triggerClose = () => { if (zoomCurrentClose) zoomCurrentClose(); };
  zoomBackdrop.addEventListener("click", triggerClose);
  zoomActiveImg.addEventListener("click", triggerClose);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") triggerClose();
  });
  window.addEventListener("resize", () => {
    if (zoomRefit && zoomActiveFrame.classList.contains("is-active")) zoomRefit();
  });
  document.body.appendChild(zoomBackdrop);
  document.body.appendChild(zoomActiveFrame);
}

// Prepara il file grande di una foto PRIMA che serva: si decodifica in anticipo (appena il puntatore arriva sulla foto o
// la tocca), così quando parte l'ingrandimento la foto che vola è già pronta e compare subito, senza fotogrammi vuoti.
// Si tengono solo le ultime foto preparate, per non occupare memoria inutilmente.
const warmedLightboxPhotos = [];
function warmLightboxPhoto(src) {
  if (!src || /^data:/i.test(String(src))) return Promise.resolve();
  const known = warmedLightboxPhotos.find((entry) => entry.src === src);
  if (known) return known.ready;
  const probe = new Image();
  probe.src = src;
  const ready = (probe.decode ? probe.decode() : Promise.resolve()).catch(() => {});
  warmedLightboxPhotos.push({ src, probe, ready });
  if (warmedLightboxPhotos.length > 4) warmedLightboxPhotos.shift();
  return ready;
}

function makeZoomable(frame, img, linkTo, sizeKey, zoomBox) {
  const warmThisPhoto = () => { if (!isEditMode()) warmLightboxPhoto(img.currentSrc || img.src); };
  frame.addEventListener("pointerenter", warmThisPhoto, { passive: true });
  frame.addEventListener("pointerdown", warmThisPhoto, { passive: true });
  let opening = false; // un secondo clic mentre la foto si sta preparando non deve aprirla due volte
  frame.addEventListener("click", () => {
    if (isEditMode() || opening) return;
    
    zoomActiveSizeKey = sizeKey;
    zoomActiveOriginalSrc = img.getAttribute("src") || img.src;
    zoomActivePhoto = zoomPhoto(zoomActiveOriginalSrc);

    // 1. FIRST: coordinate della miniatura nello slider.
    const firstRect = img.getBoundingClientRect();
    // La galleria dietro si ferma dov'è (anche a metà di uno scorrimento) finché la foto è ingrandita e non è
    // tornata al suo posto: vedi holdGallery in renderGallery.
    window.dispatchEvent(new Event("zoom-opened"));

    // Da qui in poi niente cambia rispetto a prima, tranne UNA cosa: l'ingrandimento parte solo quando il file grande
    // è decodificato (di solito lo è già, vedi warmLightboxPhoto: allora parte nello stesso istante del clic).
    // Aspettare al massimo 250 ms: se il file non fosse pronto, parte comunque.
    opening = true;
    const photoReady = Promise.race([warmLightboxPhoto(img.currentSrc || img.src), new Promise((resolve) => setTimeout(resolve, 250))]);
    photoReady.then(() => {
    opening = false;

    // Nasconde temporaneamente l'originale (niente "doppione" per l'istante
    // in cui il clone appare esattamente sopra di lei).
    img.style.opacity = "0";

    ensureZoomElements();
    const backdrop = zoomBackdrop;
    const activeFrame = zoomActiveFrame;
    const activeImg = zoomActiveImg;

    // Dove sta la scritta del progetto: di fianco alla foto (a destra) su computer; su telefono non c'è spazio di lato,
    // quindi sotto la foto. Si rifà anche quando lo schermo cambia con la foto aperta (telefono ruotato).
    const placeLabel = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        zoomProjectLabel.style.left = "0";
        zoomProjectLabel.style.top = `calc(100% + ${LIGHTBOX_LABEL_GAP_MOBILE}px)`;
        zoomProjectLabel.style.transform = "none";
      } else {
        zoomProjectLabel.style.left = `calc(100% + ${LIGHTBOX_LABEL_GAP}px)`;
        zoomProjectLabel.style.top = "50%";
        zoomProjectLabel.style.transform = "translateY(-50%)";
      }
    };

    if (linkTo) {
      const parts = linkTo.split("/");
      let labelName = linkTo;
      if (parts[0] === "project" && parts[1]) {
        const proj = PROJECTS.find(p => p.slug === parts[1]);
        // Il nome com'è scritto nella home (con la maiuscola)
        if (proj) labelName = proj.name;
      } else if (linkTo === "archive") {
        labelName = ARCHIVE.title.toLowerCase();
      }
      zoomProjectLabel.innerText = labelName;
      zoomProjectLabel.style.display = "block";
      placeLabel();

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

    // 2. LAST: dimensione finale, centrata sullo schermo. La misura che hai
    // scelto TU per questa foto trascinando le maniglie (una per foto, uguale
    // in tutto il sito: vedi zoomPhoto) sostituisce il solito 85%/82% dello
    // schermo come INGOMBRO MASSIMO: le proporzioni restano comunque quelle
    // NATURALI della foto (mai deformata), semplicemente adattata (in scala,
    // non stirata) dentro l'ingombro scelto — e lo scaleX/scaleY del volo
    // FLIP restano sempre uguali fra loro (nessuno "schiacciamento" a metà
    // animazione, lo stesso bug già risolto per il testo).
    // Ordine di ricerca della misura: quella salvata per la foto (ovunque la
    // si sia regolata) → quella salvata per questo punto del sito → quella
    // scritta in content.js per questa foto.
    // Le proporzioni vere della foto si conoscono anche prima che sia arrivata (misure lette in images-data.js):
    // senza questo, un clic su una foto ancora in arrivo usava la forma della parola (larga e bassa) e la schiacciava.
    const knownSize = knownImageSize(img.getAttribute("src") || img.src);
    const ratio = (img.naturalWidth && img.naturalHeight)
      ? (img.naturalWidth / img.naturalHeight)
      : (knownSize ? knownSize[0] / knownSize[1] : (firstRect.width / firstRect.height));

    // Misura e posizione finali per lo schermo di ORA. Sono una funzione perché si rifanno anche se lo schermo cambia con la
    // foto aperta (telefono ruotato): prima la foto restava della misura e nel punto di prima, e lo schermo nuovo la tagliava.
    const fitTarget = () => {
      const activeKey = sizeKey || LIGHTBOX_SIZE_KEY;
      const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      const sizeOverrides = loadSizeOverrides();
      const contentImage = zoomActivePhoto ? contentImageOf(zoomActivePhoto) : null;
      const photoSize = zoomActivePhoto && (sizeOverrides[zoomActivePhoto.key] || sizeOverrides[zoomActivePhoto.ownKey]);
      // Su telefono vale solo la misura scelta SUL TELEFONO (qui loadSizeOverrides() dà lo store ":m"): lo "zoomBox" di content.js
      // è la misura del COMPUTER e lì non conta. Prima su telefono ogni misura salvata veniva ignorata del tutto: ridimensionando
      // la foto ingrandita compariva "✓ Salvato", ma riaprendola tornava a filo schermo.
      const savedSize = isMobile
        ? (photoSize || sizeOverrides[activeKey] || null)
        : (photoSize || sizeOverrides[activeKey] || zoomBox || (contentImage && contentImage.zoomBox) || null);
      zoomActiveBaseBox = savedSize;
      const defaultMaxW = isMobile ? window.innerWidth - 16 : window.innerWidth * 0.85;
      const defaultMaxH = isMobile ? window.innerHeight - 16 : window.innerHeight * 0.82;
      // Mai oltre lo schermo: su telefono 8px di margine per lato (a filo, come di default), su computer 16px.
      const screenMargin = isMobile ? 16 : 32;
      let maxW = savedSize && savedSize.width ? Math.min(parseFloat(savedSize.width), window.innerWidth - screenMargin) : defaultMaxW;
      const maxH = savedSize && savedSize.height ? Math.min(parseFloat(savedSize.height), window.innerHeight - screenMargin) : defaultMaxH;
      // Core Archive su computer: la foto sta nei TRE QUARTI di sinistra dello schermo (con il margine di lato), centrata
      // lì dentro, e il nome del progetto le sta accanto, a destra. La SUA misura (quella che hai scelto tu) vale anche
      // se è più grande dei tre quarti: la foto può allargarsi finché a destra c'è ancora posto per il nome (in quel
      // caso parte dal margine sinistro); oltre si riduce quanto basta, sempre con le sue proporzioni. Senza una misura
      // scelta da te, la foto sta nei tre quarti.
      const isArchiveZoom = Boolean(sizeKey && sizeKey.startsWith("archive.")) && !isMobile;
      let archiveArea = null; // { left, width, maxWidth }: lo spazio ideale e il massimo in cui sta la foto dell'archivio
      if (isArchiveZoom) {
        const edge = Math.max(24, window.innerWidth * 0.03);
        const labelRoom = linkTo ? LIGHTBOX_LABEL_GAP + zoomProjectLabel.offsetWidth : 0; // quanto serve alla scritta, a destra della foto
        const hardRight = window.innerWidth - edge - labelRoom;               // fin qui può arrivare il bordo destro della foto
        const areaRight = Math.min(window.innerWidth * 0.75, hardRight);      // lo spazio ideale: i tre quarti di sinistra
        archiveArea = { left: edge, width: Math.max(160, areaRight - edge), maxWidth: Math.max(160, hardRight - edge) };
        const hasChosenSize = Boolean(savedSize && savedSize.width && savedSize.height);
        maxW = Math.min(maxW, hasChosenSize ? archiveArea.maxWidth : archiveArea.width);
      }
      zoomActiveArea = archiveArea;

      let targetW = maxW;
      let targetH = targetW / ratio;
      if (targetH > maxH) {
        targetH = maxH;
        targetW = targetH * ratio;
      }
      let targetY = (window.innerHeight - targetH) / 2;
      // Su telefono la scritta del progetto sta SOTTO la foto: se la foto è alta quanto lo schermo (foto verticali, schermi
      // bassi, telefono messo in orizzontale) la scritta finiva sotto il bordo e non si vedeva né si poteva toccare.
      // Allora si lascia lo spazio alla scritta: la foto si rimpicciolisce solo se serve e il gruppo foto+scritta si centra.
      // Le foto che hanno già posto sotto restano esattamente dove erano.
      if (isMobile && linkTo) {
        const labelRoom = LIGHTBOX_LABEL_GAP_MOBILE + zoomProjectLabel.offsetHeight;
        if (targetY + targetH + labelRoom > window.innerHeight - 8) {
          if (targetH + labelRoom > window.innerHeight - 16) {
            targetH = window.innerHeight - 16 - labelRoom;
            targetW = targetH * ratio;
          }
          targetY = (window.innerHeight - (targetH + labelRoom)) / 2;
        }
      }
      return { targetW, targetH, targetX: zoomLeftFor(targetW), targetY };
    };
    const { targetW, targetH, targetX, targetY } = fitTarget();

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

    // Se lo schermo cambia mentre la foto è aperta (telefono ruotato), la foto si rimette a misura dello schermo nuovo,
    // subito e senza animazione (vedi il listener di "resize" in ensureZoomElements).
    zoomRefit = () => {
      if (linkTo) placeLabel();
      const target = fitTarget();
      activeFrame.style.transition = "none";
      activeFrame.style.width = `${target.targetW}px`;
      activeFrame.style.height = `${target.targetH}px`;
      activeFrame.style.left = `${target.targetX}px`;
      activeFrame.style.top = `${target.targetY}px`;
      activeFrame.style.transform = "translate(0px, 0px) scale(1)";
    };

    zoomCurrentClose = function close() {
      zoomRefit = null; // durante la chiusura la foto non va più rimessa a misura
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
          // La miniatura torna visibile ISTANTANEAMENTE, nello stesso momento in cui sparisce la foto che volava: la
          // sua dissolvenza di 0,3 s (serve al caricamento della foto) qui faceva sparire la foto per un attimo, a fine
          // chiusura, e poi la faceva riapparire sfumando.
          const fade = img.style.transition;
          img.style.transition = "none";
          img.style.opacity = "1";
          img.getBoundingClientRect(); // applica subito il cambio, prima di rimettere la dissolvenza
          img.style.transition = fade;
        }
        zoomCurrentClose = null;
        // La foto è tornata sulla miniatura: la galleria può riprendere
        window.dispatchEvent(new Event("zoom-closed"));
      }, 550);
    };
    });
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

// Misure VERE (larghezza, altezza) delle foto del repository, lette in anticipo da images-data.js:
// permettono di riservare lo spazio giusto PRIMA che il file arrivi dalla rete. Così la pagina non
// "salta" quando la foto compare, e non dipende da quanto è veloce la connessione o dal fatto che
// la foto sia già in memoria (il famoso "al primo ingresso sembra rotto, dopo 3-4 volte è a posto").
const KNOWN_IMAGE_SIZES = (() => {
  const index = new Map();
  const sizes = window.IMAGE_SIZES || {};
  Object.keys(sizes).forEach((path) => index.set(path.toLowerCase(), sizes[path]));
  return index;
})();

function knownImageSize(src) {
  if (!src) return null;
  const size = KNOWN_IMAGE_SIZES.get(String(src).replace(/\?.*$/, "").toLowerCase());
  return size && size[0] > 0 && size[1] > 0 ? size : null;
}

// Un pixel trasparente: occupa il posto della foto finché non è arrivata.
const TINY_GIF = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

// Numero "a caso" ma sempre lo stesso per lo stesso testo (0 incluso, 1 escluso): serve a disporre le foto
// dell'archivio che non hai ancora spostato, uguale a ogni visita e su ogni browser.
function stableUnit(text, salt) {
  let h = 2166136261;
  const s = `${text}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
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
        fetch('/api/rename-project', {
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
  // Al primo caricamento il carattere può non essere ancora arrivato quando si misurano i nomi (si misurava
  // con un carattere di ripiego, e il nome poteva restare troppo stretto o troppo largo): si rimisura appena è pronto.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('600 16px "Strichpunkt Sans"').then(() => {
      if (list.isConnected) list.querySelectorAll(".home-word-input").forEach((input) => syncWordInputWidth(input));
    }).catch(() => {});
  }

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
  const hamburgerEl = el("a", { href: "#/", class: "hamburger", "aria-label": "Back to home" }, [
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

// Il testo scorrevole è una striscia con due copie del testo una sotto l'altra, che scende in loop dentro il suo
// riquadro (.description). Qui si misura, sulla pagina vera e a striscia ferma:
//  - distance: di quanto deve scendere prima di ripetersi (dalla prima riga di una copia alla prima riga dell'altra);
//  - startPos: il punto di partenza di OGNI testo scorrevole del sito: la prima riga del testo esattamente sul
//    bordo alto del riquadro in cui scorre (prima partiva più in basso, dopo il margine interno del riquadro).
// Si usano differenze tra rettangoli e non "offsetTop": quest'ultimo cambia da un browser all'altro e arrotonda ai pixel interi.
function measureMarqueeLoop(box, track, content, clone) {
  if (!clone.offsetHeight) return { distance: 0, startPos: 0 }; // seconda copia nascosta (modalità modifica): nessuno scorrimento
  const savedTransform = track.style.transform;
  track.style.transform = "none";
  const firstLineTop = (node) => (node.firstElementChild || node).getBoundingClientRect().top;
  const boxTop = box.getBoundingClientRect().top + box.clientTop;
  const textOffset = firstLineTop(content) - boxTop; // dove si trova il testo quando la striscia è ferma
  const distance = firstLineTop(clone) - firstLineTop(content);
  track.style.transform = savedTransform;
  if (!(distance > 0)) return { distance: 0, startPos: 0 };
  // La striscia è spostata di (pos - distance): con pos = distance - textOffset la prima riga arriva a 0, cioè in cima.
  return { distance, startPos: (((distance - textOffset) % distance) + distance) % distance };
}

// Una curva "cubic-bezier(x1, y1, x2, y2)" di CSS (letta da una variabile del foglio di stile, o quella di riserva) come
// quattro numeri.
function cssCubicBezier(variableName, fallback) {
  const text = getComputedStyle(document.documentElement).getPropertyValue(variableName);
  const m = /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/.exec(text || "");
  return m ? [+m[1], +m[2], +m[3], +m[4]] : fallback;
}

// Quanta strada (da 0 a 1) ha fatto una transizione con questa curva quando è passata la frazione di tempo "x" (da 0 a 1).
function bezierProgressAt(curve, x) {
  const [x1, y1, x2, y2] = curve;
  const at = (a, b, s) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < x) lo = mid; else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
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
  let restartMarquee = null; // assegnata più sotto, quando lo scorrimento esiste
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
      // Uscendo dalla modifica il testo può essere cambiato (e la seconda copia era nascosta): si rimisura e lo
      // scorrimento riparte da capo, come quando si apre la pagina.
      if (restartMarquee) restartMarquee();
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
      // Una riga per paragrafo. Le righe vuote (gli spazi tra un gruppo di paragrafi e l'altro) restano:
      // prima venivano cancellate alla prima modifica, e il testo perdeva la sua impaginazione. Mai due righe vuote
      // di fila, né una all'inizio o alla fine.
      const lines = [];
      descContent.childNodes.forEach((node) => {
        const chunk = (node.nodeType === 1 ? node.innerText : node.textContent) || "";
        chunk.split(/\n/).forEach((line) => lines.push(line.trim()));
      });
      const newArray = lines.filter((line, i) => line !== "" || (i > 0 && lines[i - 1] !== "" && lines.slice(i + 1).some((l) => l !== "")));
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
    // Su telefono: la disposizione del computer, in scala, per le foto messe a sinistra (null per le altre e su computer)
    const phoneFromDesktop = phoneLayoutFromDesktop(image);
    // Lo spazio della foto si riserva con le sue proporzioni VERE (vedi KNOWN_IMAGE_SIZES). Prima si usava
    // la misura dell'ingrandimento (zoomBox), che non ha le stesse proporzioni della foto: la schiacciava,
    // lasciando due bande vuote ai lati e la didascalia "a mezz'aria".
    const known = knownImageSize(image.src);
    // La didascalia legata a QUESTA foto (vedi captionIdFor): scritta a mano, oppure quella di content.js, oppure ritrovata,
    // oppure il nome del file se somiglia a un titolo. Non dipende dalla posizione della foto nell'elenco.
    const captionKey = `${sizeKeyPrefix}.captionText.${captionIdFor(image, origIndex)}`;
    const captionDefault = defaultCaptionFor(image);
    const captionOverride = captionOverrides[captionKey];
    const captionText = captionOverride != null ? captionOverride : captionDefault;
    const imgAttrs = { src: TINY_GIF, alt: captionText, decoding: "async" };
    imgAttrs.style = (known ? `aspect-ratio: ${known[0]} / ${known[1]}; ` : "") + "transition: opacity 0.3s; opacity: 0;";
    const img = el("img", imgAttrs);

    const preloader = new Image();
    preloader.onload = () => {
      img.src = preloader.src;
      img.dataset.ready = "1"; // da qui in poi naturalWidth/naturalHeight sono quelli della foto vera, non del pixel segnaposto
      img.style.opacity = "1";
      const p = img.closest(".photo-track");
      if (p) p.offsetHeight;
      if (typeof updateViewportHeight === "function") updateViewportHeight();
    };
    preloader.onerror = () => {
      const fig = img.closest("figure.photo");
      if (fig) fig.style.display = "none";
      if (i === 0) settleFirstLayout();
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
      // Se il testo è quello che comparirebbe comunque (content.js / nome del file) non serve salvare niente;
      // se lo svuoti, si salva "vuoto" = nessuna didascalia (altrimenti tornerebbe quella di riserva).
      const text = captionInput.value.trim();
      if (text === captionDefault) clearCaptionOverride(captionKey);
      else saveCaptionOverride(captionKey, text);
    });
    
    // Imposta l'altezza iniziale una volta aggiunto al DOM
    setTimeout(adjustHeight, 0);
    const figcaption = el("figcaption", { class: "caption-box" }, [captionInput]);

    // Larghezza della didascalia: 240px (o "captionWidth" di content.js), oppure quella scelta con le due maniglie ai lati
    // (in modifica), salvata per QUESTA foto — separatamente su computer e su telefono. Non è più limitata dalla larghezza
    // della foto (prima, con una foto stretta, la didascalia andava a capo di più e nessuna maniglia poteva allargarla) e
    // resta centrata sotto di lei: il CSS la centra con --cap-w, che qui si tiene uguale alla larghezza vera.
    const syncCaptionWidth = () => figcaption.style.setProperty("--cap-w", figcaption.style.width || "240px");
    resizeObservers.push(
      makeResizable(
        figcaption,
        `${sizeKeyPrefix}.captionSize.${captionIdFor(image, origIndex)}`,
        { width: image.captionWidth || "240px" },
        {
          sideHandles: true,
          minWidth: 60,
          // Al massimo quanto serve perché resti tutta dentro il foglio e le sue maniglie (30px fuori dal riquadro) restino
          // raggiungibili, anche rispetto al righello delle guide (14px, a sinistra): 48px di margine per lato, a partire dal
          // centro attuale della didascalia.
          maxWidth: () => {
            const sheet = viewport.getBoundingClientRect();
            const box = figcaption.getBoundingClientRect();
            const center = box.left + box.width / 2 - sheet.left;
            return 2 * Math.min(center - 48, sheet.width - center - 48);
          },
          onResize: () => { syncCaptionWidth(); adjustHeight(); }, // il testo va a capo mentre trascini
          onResizeEnd: () => {
            syncCaptionWidth();
            adjustHeight();
          }
        }
      )
    );
    syncCaptionWidth();
    
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
        // Eccezione: le foto messe a sinistra su computer (align "left")
        // prendono su telefono la stessa larghezza in scala (vedi
        // phoneLayoutFromDesktop).
        {
          width: pickLayout(image.width, image.mobile && image.mobile.width, phoneFromDesktop && phoneFromDesktop.width),
          height: pickLayout(image.height, image.mobile && image.mobile.height, undefined),
        },
        {
          src: image.src,
          propType: "size",
          lockRatioTo: img,
          // La foto non può essere più larga dello spazio che ha (il CSS la ferma lì: "max-width: 100%"). Senza questo limite
          // si poteva trascinare ben oltre: a schermo la foto restava ferma e sembrava "tornare com'era" (su telefono quasi
          // tutte le foto larghe arrivano già al massimo), ma si salvava una larghezza più grande di quella che si vedeva.
          maxWidth: () => {
            const holder = frame.parentElement;
            if (!holder) return 0;
            const style = getComputedStyle(holder);
            return holder.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
          },
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
        (phoneFromDesktop && phoneFromDesktop.offset) || LAYOUT.galleryMobile.imageOffset
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
  // L'altezza del riquadro si anima in 6 secondi (serve al passaggio da una foto all'altra). Il PRIMO disegno
  // della pagina però non deve mai "scivolare" lentamente verso la misura giusta: finché la prima foto non è
  // arrivata (o per al massimo un secondo e mezzo) ogni aggiustamento è istantaneo.
  viewport.style.transition = "none";
  let firstLayoutSettled = false;
  function settleFirstLayout() {
    if (firstLayoutSettled) return;
    firstLayoutSettled = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { viewport.style.transition = ""; }));
  }
  setTimeout(settleFirstLayout, 1500);

  const prevBtn = el("button", { class: "nav-arrow prev", "aria-label": "Previous" }, "←");
  const nextBtn = el("button", { class: "nav-arrow next", "aria-label": "Next" }, "→");
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
  const marqueeBornAt = performance.now();

  // "fromStart": il testo riparte dal suo punto di partenza (prima riga sul bordo alto del riquadro) invece di
  // restare dov'era. Serve all'apertura della pagina e quando una misura cambia subito dopo (arriva il carattere).
  const measureMarqueeDistance = (fromStart = false) => {
    const textHeight = descContent.offsetHeight;
    let gapHeight = MARQUEE_MIN_GAP; // Spazio minimo tra fine e inizio loop
    if (hasExplicitDescHeight) {
      const boxHeight = descBlock.getBoundingClientRect().height;
      if (textHeight < boxHeight) {
        gapHeight = Math.max(MARQUEE_MIN_GAP, boxHeight - textHeight);
      }
    } else {
      descBlock.style.height = `${textHeight}px`;
    }
    marqueeGap.style.height = `${gapHeight}px`;

    const loop = measureMarqueeLoop(descBlock, descTrack, descContent, secondCopyWrapper);
    marqueeDistance = loop.distance;
    marqueePos = fromStart || !marqueeDistance ? loop.startPos : marqueePos % marqueeDistance;
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
  measureMarqueeDistance(true);
  applyMarqueeTransform();
  marqueeRafId = requestAnimationFrame(marqueeTick);
  restartMarquee = () => {
    measureMarqueeDistance(true);
    applyMarqueeTransform();
  };

  descBlock.addEventListener("mouseenter", () => { if (!isTouchEcho()) marqueeHoverPaused = true; });
  descBlock.addEventListener("mouseleave", () => { marqueeHoverPaused = false; });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      // Nei primi istanti la pagina non è ancora stata letta da nessuno: se il carattere arriva solo ora e le misure
      // cambiano, si riparte dal punto giusto invece di restare a metà.
      measureMarqueeDistance(performance.now() - marqueeBornAt < 3000 && !marqueeDragState);
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
  // Finché una foto è ingrandita la galleria dietro sta FERMA (vedi holdGallery più sotto): così, chiudendo,
  // la foto torna esattamente sulla miniatura da cui è partita.
  let lightboxHold = false;
  let heldAnimations = [];
  let heldAt = 0;

  // Allungamento del riquadro quando la foto in arrivo è più alta (vedi updateViewportHeight). Con la barra tenuta ferma
  // (startBarHold) è il movimento della FOTO sullo schermo: sale di quanto il riquadro si allunga. Deve essere dolce come
  // nell'altro verso, l'accorciamento (foglio di stile: 6 s, curva dello scorrimento: la «marea»). Il limite è che "overflow:
  // hidden" taglia il fondo della foto che entra finché il riquadro non ha finito di allungarsi. Perciò:
  //  - mentre si allunga, il bordo di taglio del riquadro è spostato più in basso di GROW_EXTENSION_MAX px (padding con margine
  //    negativo: il layout non cambia) sopra lo spazio vuoto prima delle frecce, dove la foto in arrivo può già appoggiarsi;
  //  - la durata è la più lunga che lasci il taglio sotto un limite (growTransitionFor): la transizione del foglio di stile,
  //    uguale a quella dell'accorciamento, per quasi tutti i passi (35 su 36, fino a +190 px); una curva a «S» più corta per i
  //    salti più grandi (oggi uno solo: Suspension, foto 7 → 8, +201 px, 2,9 s), mai sotto GROW_CALM_FLOOR_MS.
  // (Storia: di colpo; poi 0,8 s; poi 0,3-1,4 s calcolati perché finisse prima che la foto si vedesse; poi, il 30 ottobre,
  // 0,7-2,3 s in proporzione alla crescita. Il proprietario trovava ancora quel tratto uno «scatto» rispetto all'accorciamento,
  // la «marea» lenta di 6 s.)
  const GROW_EXTENSION_MAX = 100;
  const GROW_CUT_MAX_PX = 60;       // altezza massima del fondo della foto in arrivo che può restare nascosta...
  const GROW_CUT_AREA_MAX = 0.02;   // ...e area nascosta al massimo il 2 % della foto, finché se ne vede una striscia di almeno
  const GROW_VISIBLE_MIN_PX = 24;   // questa larghezza
  const GROW_CALM_FLOOR_MS = 2200;  // più veloce di così non si va, nemmeno per i salti più grandi (lì si accetta qualche taglio in più)
  const GROW_CANDIDATES_MS = [4600, 3600, 2900, 2300];
  const GROW_CURVE = [0.37, 0, 0.63, 1]; // «S» simmetrica: parte da fermo e ha il picco di velocità più basso (1,6 volte la media)
  const VIEWPORT_GROW_CURVE = `cubic-bezier(${GROW_CURVE.join(", ")})`;
  let viewportGrowTimer = null;
  let viewportExt = 0; // px di estensione applicati adesso al riquadro (0 = nessuna)
  let viewportTarget = null; // l'altezza (senza estensione) verso cui il riquadro sta andando, o è arrivato, l'ultima volta che l'abbiamo impostata
  let growNote = ""; // com'è cambiata l'altezza all'ultimo scorrimento (per il registro letto dal contatore di fluidità: vedi logFraming)

  // Quale allungamento per una foto in arrivo ("destination": la figura, o il suo clone, verso cui sta partendo lo scorrimento): il
  // più lento che non tagli troppo il suo fondo. Si simula la salita contro lo scorrimento orizzontale (stessa curva e stessa durata del
  // foglio di stile) e si guarda, finché della foto se ne vede una striscia, quanto del suo fondo resta oltre il bordo di taglio.
  // "css" vuoto = la transizione del foglio di stile, la stessa dell'accorciamento.
  function growTransitionFor(destination, growPx, boxBottom, extension) {
    const fallback = { css: `height ${GROW_CALM_FLOOR_MS}ms ${VIEWPORT_GROW_CURVE}`, ms: GROW_CALM_FLOOR_MS };
    if (!(growPx > 0) || !destination || typeof destination.querySelector !== "function") return fallback;
    const frame = destination.querySelector(".photo-frame");
    if (!frame) return fallback;
    const vp = viewport.getBoundingClientRect();
    const dest = destination.getBoundingClientRect();
    const dx = dest.left - vp.left; // > 0: la foto arriva da destra; < 0: da sinistra
    const travel = Math.abs(dx);
    const fr = frame.getBoundingClientRect();
    if (!(travel > 1) || !(vp.width > 0) || !(fr.width > 0) || !(fr.height > 0)) return fallback;
    const gap = Math.max(0, dx > 0 ? fr.left - vp.right : vp.left - fr.right); // strada da fare prima che la foto si veda
    const free = Math.max(0, boxBottom - fr.bottom) + extension; // quanto può stare oltre il bordo di taglio senza tagliare la foto
    const slideMs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--transition-ms")) || TRANSITION_MS;
    const slideCurve = cssCubicBezier("--transition-ease", [0.25, 0.1, 0.25, 1]);
    const fits = (ms, curve) => {
      let maxCut = 0;
      let maxArea = 0;
      for (let t = 0; t <= slideMs * 0.7; t += 40) {
        const cut = Math.max(0, growPx * (1 - (t >= ms ? 1 : bezierProgressAt(curve, t / ms))) - free);
        if (!cut) continue;
        const seen = Math.min(fr.width, Math.max(0, travel * bezierProgressAt(slideCurve, t / slideMs) - gap));
        if (seen >= GROW_VISIBLE_MIN_PX) maxCut = Math.max(maxCut, cut);
        maxArea = Math.max(maxArea, Math.min(cut, fr.height) * seen);
        if (maxCut > GROW_CUT_MAX_PX || maxArea > GROW_CUT_AREA_MAX * fr.width * fr.height) return false;
      }
      return true;
    };
    if (fits(slideMs, slideCurve)) return { css: "", ms: slideMs };
    const ms = GROW_CANDIDATES_MS.find((candidate) => fits(candidate, GROW_CURVE)) || GROW_CALM_FLOOR_MS;
    return { css: `height ${ms}ms ${VIEWPORT_GROW_CURVE}`, ms };
  }

  // Estensione del riquadro verso il basso (vedi sopra): il bordo di taglio scende di "px" senza che cambi il layout. Con "box-sizing:
  // border-box" il padding sta dentro l'altezza, quindi anche l'altezza sale della stessa quantità; il margine negativo restituisce lo spazio.
  const viewportBoxHeight = () => viewport.getBoundingClientRect().height - viewportExt; // l'altezza «vera», anche a transizione in corso
  function setViewportExtension(px) {
    px = Math.max(0, Math.round(px));
    if (px === viewportExt) return;
    const boxHeight = viewportBoxHeight();
    const prevTransition = viewport.style.transition;
    viewport.style.transition = "none";
    viewportExt = px;
    viewport.style.paddingBottom = px ? `${px}px` : "";
    viewport.style.marginBottom = px ? `${-px}px` : "";
    viewport.style.height = `${boxHeight + px}px`;
    viewport.getBoundingClientRect(); // forza il reflow prima di riattivare la transizione
    viewport.style.transition = prevTransition;
  }
  // A riposo (nessuna transizione di altezza in corso, e la galleria non è ferma dietro una foto ingrandita) niente può restare
  // oltre il bordo di taglio: l'estensione si toglie. Se ne accorgono la fine della transizione e un timer di sicurezza.
  function settleViewportExtension() {
    if (!viewportExt || lightboxHold || viewportHeightAnimating()) return;
    setViewportExtension(0);
  }
  viewport.addEventListener("transitionend", (e) => { if (e.target === viewport && e.propertyName === "height") settleViewportExtension(); });
  viewport.addEventListener("transitioncancel", (e) => { if (e.target === viewport && e.propertyName === "height") settleViewportExtension(); });

  // "glide": vero SOLO quando l'altezza cambia perché sta partendo uno scorrimento tra le foto (vedi applyPosition), con
  // "destination" la foto verso cui parte: lì, se è più alta, il riquadro si allunga piano come quando si accorcia
  // (growTransitionFor). Per tutto il resto (trascinare una didascalia, ridimensionare una foto o la finestra, una foto che
  // arriva) si allunga subito, come prima: sono azioni in corso, il riquadro non può restare indietro.
  function updateViewportHeight(options) {
    const glide = Boolean(options && options.glide === true);
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
    // Il riquadro sta già andando proprio a quest'altezza (è il caso del giro interrotto da un altro scorrimento, vedi goTo): non lo si tocca.
    // Imporla di colpo, come fanno gli aggiornamenti senza "glide", farebbe saltare la foto di tutta la strada che le resta da fare.
    if (viewportTarget !== null && Math.abs(newHeightPx - viewportTarget) < 0.5 && viewportHeightAnimating()) return;
    const currentHeightPx = viewportBoxHeight();
    const setHeight = (px, transition) => {
      viewportTarget = px;
      if (transition !== undefined) viewport.style.transition = transition;
      viewport.style.height = `${px + viewportExt}px`; // l'estensione (se c'è) è sempre dentro l'altezza: vedi setViewportExtension
    };
    clearTimeout(viewportGrowTimer);
    if (newHeightPx > currentHeightPx) {
      // Se la foto in arrivo è più alta di quella attuale, "overflow: hidden" (necessario per lo slide orizzontale) taglia il
      // fondo della foto che entra finché il riquadro non ha finito di allungarsi (confermato: subito dopo l'inizio di una
      // transizione verso una foto molto più alta, il riquadro può restare centinaia di px più basso del necessario). Prima si
      // allungava di colpo: la barra con le frecce e il numero, e il fondo della pagina, SALTAVANO di colpo di qualche decina di
      // px (fino a 100) nello stesso istante in cui parte lo scorrimento. Poi si allungava in fretta (0,7-2,3 s), ma con la
      // barra tenuta ferma (startBarHold) quello è il movimento della foto sullo schermo, e a confronto con la «marea» lenta
      // dell'accorciamento (6 s) sembrava uno scatto a ogni foto più alta. Adesso è la stessa marea: growTransitionFor sceglie
      // il tempo più lungo che non tagli troppo la foto in arrivo, aiutato dall'estensione del bordo di taglio.
      // Il primo disegno della pagina (prima che le foto siano arrivate) resta istantaneo: lì non c'è nulla da animare.
      if (!glide || !firstLayoutSettled) {
        const prevTransition = viewport.style.transition;
        setHeight(newHeightPx, "none");
        viewport.getBoundingClientRect(); // forza il reflow prima di riattivare la transizione
        viewport.style.transition = prevTransition;
      } else {
        const room = Math.min(GROW_EXTENSION_MAX, Math.max(0, Math.floor(spacerBeforeBar.getBoundingClientRect().height)));
        const grow = growTransitionFor(options.destination, newHeightPx - currentHeightPx, bottom, room);
        growNote = `foto più alta di ${Math.round(newHeightPx - currentHeightPx)} px: ${grow.css ? `curva a S di ${grow.ms} ms` : `onda del foglio di stile (${Math.round(grow.ms)} ms)`}, bordo di taglio +${room} px`;
        setViewportExtension(room);
        setHeight(newHeightPx, grow.css);
        viewportGrowTimer = setTimeout(() => {
          if (grow.css) viewport.style.transition = ""; // torna la transizione del foglio di stile
          settleViewportExtension();
        }, grow.ms + 100);
      }
    } else {
      // Accorciarsi non taglia mai nulla: qui resta la transizione lenta del foglio di stile (la stessa dello scorrimento).
      if (glide) growNote = Math.abs(newHeightPx - currentHeightPx) < 0.5 ? "foto della stessa altezza" : `foto più bassa di ${Math.round(currentHeightPx - newHeightPx)} px: onda del foglio di stile (${TRANSITION_MS} ms)`;
      setHeight(newHeightPx, firstLayoutSettled ? "" : undefined); // "" toglie l'eventuale allungamento rapido ancora in corso
      if (viewportExt) viewportGrowTimer = setTimeout(settleViewportExtension, TRANSITION_MS + 150);
    }
  }

  // "height: false": solo il binario, senza toccare l'altezza del riquadro (la cambia la chiamata successiva, quella che anima davvero).
  function applyPosition({ instant = false, position = current, height = true } = {}) {
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
    if (height) updateViewportHeight({ glide: !instant, destination: track.children[position] });
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

  /* ---- Numero e frecce FERMI sullo schermo (solo computer) ----
     Quasi ogni foto ha un'altezza diversa dalla precedente, e con lei cambia l'altezza della pagina: se non si fa niente la barra col
     numero e le frecce, che sta in fondo alla pagina, sale e scende sullo schermo insieme alla foto. Qui è la barra a restare FERMA e la
     foto a salire o scendere: a ogni fotogramma, mentre l'altezza del riquadro cambia, la pagina viene spostata di quanto basta perché la
     barra stia sempre nello stesso punto dello schermo (startBarHold). Due casi, secondo che la barra si veda o no quando parte lo scorrimento:
     - la barra SI VEDE (anche solo in parte): resta dov'è, ovunque l'abbia messa l'utente con la pagina, o l'inquadratura di serie nel giro
       prima. La pagina non va mai da nessuna parte per conto suo, né dopo 15 secondi: la barra non cambia posto da uno scorrimento all'altro;
     - la barra NON si vede (la pagina è in cima a leggere il testo, o appena aperta): se la pagina è ferma da FRAME_QUIET_MS (e non c'è
       «riduci movimento», né la modalità modifica) è l'inquadratura di serie: la pagina scende (0,6-1,1 s, partenza e arrivo dolci) fino a
       mettere la barra in fondo alla finestra, e da lì la barra non si muove più. Se la foto più alta della galleria non ci sta insieme alla
       barra la cima di quella foto può restare fuori dalla finestra, fino a FRAME_MAX_TOP_CUT px; se ne resterebbe fuori di più (finestre basse,
       foto molto alte) la foto ha la precedenza e la barra sta più in basso, sotto il bordo, nel punto in cui la cima della foto più alta sta a
       FRAME_TOP_MARGIN dal bordo alto (FRAME_PHOTO_FIRST; con false la barra sta sempre in fondo): la stessa posizione per ogni foto.
       Se l'utente ha mosso la pagina da meno di FRAME_QUIET_MS non si fa niente.
     Mentre l'utente muove la pagina (rotella con la sua coda di inerzia, barra di scorrimento, mouse premuto) non la si tocca; quando smette
     (USER_INPUT_SETTLE_MS, e la pagina ha smesso di muoversi) la barra si tiene dove l'ha lasciata, se si vede. Si ferma del tutto se si ingrandisce una foto, si entra in modifica
     o si cambia pagina. Non c'è su telefono né su schermi tattili (il dito la muove già da solo).
     La posizione della barra si fotografa prima che la galleria cambi qualcosa (snapshotBar, all'inizio di goTo): a volte l'altezza cambia
     di colpo (il giro all'indietro dalla prima foto, il primo secondo e mezzo dopo l'apertura) e la barra «salta» fuori dalla finestra prima
     di poterla guardare.
     Fluidità: niente animazioni CSS né scorrimento «smooth» del browser, che ripartirebbero a ogni fotogramma mentre l'altezza cambia: a
     ogni fotogramma (dopo l'aggiornamento delle transizioni, prima del disegno) si guarda dov'è la barra adesso e si rimette la pagina
     a posto; in fondo si resta sull'ultimo punto possibile della pagina (lo stabilisce il browser: sugli schermi retina anche mezzo pixel). */
  const USER_INPUT_SETTLE_MS = 150; // l'utente ha finito il gesto (rotella, tasti) quando non ne arrivano più da questo tempo
  const FRAME_QUIET_MS = 15000; // un po' più del ciclo dell'autoplay (12 s): chi scorre in su a leggere non viene riportato giù al giro dopo
  const FRAME_APPROACH_MIN_MS = 600;
  const FRAME_APPROACH_MAX_MS = 1100;
  const FRAME_PHOTO_FIRST = true; // false: la barra sta sempre in fondo, anche se la cima di una foto alta resta fuori dalla finestra
  const FRAME_MAX_TOP_CUT = 200; // px di cima della foto più alta che possono restare fuori dalla finestra pur di avere la barra in fondo
  const FRAME_TOP_MARGIN = 24; // px tra il bordo alto della finestra e la cima della foto più alta, quando la foto ha la precedenza
  let framing = null;

  const pageMaxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const barTopInPage = () => footerBar.getBoundingClientRect().top + window.scrollY;
  // Dove sta la cima della barra sullo schermo quando la pagina è scorsa fino in fondo (la barra è l'ultima cosa della pagina, con sotto
  // solo lo spazio finale): più su di così non può stare.
  const barYAtPageEnd = () => window.innerHeight - (document.documentElement.scrollHeight - barTopInPage());
  // Dove deve stare la cima della barra sullo schermo perché la foto più alta della galleria si veda intera, dalla cima in giù. È una
  // misura sola per tutta la galleria: dalla cima della foto alla cima della barra c'è (altezza della foto con la sua didascalia + spazio
  // prima delle frecce) e cambia da foto a foto.
  const barYForTallestPhoto = () => {
    const viewportRect = viewport.getBoundingClientRect();
    const gapToBar = footerBar.getBoundingClientRect().top - viewportRect.bottom + viewportExt; // senza l'estensione temporanea del riquadro
    let need = 0;
    figures.forEach((figure) => {
      const frame = figure.querySelector(".photo-frame");
      if (!frame) return;
      let bottom = figure.getBoundingClientRect().bottom;
      figure.querySelectorAll(".photo-frame, .caption-box").forEach((node) => { bottom = Math.max(bottom, node.getBoundingClientRect().bottom); });
      const frameOffset = frame.getBoundingClientRect().top - viewportRect.top;
      need = Math.max(need, bottom - viewportRect.top + gapToBar - frameOffset);
    });
    return FRAME_TOP_MARGIN + need;
  };
  const setPageScroll = (y) => {
    noteProgrammaticScroll();
    try { window.scrollTo({ top: y, left: window.scrollX, behavior: "instant" }); } catch (e) { window.scrollTo(window.scrollX, y); }
  };
  const viewportHeightAnimating = () => typeof viewport.getAnimations === "function"
    && viewport.getAnimations().some((animation) => animation.playState === "running" && /height/.test(String(animation.transitionProperty || "")));
  const prefersReducedMotion = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Perché la barra NON si può tenere ferma adesso (null = si può). "singlePhoto": anche una galleria di una foto sola (l'accompagnamento
  // verso il fondo vale per tutte le pagine di progetto: la barra col numero e le frecce c'è in tutte).
  function barHoldBlocker({ singlePhoto = false } = {}) {
    if (figures.length < 2 && !singlePhoto) return "galleria di una foto sola";
    if (lightboxHold) return "foto ingrandita";
    if (isMobileViewport()) return "telefono";
    if (document.hidden) return "scheda in secondo piano";
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) return "schermo tattile";
    if (isPointerHeld()) return "pulsante del mouse premuto";
    if (!(pageMaxScroll() > 2)) return "la pagina sta tutta nella finestra";
    return null;
  }

  // Mentre si tiene ferma la barra, solo noi muoviamo la pagina: il browser non deve spostarla per conto suo ("overflow-anchor", l'ancoraggio
  // dello scorrimento di Chrome e Firefox, che tiene ferma la parte che si sta guardando quando sopra cambia l'altezza) o si confonderebbe
  // con il movimento dell'utente.
  const setPageAnchoring = (on) => { document.documentElement.style.overflowAnchor = on ? "" : "none"; };

  function stopBarHold() {
    if (!framing) return;
    cancelAnimationFrame(framing.raf);
    framing = null;
    setPageAnchoring(true);
  }

  // Dove sta la barra sullo schermo, fotografata PRIMA che la galleria cambi qualcosa (vedi goTo)
  function snapshotBar() {
    const startY = window.scrollY;
    return { startY, barY0: barTopInPage() - startY, quiet: performance.now() - lastUserScrollAt >= FRAME_QUIET_MS };
  }

  // Dove deve stare la cima della barra sullo schermo nell'inquadratura di serie: in fondo alla finestra (fine della pagina). Se per questo la cima
  // della foto più alta resterebbe fuori dalla finestra per più di FRAME_MAX_TOP_CUT px (portatili, foto molto alte) la foto ha la precedenza: la
  // barra sta più in basso, sotto il bordo.
  function framingHoldY() {
    const endY = barYAtPageEnd();
    if (FRAME_PHOTO_FIRST) {
      const photoY = barYForTallestPhoto();
      if (photoY - FRAME_TOP_MARGIN - endY > FRAME_MAX_TOP_CUT) return photoY;
    }
    return endY;
  }

  // "accompany": non è uno scorrimento della galleria ma l'accompagnamento verso il fondo dopo che l'utente è sceso a metà pagina (vedi più sotto):
  // porta la pagina all'inquadratura di serie qualunque sia l'ora e anche se la barra si vede già, senza le condizioni dello scorrimento
  // (pagina ferma da 15 s...), che le ha già controllate chi lo chiama.
  function startBarHold(before, { accompany = false, takeover = false } = {}) {
    const blocker = barHoldBlocker({ singlePhoto: accompany });
    if (blocker) { logFraming({ ran: false, why: blocker, grow: growNote, assist: accompany }); return; }
    stopBarHold(); // un nuovo scorrimento riparte da dove si trova la vista adesso
    const { startY, barY0, quiet } = before;
    const endY = barYAtPageEnd();
    let holdY; // dove deve stare la cima della barra sullo schermo, per tutta la durata
    let mode;
    let why = "";
    if (!accompany && barY0 < window.innerHeight - 1) {
      holdY = Math.max(endY, barY0); // la barra si vede: resta dov'è
      mode = "tenuta";
    } else {
      if (!accompany) {
        why = isEditMode() ? "modalità modifica" : prefersReducedMotion() ? "riduci movimento" : !quiet ? "pagina mossa da poco" : "";
        if (why) { logFraming({ ran: false, why: `la barra non si vede (${why}): niente da tenere fermo`, grow: growNote }); return; }
      }
      holdY = framingHoldY(); // inquadratura di serie
      mode = "discesa";
    }
    const distance = Math.abs(Math.max(0, Math.min(pageMaxScroll(), barTopInPage() - holdY)) - startY);
    const state = {
      startY,
      holdY,
      mode,
      startedAt: performance.now(),
      approachMs: mode === "tenuta" || distance < 4 ? 0
        : takeover ? Math.min(ASSIST_GLIDE_MAX_MS, Math.max(ASSIST_GLIDE_MIN_MS, 520 + distance * 0.6))
        : Math.min(FRAME_APPROACH_MAX_MS, Math.max(FRAME_APPROACH_MIN_MS, 500 + distance * 0.5)),
      lastY: startY, // dove l'abbiamo messa l'ultima volta (come l'ha accettata il browser)
      assist: accompany, // vero finché la pagina sta venendo accompagnata verso il fondo (vedi goTo: uno scorrimento che parte intanto non la interrompe)
      takeover, // l'accompagnamento è partito subito, dal primo scatto di rotella o dal primo tasto (curva che parte svelta: ASSIST_GLIDE_CURVE)
      approaching: false,
      raf: 0,
    };
    state.approaching = state.approachMs > 0; // (dal primo fotogramma: chi guarda subito dopo, goTo e l'accompagnamento, deve già saperlo)
    framing = state;
    setPageAnchoring(false);
    logFraming({ ran: true, mode, why, holdY: Math.round(holdY), endY: Math.round(endY), grow: growNote, assist: accompany, fromY: Math.round(startY) });
    const step = (now) => {
      if (framing !== state) return;
      const max = pageMaxScroll(); // (forza il calcolo della pagina di questo fotogramma, che comunque servirebbe)
      // Qualcuno ha mosso la pagina senza che l'abbiamo fatto noi (la coda di una rotella, la barra di scorrimento)? Dove dovrebbe
      // essere: dov'era, o più su se la pagina si è accorciata (il browser la ferma da solo al nuovo fondo).
      // (Durante un accompagnamento gli scatti di rotella e i tasti che il sito ha assorbito, assistConsumedAt, non sono l'utente che muove la pagina.)
      const absorbed = state.assist && performance.now() - assistConsumedAt < 250;
      const moved = !absorbed && Math.abs(window.scrollY - Math.min(state.lastY, max)) > 2.5;
      if (moved) noteUserScroll();
      const barY = barTopInPage() - window.scrollY; // dov'è adesso la cima della barra sullo schermo
      let approaching = false;
      if (moved || isPointerHeld() || (performance.now() - lastUserInputAt < USER_INPUT_SETTLE_MS && !(state.assist && lastUserInputAt <= assistConsumedAt))) {
        // L'utente sta muovendo la pagina: non la si tocca. Quando smette, la barra si tiene dove l'ha lasciata (e la discesa è finita).
        state.mode = "tenuta";
        state.approachMs = 0;
        state.holdY = Math.max(barYAtPageEnd(), barY);
        state.lastY = window.scrollY;
      } else if (state.mode === "tenuta" && !(state.holdY < window.innerHeight - 1)) {
        state.lastY = window.scrollY; // il punto in cui tenerla non si vede (l'utente guarda altro): niente da tenere fermo, la pagina non si sposta
      } else {
        const target = Math.max(0, Math.min(max, barTopInPage() - state.holdY)); // dove deve stare la pagina in questo fotogramma
        const p = state.approachMs ? Math.min(1, Math.max(0, (now - state.startedAt) / state.approachMs)) : 1;
        approaching = p < 1;
        if (approaching) {
          const eased = state.takeover ? bezierProgressAt(ASSIST_GLIDE_CURVE, p) // risponde subito e frena piano, come dopo una spinta
            : p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // partenza e arrivo dolci
          setPageScroll(state.startY + (target - state.startY) * eased);
        } else {
          // In fondo: oltre il fondo, il browser la porta all'ultimo punto possibile (anche mezzo pixel su retina). Fermata prima: proprio lì.
          setPageScroll(target >= max - 0.5 ? max + 1000 : target);
        }
        state.lastY = window.scrollY;
      }
      state.approaching = approaching;
      if (!approaching && !viewportHeightAnimating()) { framing = null; setPageAnchoring(true); return; } // a posto, e la pagina non cambia più altezza
      state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  }

  /* ---- Accompagnamento verso il fondo ----
     Chi scende per vedere le foto e si ferma a metà (la barra col numero e le frecce ancora fuori dalla finestra, o a mezzo schermo) non resta
     lì: la pagina viene portata in fondo, all'inquadratura di serie (barra in fondo alla finestra; per le foto molto alte su finestre basse dove
     la cima della foto più alta sta a FRAME_TOP_MARGIN dal bordo alto: framingHoldY). Da lì la barra resta ferma mentre la galleria scorre
     (startBarHold). Due strade, la prima senza nessuna pausa:
     1. SUBITO (onAssistWheel, onAssistKey): al primo scatto di rotella, o primo movimento di trackpad, o tasto ↓ Pag↓ Spazio, verso il basso, il
        sito si prende il gesto (preventDefault: la pagina non si muove per conto suo) e porta la pagina in fondo con un movimento che parte subito
        e frena piano (ASSIST_GLIDE_CURVE, da 0,65 a 1,2 s secondo la strada). Gli scatti che seguono (anche la coda di inerzia del trackpad)
        vengono assorbiti finché fanno parte della stessa sequenza (meno di ASSIST_GAP_MS tra uno e l'altro); un gesto nuovo ricomincia da capo.
     2. DOPO UNA PAUSA (onAssistScroll, assistSettled), per ciò che non si può prendere al volo (la barra di scorrimento col mouse premuto, un browser
        che non lascia annullare la rotella): finito il gesto, ASSIST_SETTLE_MS senza altri movimenti, la pagina scende in fondo con lo stesso movimento.
     Regole (valgono per tutte e due):
     - solo verso il BASSO: chi sale, per leggere il testo o vedere la cima della foto, non viene toccato (la rotella in su ferma subito la discesa);
     - solo se la pagina sta prima dell'inquadratura: chi è già lì, o più in giù (per vedere la barra sotto il bordo), scorre come sempre;
     - non c'è dove non c'è l'inquadratura di serie (telefono, schermi tattili), con una foto ingrandita, in modifica, con «riduci movimento», a mouse
       premuto, con la rotella su un elemento che scorre per conto suo, con Ctrl/Cmd/Maiusc (zoom, scorrimento di lato);
     - se uno scorrimento della galleria parte mentre la pagina scende, la discesa non si interrompe (goTo). */
  const ASSIST_GLIDE_MIN_MS = 650; // durata dell'accompagnamento che parte subito: 520 ms + 0,6 ms per px di strada, tra questi due limiti
  const ASSIST_GLIDE_MAX_MS = 1200;
  const ASSIST_GLIDE_CURVE = [0.16, 0, 0.12, 1]; // in 50 ms è già a velocità piena (picco 2,9 volte la media a un decimo del tempo), poi frena piano
  const ASSIST_GAP_MS = 250; // due scatti di rotella più vicini di così sono la stessa sequenza (un gesto di trackpad con la sua coda di inerzia, o i colpi di una rotella)
  const ASSIST_SETTLE_MS = 250; // strada 2: pausa dell'utente (nessun movimento, nessun tasto, mouse non premuto) dopo la quale la pagina viene accompagnata
  const ASSIST_MIN_PX = 32; // strada 2: quanto deve essere sceso, nel gesto, perché valga come «sta andando a vedere le foto»
  const ASSIST_INPUT_MS = 300; // strada 2: un movimento della pagina viene dall'utente se la rotella o un tasto sono arrivati da meno di così
  let assistWheelAt = -Infinity; // l'ultimo scatto di rotella, di qualunque verso
  let assistUpAt = -Infinity; // l'ultimo scatto verso l'alto: subito dopo, un piccolo scatto in giù è solo il rimbalzo di un gesto in su e non vale
  let assistConsuming = false; // la sequenza di rotella in corso è stata presa dal sito
  let assistConsumedAt = -Infinity; // l'ultimo scatto o tasto assorbito (per startBarHold: non è l'utente che muove la pagina)
  let assistGlideAt = -Infinity; // quando è partito l'ultimo accompagnamento immediato
  let assistBlockedLogAt = -Infinity;
  let assistLastNote = "nessuna rotella né tasto da quando la pagina è aperta"; // cosa ha deciso il sito all'ultima rotella o all'ultimo tasto (lo legge il contatore di fluidità)
  const assistNote = (text) => { assistLastNote = `${text} (alle ${new Date().toLocaleTimeString()})`; };
  let assistPrevY = window.scrollY;
  let assistStartY = null; // strada 2: dov'era la pagina quando è cominciato il gesto
  let assistDir = 0; // strada 2: verso dell'ultimo movimento chiesto dall'utente: 1 in giù, -1 in su
  let assistTimer = null;

  const assistBlocker = () => barHoldBlocker({ singlePhoto: true }) || (isEditMode() ? "modalità modifica" : prefersReducedMotion() ? "riduci movimento" : null);
  const assistTargetY = () => Math.max(0, Math.min(pageMaxScroll(), barTopInPage() - framingHoldY())); // dove sta la pagina all'inquadratura di serie
  const assistGliding = () => Boolean(framing && framing.assist && framing.takeover && framing.approaching);

  // Un elemento che scorre per conto suo (una finestra con la barra di scorrimento): la rotella lì non è per la pagina.
  function insideScroller(node) {
    for (let el = node; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      const overflowY = getComputedStyle(el).overflowY;
      if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) return true;
    }
    return false;
  }

  // Parte l'accompagnamento immediato, se si può e se la pagina è prima dell'inquadratura. Restituisce null se è partito, altrimenti il perché no.
  function assistTakeOver() {
    const blocker = assistBlocker();
    if (blocker) {
      if (performance.now() - assistBlockedLogAt > 1500) { assistBlockedLogAt = performance.now(); logFraming({ ran: false, why: blocker, assist: true }); }
      return blocker;
    }
    if (window.scrollY >= assistTargetY() - 4) return "la pagina è già all'inquadratura (o più in giù)";
    startBarHold(snapshotBar(), { accompany: true, takeover: true });
    assistGlideAt = performance.now();
    return assistGliding() ? null : "l'accompagnamento non è partito";
  }

  function onAssistWheel(e) {
    const now = performance.now();
    const fresh = now - assistWheelAt > ASSIST_GAP_MS; // primo scatto di un gesto (o di uno scatto di mouse dopo una pausa)
    assistWheelAt = now;
    if (fresh) assistConsuming = false;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // zoom, scorrimento di lato
    if (e.deltaY < 0) { assistConsuming = false; assistUpAt = now; if (fresh) assistNote("rotella verso l'alto: lasciata all'utente"); return; } // verso l'alto: è dell'utente (startBarHold ferma l'accompagnamento in corso)
    if (assistConsuming || assistGliding()) {
      // La sequenza è del sito: gli scatti in più e la coda di inerzia del trackpad non muovono la pagina da soli.
      // (Sicurezza: se la discesa non c'è più da un pezzo, o si è ingrandita una foto o si è entrati in modifica, la rotella torna dell'utente.)
      if ((now - assistGlideAt > 6000 && !assistGliding()) || lightboxHold || isEditMode()) { assistConsuming = false; return; }
      if (e.cancelable) e.preventDefault();
      assistConsumedAt = now;
      return;
    }
    // (Anche a gesto già cominciato: un trackpad può cominciare con scatti nulli o di lato. Non dopo uno scatto in su: sarebbe il rimbalzo di quel gesto.)
    if (e.deltaY === 0) return;
    if (now - assistUpAt < 400) { assistNote("rotella in giù subito dopo una in su: è il rimbalzo di quel gesto, lasciata all'utente"); return; }
    if (!e.cancelable) { assistNote("il browser non lascia annullare questa rotella: ci pensa la pausa (strada 2)"); return; }
    if (insideScroller(e.target)) { assistNote("rotella sopra un elemento che scorre per conto suo: lasciata a lui"); return; }
    const why = assistTakeOver();
    if (why) { assistNote(`rotella in giù NON presa: ${why}`); return; }
    e.preventDefault();
    assistConsuming = true;
    assistConsumedAt = now;
    assistNote("rotella in giù presa: la pagina scende da sola");
  }

  function onAssistKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const space = e.key === " " || e.key === "Spacebar";
    if (!(e.key === "ArrowDown" || e.key === "PageDown" || (space && !e.shiftKey))) return;
    const target = e.target;
    if (target && target.closest && target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) return; // scrive o sceglie
    if (space && target && target.closest && target.closest("button, a, summary")) return; // lo Spazio su un pulsante lo preme
    if (!assistGliding()) {
      const why = assistTakeOver();
      if (why) { assistNote(`tasto ${e.key === " " ? "Spazio" : e.key} NON preso: ${why}`); return; }
      assistNote(`tasto ${e.key === " " ? "Spazio" : e.key} preso: la pagina scende da sola`);
    }
    e.preventDefault();
    assistConsumedAt = performance.now();
  }

  function onAssistScroll() {
    const y = window.scrollY;
    const dy = y - assistPrevY;
    assistPrevY = y;
    // Il movimento è dell'utente se ha appena usato la rotella o un tasto (lo scorrimento «dolce» del browser dura al massimo 0,3 s dopo l'ultimo
    // input: più breve della pausa ASSIST_SETTLE_MS, così l'accompagnamento, che parte dopo la pausa, non si scambia mai per l'utente) o ha il
    // mouse premuto (barra di scorrimento). Se l'utente muove la pagina mentre viene accompagnata, la rotella arriva prima del suo movimento: conta.
    if (Math.abs(dy) < 0.5 || assistGliding() || !(performance.now() - lastUserInputAt < ASSIST_INPUT_MS || isPointerHeld())) return; // (la discesa del sito non conta)
    if (assistStartY === null) assistStartY = y - dy;
    assistDir = dy > 0 ? 1 : -1;
    clearTimeout(assistTimer);
    assistTimer = setTimeout(assistSettled, ASSIST_SETTLE_MS);
  }

  function assistSettled() {
    assistTimer = null;
    if (assistGliding()) { assistStartY = null; assistDir = 0; return; } // la pagina sta già scendendo (strada 1): niente da fare
    // Il gesto non è davvero finito (la rotella continua, il mouse è ancora premuto sulla barra di scorrimento): si riprova più tardi
    if (isPointerHeld() || performance.now() - lastUserInputAt < ASSIST_SETTLE_MS) { assistTimer = setTimeout(assistSettled, ASSIST_SETTLE_MS); return; }
    const startY = assistStartY;
    const dir = assistDir;
    assistStartY = null;
    assistDir = 0;
    if (startY === null || dir <= 0 || window.scrollY - startY < ASSIST_MIN_PX) return; // verso l'alto, o troppo poco: la pagina resta dov'è
    const blocker = assistBlocker();
    if (blocker) { logFraming({ ran: false, why: blocker, assist: true }); return; }
    if (window.scrollY >= assistTargetY() - 4) return; // già all'inquadratura, o più in giù
    startBarHold(snapshotBar(), { accompany: true, takeover: true });
  }

  window.addEventListener("wheel", onAssistWheel, { passive: false }); // (non passivo: deve poter annullare la rotella)
  window.addEventListener("keydown", onAssistKey);
  window.addEventListener("scroll", onAssistScroll, { passive: true });
  // Per il contatore di fluidità: l'accompagnamento è attivo adesso, o cosa lo ferma
  const assistState = () => ({ blocker: assistBlocker(), y: Math.round(window.scrollY), target: Math.round(assistTargetY()), last: assistLastNote });
  window.__assistState = assistState;

  function goTo(i, { user = false } = {}) {
    if (isAnimating) return;
    if (!figures.length) return;
    if (lightboxHold) return; // una foto è ingrandita: la galleria dietro sta ferma (vedi holdGallery)
    const barBefore = snapshotBar(); // dov'è la barra sullo schermo prima che cambi l'altezza (vedi sopra)
    const carrying = Boolean(framing && framing.assist && framing.approaching); // la pagina sta venendo accompagnata in fondo: continua da sola

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
      // "finish" è quello che si fa a transizione finita: lo tiene a parte anche holdGallery/releaseGallery, per
      // poterlo rimandare se la galleria viene fermata a metà (una foto ingrandita).
      const finish = () => {
        clone.remove();
        applyPosition({ instant: true, position: current }); // current = 0, identico al clone: nessun cambiamento visibile
        pendingWrapCleanup = null;
      };
      pendingWrapCleanup = {
        finish,
        timer: setTimeout(finish, TRANSITION_MS),
        cleanup: () => { clone.remove(); applyPosition({ instant: true, position: current }); },
      };
    } else if (wrapBackward) {
      const clone = makePhotoClone(n - 1);
      track.insertBefore(clone, track.firstChild);
      // Inserire il clone in testa sposta la foto reale attuale (era in
      // posizione 0) alla posizione 1: la riancoriamo lì all'istante,
      // senza transizione, così finora non è cambiato nulla di visibile.
      applyPosition({ instant: true, position: 1, height: false }); // l'altezza la cambia la riga sotto, dolcemente: prima, se l'ultima foto è più alta, il riquadro si allungava di colpo
      applyPosition({ position: 0 }); // un passo indietro normale, verso il clone appena aggiunto in testa
      const finish = () => {
        clone.remove();
        applyPosition({ instant: true, position: current }); // current = n-1, identico al clone: nessun cambiamento visibile
        pendingWrapCleanup = null;
      };
      pendingWrapCleanup = {
        finish,
        timer: setTimeout(finish, TRANSITION_MS),
        cleanup: () => { clone.remove(); applyPosition({ instant: true, position: current }); },
      };
    } else {
      applyPosition();
    }

    if (user) restartAutoplay();
    // La barra col numero e le frecce resta ferma sullo schermo mentre cambia l'altezza (e, a pagina ferma, la pagina scende in fondo): vedi sopra.
    // Se la pagina sta già scendendo in fondo accompagnata, il suo movimento segue la barra anche mentre l'altezza cambia: ripartire la farebbe fermare un attimo.
    if (!carrying) startBarHold(barBefore);
  }

  function scheduleNext() {
    clearTimeout(autoplayTimer);
    if (paused || lightboxHold || figures.length < 2 || document.hidden || isEditMode()) return;
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
    if (isEditMode()) { clearTimeout(autoplayTimer); stopBarHold(); }
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

  // Una foto della galleria viene ingrandita (evento "zoom-opened", vedi makeZoomable): la galleria si ferma
  // ESATTAMENTE dov'è — anche a metà di uno scorrimento — e non ne parte nessun altro. Prima continuava ad andare
  // dietro la foto ingrandita: chiudendo, la miniatura si era spostata (o era uscita dallo schermo) e la foto non
  // sapeva più dove tornare. Appena la foto è tornata al suo posto ("zoom-closed") la galleria riprende da dove
  // era, con il tempo che le restava.
  function holdGallery() {
    if (lightboxHold) return;
    lightboxHold = true;
    stopBarHold(); // la pagina dietro la foto ingrandita non si muove più da sola
    heldAt = performance.now();
    clearTimeout(autoplayTimer);
    heldAnimations = [];
    [track, viewport].forEach((node) => {
      if (typeof node.getAnimations !== "function") return;
      node.getAnimations().forEach((animation) => {
        if (animation.playState === "running") {
          animation.pause();
          heldAnimations.push(animation);
        }
      });
    });
    // La pulizia che chiude un giro (clone della foto) non deve scattare mentre tutto è fermo
    if (pendingWrapCleanup) clearTimeout(pendingWrapCleanup.timer);
  }
  function releaseGallery() {
    if (!lightboxHold) return;
    lightboxHold = false;
    const heldFor = performance.now() - heldAt;
    // Se il riquadro stava ancora cambiando altezza (foto ingrandita a metà di un allungamento o di un accorciamento), alla
    // ripresa la barra col numero torna a stare ferma da dov'è: altrimenti il riquadro finirebbe di cambiare altezza e la
    // barra se ne andrebbe con lui (fino a 330 px, anche fuori dalla finestra)
    const heightWasChanging = heldAnimations.some((animation) => /height/.test(String(animation.transitionProperty || "")));
    heldAnimations.forEach((animation) => { try { animation.play(); } catch (e) { /* già finita o annullata */ } });
    heldAnimations = [];
    if (heightWasChanging) startBarHold(snapshotBar());
    settleViewportExtension(); // se nessun allungamento è ancora in corso, il bordo di taglio torna al suo posto
    lastTransitionStart += heldFor; // le transizioni fermate riprendono con il tempo che restava
    if (pendingWrapCleanup) {
      const remaining = Math.max(0, TRANSITION_MS - (performance.now() - lastTransitionStart));
      pendingWrapCleanup.timer = setTimeout(pendingWrapCleanup.finish, remaining);
    }
    if (!paused) scheduleNext();
  }
  window.addEventListener("zoom-opened", holdGallery);
  window.addEventListener("zoom-closed", releaseGallery);

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
    if (lightboxHold) return; // foto ingrandita: le frecce non fanno scorrere la galleria dietro
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
  // La didascalia e le maniglie di modifica non sono "margine": con una didascalia più larga della foto (e le sue maniglie
  // ai lati) un clic lì cadeva fuori dal riquadro della foto e faceva scorrere la galleria. Vale anche per un trascinamento
  // cominciato su una maniglia e finito fuori da essa (maniglia ferma al limite, mouse più in là): il browser manda il "click"
  // all'elemento comune a punto di partenza e di arrivo, cioè alla galleria stessa — quindi si ricorda dove è cominciata la pressione.
  const EDITING_PARTS = ".caption-box, .resize-handle, .move-handle";
  let pressStartedOnEditing = false;
  viewport.addEventListener("pointerdown", (e) => {
    pressStartedOnEditing = !!(e.target.closest && e.target.closest(EDITING_PARTS));
  }, true);
  viewport.addEventListener("click", (e) => {
    if (figures.length < 2) return;
    if (pressStartedOnEditing || (e.target.closest && e.target.closest(EDITING_PARTS))) { pressStartedOnEditing = false; return; }
    const activeFrame = figures[current].querySelector(".photo-frame");
    const r = activeFrame.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom) return; // sopra/sotto la foto (didascalia, margini): non fare nulla
    if (e.clientX < r.left) goTo(current - 1, { user: true });
    else if (e.clientX > r.right) goTo(current + 1, { user: true });
  });

  viewport.addEventListener("mouseenter", () => { if (!isTouchEcho()) handlePause(); });
  viewport.addEventListener("mouseleave", handleResume);
  viewport.addEventListener("touchstart", handlePause, { passive: true });

  // swipe orizzontale su touch. Conta solo se il movimento è più orizzontale che verticale: scorrere la pagina col pollice
  // (quasi sempre con un po' di deriva laterale, 40px bastano) cambiava la foto per errore.
  let touchStartX = null;
  let touchStartY = null;
  viewport.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goTo(current + (dx < 0 ? 1 : -1), { user: true });
    touchStartX = null;
    handleResume();
  });
  // Se il browser prende in mano il gesto (es. comincia a scorrere la pagina) può mandare "touchcancel" invece di "touchend":
  // senza questo la galleria restava in pausa.
  viewport.addEventListener("touchcancel", () => { touchStartX = null; handleResume(); }, { passive: true });

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
    const contentDefault = pickLayout(images[i].width || images[i].height, mobileOverride, (phoneLayoutFromDesktop(images[i]) || {}).width);
    return !((saved && (saved.width || saved.height)) || contentDefault);
  }
  // Misura (larghezza, altezza) della foto i: quella letta in anticipo da images-data.js se c'è,
  // altrimenti quella del file vero quando è arrivato (mai quella del pixel segnaposto).
  function photoSize(i) {
    const known = knownImageSize(images[i].src);
    if (known) return known;
    const img = figures[i].querySelector("img");
    if (img && img.dataset.ready && img.naturalWidth && img.naturalHeight) return [img.naturalWidth, img.naturalHeight];
    return null;
  }
  function widestUntouchedRatio() {
    let widest = 0;
    figures.forEach((figure, i) => {
      if (!isUntouched(i)) return;
      const size = photoSize(i);
      if (size) widest = Math.max(widest, size[0] / size[1]);
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
      const img = frame.querySelector("img");
      const size = photoSize(i);
      if (size) {
        // Misura nota in anticipo: la cornice combacia ESATTAMENTE con la foto (stessa altezza per tutte,
        // mai oltre la larghezza disponibile né oltre la grandezza del file), senza bande vuote ai lati
        // e senza aspettare che il file arrivi.
        const width = Math.min(availableWidth, targetHeight * (size[0] / size[1]), size[0]);
        frame.style.width = `${Math.round(width * 100) / 100}px`;
        frame.style.maxHeight = "";
        if (img) img.style.maxHeight = "";
      } else {
        frame.style.width = "auto";
        frame.style.maxHeight = `${targetHeight}px`;

        // Assicuriamoci che l'immagine interna non sfori l'altezza massima
        // e scali proporzionalmente
        if (img) img.style.maxHeight = `${targetHeight}px`;
      }
    });
    updateViewportHeight();
  }
  applyDefaultPhotoHeights();
  // Su iPhone/iPad la barra del browser che si nasconde mentre scorri cambia l'altezza della finestra di
  // qualche decina di pixel: non è un vero ridimensionamento e non deve far "saltare" le foto.
  const isTouchScreen = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  let lastWindowWidth = window.innerWidth;
  let lastWindowHeight = window.innerHeight;
  const onWindowResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (isTouchScreen && w === lastWindowWidth && Math.abs(h - lastWindowHeight) < 160) return;
    lastWindowWidth = w;
    lastWindowHeight = h;
    applyDefaultPhotoHeights();
  };
  window.addEventListener("resize", onWindowResize);

  // Le foto senza misura nota in anticipo (es. caricate con "+") scoprono la propria misura solo quando
  // arrivano: ricalcoliamo (e aggiorniamo anche l'altezza del viewport se è quella
  // corrente) man mano che arrivano, così il tetto in larghezza si
  // aggiorna quando si scopre una foto più orizzontale di quanto sapessimo.
  figures.forEach((figure, i) => {
    const img = figure.querySelector("img");
    img.addEventListener("load", () => {
      if (!img.dataset.ready) return; // è solo il pixel segnaposto, non ancora la foto vera
      applyDefaultPhotoHeights();
      if (i === current) updateViewportHeight();
      if (i === 0) settleFirstLayout();
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
    window.removeEventListener("edit-mode-toggled", updateDescEditable);
    window.removeEventListener("zoom-opened", holdGallery);
    window.removeEventListener("zoom-closed", releaseGallery);
    document.removeEventListener("keydown", onKeyDown);
    clearTimeout(autoplayTimer);
    stopBarHold();
    window.removeEventListener("wheel", onAssistWheel);
    window.removeEventListener("keydown", onAssistKey);
    window.removeEventListener("scroll", onAssistScroll);
    clearTimeout(assistTimer);
    if (window.__assistState === assistState) delete window.__assistState;
    if (pendingWrapCleanup) clearTimeout(pendingWrapCleanup.timer);
    cancelAnimationFrame(marqueeRafId);
    document.removeEventListener("pointermove", onMarqueeDragMove);
    document.removeEventListener("pointerup", onMarqueeDragEnd);
    window.removeEventListener("resize", updateViewportHeight);
    window.removeEventListener("resize", onWindowResize);
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
    renderMissingPage();
    return;
  }
  const myRoute = routeCounter; // vedi renderRoute: serve a non disegnare una pagina ormai superata
  
  // Il testo di ogni progetto sta in testi/<slug>.txt, oppure in testi/<nome del progetto>.txt (vedi projectTextFile). L'indirizzo
  // è RELATIVO (non "/testi/...": quello cerca la cartella in cima al dominio e, sul sito pubblicato dentro "/Website/", non la
  // trova mai) e si scarica solo se il file esiste davvero (elenco in images-data.js): niente 404 a vuoto.
  let descText = "";
  const knownTexts = window.DYNAMIC_TEXTS;
  const textFile = projectTextFile(project);
  if (!Array.isArray(knownTexts) || knownTexts.some((file) => file.toLowerCase() === `${textFile}.txt`.toLowerCase())) {
    try {
      const res = await fetch(`testi/${encodeURIComponent(textFile)}.txt?v=${IS_PUBLISHED_BUILD ? IMAGE_VERSION : Date.now()}`);
      if (res.ok) {
        descText = await res.text();
        // Rimuovi eventuali spazi bianchi superflui all'inizio/fine
        descText = descText.trim();
      }
    } catch (e) {
      console.warn("Nessun file di testo trovato per", project.slug);
    }
  }

  // Se nel frattempo hai già cambiato pagina (clic veloce, o primo caricamento lento), questa non va più disegnata:
  // altrimenti comparirebbe sopra quella nuova, "rotta" o con le foto sbagliate.
  if (myRoute !== routeCounter) return;

  // Controllo "a tentativi" di nuove immagini nella cartella: serve solo se manca l'elenco
  // generato (images-data.js), che le trova già tutte senza provare indirizzi a caso (e senza 404).
  if (!Array.isArray(window.DYNAMIC_IMAGES)) autoDetectImages(project, project.slug);

  const galleryKey = `project.${project.slug}`;
  const orderKey = `${galleryKey}.imageOrder`;
  const order = currentImageOrder(orderKey, project.images.length);
  const baseImages = order.map((origIndex) => {
    const img = project.images[origIndex];
    if (!img) return null; // Fallback se c'erano id invalidi (es. extra images) salvati per sbaglio
    return { ...img, _index: origIndex, _src: resolveImageSrc(project.slug, origIndex, img) };
  }).filter(Boolean);
  const images = applyImageOverrides(galleryKey, project.slug, baseImages);

  let orderedProjects = getOrderedProjects();
  let idx = orderedProjects.findIndex((p) => p.slug === project.slug);
  if (idx === -1) {
    // Pagina tolta dalla home (resta raggiungibile dall'indirizzo): le frecce usano l'ordine di content.js
    orderedProjects = PROJECTS;
    idx = orderedProjects.findIndex((p) => p.slug === project.slug);
  }
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
    renderMissingPage();
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
function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Nei contatti un indirizzo email diventa un collegamento "mailto:" (era solo testo: su computer non si poteva cliccare).
// Stesso colore e stesso carattere del resto; si sottolinea solo al passaggio del mouse (vedi ".mail-link" in style_v58.css).
function contactValueHtml(value) {
  const text = String(value).trim();
  if (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(text)) return `<a class="mail-link" href="mailto:${escapeHtml(text)}">${escapeHtml(text)}</a>`;
  return escapeHtml(value);
}

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
    // "etichetta — valore"; senza etichetta, solo il valore (nei contatti: solo l'indirizzo email, senza la parola «email»)
    extraLines.forEach((line) => allText.push(line.label ? `${escapeHtml(line.label)} — ${contactValueHtml(line.value)}` : contactValueHtml(line.value)));
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

  // Larghezza e posizione di partenza del testo: le STESSE di un progetto, su computer e su telefono (sul telefono sono
  // quelle di LAYOUT.galleryMobile). Prima qui valevano sempre i valori da computer: su telefono contatti/about/404
  // avevano il testo più largo e 40px più in basso di ogni altra pagina, e aprendolo (zoom del testo) saltava di 40px.
  resizeObservers.push(
    makeResizable(descBlock, `${sizeKeyPrefix}.description`, {
      width: pickLayout(LAYOUT.gallery.descriptionWidth, undefined, LAYOUT.galleryMobile.descriptionWidth) || LAYOUT.gallery.descriptionWidth,
      height: hasExplicitDescHeight ? defaultDescHeight : "auto",
    })
  );
  makeMovableFree(descBlock, `${sizeKeyPrefix}.descriptionPos`, "Trascina per spostare il testo", {
    defaultOffset: pickLayout(LAYOUT.gallery.descriptionOffset, undefined, LAYOUT.galleryMobile.descriptionOffset),
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

    const marqueeBornAt = performance.now();
    // Stessa partenza di ogni altro testo scorrevole: prima riga sul bordo alto del riquadro (vedi measureMarqueeLoop).
    const measureMarqueeDistance = (fromStart = false) => {
      const textHeight = descContent.offsetHeight;
      let gapHeight = MARQUEE_MIN_GAP;
      if (hasExplicitDescHeight) {
        const boxHeight = descBlock.getBoundingClientRect().height;
        if (textHeight < boxHeight) gapHeight = Math.max(MARQUEE_MIN_GAP, boxHeight - textHeight);
      } else {
        descBlock.style.height = `${textHeight}px`;
      }
      marqueeGap.style.height = `${gapHeight}px`;

      const loop = measureMarqueeLoop(descBlock, descTrack, descContent, secondCopyWrapper);
      marqueeDistance = loop.distance;
      marqueePos = fromStart || !marqueeDistance ? loop.startPos : marqueePos % marqueeDistance;
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
    measureMarqueeDistance(true);
    applyMarqueeTransform();
    marqueeRafId = requestAnimationFrame(marqueeTick);

    descBlock.addEventListener("mouseenter", () => { if (!isTouchEcho()) marqueeHoverPaused = true; });
    descBlock.addEventListener("mouseleave", () => { marqueeHoverPaused = false; });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measureMarqueeDistance(performance.now() - marqueeBornAt < 3000 && !marqueeDragState);
        applyMarqueeTransform();
      });
    }

    descTrack.classList.add("draggable");
    descTrack.addEventListener("pointerdown", (e) => {
      if (isEditMode()) return;
      e.preventDefault();
      marqueeDragState = { pointerId: e.pointerId, startY: e.clientY, startPos: marqueePos, moved: false };
      descTrack.classList.add("is-dragging");
      document.addEventListener("pointermove", onMarqueeDragMoveHandler);
      document.addEventListener("pointerup", onMarqueeDragEndHandler);
    });

    // Assegnamo al volo le variabili così possono essere rimosse nel teardown
    var onMarqueeDragMoveHandler = function(e) {
      if (!marqueeDragState || e.pointerId !== marqueeDragState.pointerId) return;
      const dy = e.clientY - marqueeDragState.startY;
      if (Math.abs(dy) > 5) marqueeDragState.moved = true;
      let next = (marqueeDragState.startPos + dy) % marqueeDistance;
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

// Un indirizzo che non porta a niente (un progetto tolto, un segnalibro, una scheda rimasta aperta da prima: Safari ricorda l'ultimo
// indirizzo visitato e lo riapre, il sito sembrava "non funzionare" e bastava toccare il tasto home) non lascia il visitatore su una
// pagina "not found": lo si porta alla home, correggendo l'indirizzo, e per qualche secondo un avviso dice cosa è successo (con
// l'indirizzo vecchio, così si capisce da dove arrivava). Sul tuo computer (modalità modifica) resta la pagina "not found",
// così un errore di battitura si vede.
function renderMissingPage() {
  if (IS_EDITOR) {
    renderNotFound();
    return;
  }
  const wrong = location.hash;
  try {
    history.replaceState(null, "", "#/");
  } catch (e) {
    /* se il browser non lo permette resta l'indirizzo vecchio, ma la home si vede lo stesso */
  }
  renderHome();
  showPageNotice(`This page no longer exists${wrong && wrong !== "#" ? ` (${wrong})` : ""} — here is the home page.`);
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
    el("div", { style: "padding:40px;font-family:var(--mono);--sans-stroke:0;font-size:0.85rem;line-height:1.6;white-space:pre-wrap;" }, [
      el("p", {}, "C'è un errore in content.js e la pagina non riesce a caricarsi del tutto:"),
      el("p", { style: "color:#a33;" }, String(error && error.message ? error.message : error)),
      el("p", {}, "Causa più comune: hai incollato un testo che contiene virgolette dritte (\" o ') dentro una stringa delimitata dagli stessi apici, oppure manca una virgola tra due righe. Se hai appena incollato un testo, prova a racchiuderlo tra backtick ` invece che tra virgolette \" \" — tollerano meglio apici e virgolette dentro il testo."),
    ])
  );
}

// Conta i cambi di pagina: una pagina che aspetta qualcosa dalla rete (es. il testo del progetto) controlla
// di essere ancora quella richiesta prima di disegnarsi.
let routeCounter = 0;
// Com'era lo schermo (telefono / computer) quando la pagina è stata disegnata: vedi redrawWhenFormatChanges più sotto.
let renderedAsMobile = isMobileViewport();

async function renderRoute() {
  routeCounter++;
  renderedAsMobile = isMobileViewport();
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
        // Pagina di lavoro ("core archive (Vecchio)"), raggiungibile solo dal pulsante dell'editor: un visitatore che ne digita
        // l'indirizzo finisce in home, come per ogni indirizzo che non esiste.
        if (IS_EDITOR) renderOldArchive();
        else renderMissingPage();
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

  noteProgrammaticScroll(1500); // anche il browser, a volte, rimette la pagina dov'era appena dopo il disegno: non è l'utente
  window.scrollTo(0, 0);
}

// La prima pagina si disegna quando il carattere è pronto (al massimo 1,2 secondi di attesa): così tutte le
// misure del testo partono già da quelle giuste, invece di essere rifatte dopo — con la pagina che "salta".
// Con la precarica in index.html di solito sono pochi millesimi.
function whenFontReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load('600 16px "Strichpunkt Sans"').catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1200)),
  ]);
}

window.addEventListener("hashchange", renderRoute);

// La disposizione (larghezze, spostamenti, misura delle foto) cambia sotto i 700px e viene decisa nel momento in cui la
// pagina si disegna. Se si attraversa la soglia senza ricaricare — telefono che si ruota, finestra del computer che si
// restringe — la pagina va ridisegnata, altrimenti resta un misto di versione telefono e versione computer: testo stretto
// nel foglio largo, titolo che esce dallo schermo, foto e didascalie fuori posto (ruotando da orizzontale a verticale la
// pagina diventava anche più larga dello schermo di 62px). Con una foto ingrandita aperta la foto si adatta da sola
// (vedi zoomRefit) e la pagina dietro si ridisegna appena la si chiude; il pannello del testo, che si chiude di colpo, si chiude.
(function redrawWhenFormatChanges() {
  let timer = null;
  let waitingForPhoto = false;
  const redraw = () => {
    waitingForPhoto = false;
    renderRoute();
  };
  const check = () => {
    if (isMobileViewport() === renderedAsMobile) { waitingForPhoto = false; return; }
    if (zoomRefit) { waitingForPhoto = true; return; }
    if (zoomCurrentClose) zoomCurrentClose();
    redraw();
  };
  // Ruotando arrivano più "resize" di fila: si aspetta che lo schermo si sia assestato. Su alcuni telefoni la misura nuova
  // arriva dopo l'evento di rotazione: si ricontrolla anche poco dopo, per non restare con la pagina del formato sbagliato.
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(check, 150); });
  window.addEventListener("orientationchange", () => { setTimeout(check, 400); });
  window.addEventListener("zoom-closed", () => { if (waitingForPhoto) setTimeout(check, 0); });
})();

window.addEventListener("DOMContentLoaded", () => {
  whenFontReady().then(renderRoute).then(() => {
    // Sfondo scuro, riquadro che vola e pannello del testo si creano ora, a pagina già disegnata e a riposo, non al
    // primo clic: crearli mentre parte l'ingrandimento faceva comparire lo sfondo di colpo e la foto con qualche
    // fotogramma di ritardo (succedeva solo la prima volta dopo aver caricato il sito).
    const prepare = () => { try { ensureZoomElements(); ensureZoomTextPanel(); } catch (e) { /* si creeranno al primo clic, come prima */ } };
    if (window.requestIdleCallback) window.requestIdleCallback(prepare, { timeout: 1500 });
    else setTimeout(prepare, 300);
  });
});

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

// "v3": l'archivio è ora un elenco verticale di parole (prima erano sparse in pagina con una posizione ciascuna).
// Un vecchio elenco "v2" rimasto salvato in qualche browser non deve coprire quello nuovo.
const ARCHIVE_PAGES_STORE_KEY = "site-archive-pages-v3";

// Le parole/foto dell'archivio ricordano il percorso del file a cui sono legate. Se il file nel frattempo ha cambiato
// cartella o maiuscole (es. "images/lines/2 hill.JPG" → "images/boudaries/2 hill.JPG"), il collegamento si rompeva e
// la foto non si apriva più. Qui si ritrova il file con lo stesso nome nell'elenco delle foto (se ce n'è uno solo) e,
// se il collegamento puntava a un progetto che non esiste più, lo si sposta sul progetto della nuova cartella.
function healArchivePaths(pages) {
  const list = window.DYNAMIC_IMAGES;
  if (!Array.isArray(list) || !pages) return pages;
  const actual = new Map(list.map((path) => [path.toLowerCase(), path]));
  const byName = new Map();
  list.forEach((path) => {
    const name = path.split("/").pop().toLowerCase();
    byName.set(name, (byName.get(name) || []).concat(path));
  });
  // Ultima risorsa: la foto è stata RINOMINATA dentro la sua cartella (es. "lines-11.jpg" → "fields.jpg" in "core archive",
  // dando alle foto il nome della parola). Se in quella cartella c'è un solo file che si chiama come la parola (anche al
  // singolare/plurale), è quello. Vale solo per un collegamento già rotto: non cambia mai uno che funziona.
  const plainName = (text) => String(text || "").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "");
  const renamedAsWord = (src, word) => {
    const target = plainName(word);
    if (!target) return null;
    const folder = String(src).toLowerCase().split("/").slice(0, -1).join("/");
    const names = [target, `${target}s`, target.replace(/s$/, "")];
    const found = list.filter((path) => path.toLowerCase().split("/").slice(0, -1).join("/") === folder && names.includes(plainName(path.split("/").pop())));
    return found.length === 1 ? found[0] : null;
  };
  const find = (src, word) => {
    const key = String(src).toLowerCase();
    if (actual.has(key)) return actual.get(key) !== src ? actual.get(key) : null; // solo le maiuscole erano diverse (o già a posto)
    const sameName = byName.get(key.split("/").pop()) || [];
    return sameName.length === 1 ? sameName[0] : renamedAsWord(src, word);
  };
  pages.forEach((page) => (page.images || []).forEach((item) => {
    [["linkedImageSrc", "linkedImageLinkTo"], ["poolSrc", "linkTo"]].forEach(([srcField, linkField]) => {
      if (!item[srcField]) return;
      const fixed = find(item[srcField], item.text);
      if (!fixed) return;
      item[srcField] = fixed;
      const target = item[linkField];
      if (target && /^project\//.test(target) && !PROJECTS.some((project) => `project/${project.slug}` === target)) {
        const folder = fixed.split("/")[1];
        if (PROJECTS.some((project) => project.slug === folder)) item[linkField] = `project/${folder}`;
        else delete item[linkField];
      }
    });
  }));
  return pages;
}

function loadArchivePages() {
  try {
    const ls = JSON.parse(siteStore.getItem(ARCHIVE_PAGES_STORE_KEY));
    if (ls && ls.length > 0) {
      return healArchivePaths(ls);
    }
  } catch (e) {}
  
  if (ARCHIVE.pages && ARCHIVE.pages.length > 0) {
    return healArchivePaths(JSON.parse(JSON.stringify(ARCHIVE.pages)));
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
  siteStore.setItem(ARCHIVE_PAGES_STORE_KEY, JSON.stringify(pages));
  
  // Auto-save to content.js
  fetch('/api/save-archive-pages', {
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
  
  // Le parole sono un elenco verticale (come la lista della home), allineato al bordo sinistro del titolo "core archive".
  // Se esistono anche foto sparse (vecchio modo di usare l'archivio) restano come prima, sopra l'elenco.
  const hasLooseImages = page.images.some((i) => i.type !== "word" && i.type !== "break");
  const figure = el("figure", { class: "photo archive-figure", style: `position: relative; width: 100%; display: block; padding: 0; text-align: left;${hasLooseImages ? " min-height: 100vh;" : ""}` });
  const list = el("ul", { class: "archive-list" });
  figure.appendChild(list);
  const listRows = []; // { item } nell'ordine in cui compaiono: serve a riordinare

  const mappedArchiveImages = ARCHIVE.images.map((img, i) => ({ ...img, _index: i }));
  const poolImages = applyImageOverrides("archive", "archive", mappedArchiveImages);

  // Una riga dell'elenco: una parola (didascalia di una foto) oppure uno spazio vuoto tra un gruppo e l'altro
  const buildRow = (item) => {
    const isBreak = item.type === "break";
    const li = el("li", { class: isBreak ? "archive-row archive-break" : "archive-row" });
    listRows.push({ item });

    if (isBreak) {
      li.appendChild(el("span", { class: "archive-break-label" }, "spazio"));
    } else {
      const wordEl = el("span", { class: "archive-word" }, item.text);
      const frame = el("div", { class: "archive-word-frame" }, [wordEl]);
      li.appendChild(frame);

      if (isEditMode()) {
        wordEl.contentEditable = "true";
        wordEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); wordEl.blur(); } });
        wordEl.addEventListener("blur", () => {
          item.text = wordEl.innerText.replace(/\s+/g, " ").trim() || "Parola";
          wordEl.innerText = item.text;
          saveArchivePages(pages);
        });
      }

      // Foto collegata: invisibile, serve solo come punto di partenza dell'ingrandimento (la foto "esce" dalla parola)
      let poolImg = null;
      let src = null;
      if (item.linkedImageSrc) {
        src = item.linkedImageSrc;
        poolImg = { linkTo: item.linkedImageLinkTo };
      } else if (item.linkedImageIndex != null) {
        poolImg = poolImages[item.linkedImageIndex];
        if (poolImg) src = resolveImageSrc("archive", item.linkedImageIndex, poolImg);
      }
      if (src) {
        const hiddenImg = el("img", { class: "hidden-link-img", src: src, style: "position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; z-index: -1;" });
        frame.appendChild(hiddenImg);
        // Accanto alla foto ingrandita compare il progetto a cui appartiene (cliccandolo si apre quel progetto)
        const project = archiveImageProject(src, poolImg && poolImg.linkTo, item.linkedImageProject);
        makeZoomable(frame, hiddenImg, project ? `project/${project.slug}` : null, `${galleryKey}.zoom.${item.uid}`, poolImg && poolImg.zoomBox);
        frame.classList.add("is-linked");
      }

      const linkBtn = el("button", { type: "button", class: "archive-link-btn", title: "Collega a una foto" }, "🔗");
      linkBtn.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!isEditMode()) return;
        showArchivePoolModal(page, pages, "link", (selectedImg) => {
          item.linkedImageSrc = selectedImg.src;
          item.linkedImageLinkTo = selectedImg.linkTo;
          const chosen = archiveImageProject(selectedImg.src, selectedImg.linkTo);
          if (chosen) item.linkedImageProject = chosen.slug;
          else delete item.linkedImageProject;
          saveArchivePages(pages);
          renderRoute();
        });
      });
      li.appendChild(linkBtn);
    }

    const deleteBtn = el("button", { type: "button", class: "home-word-delete-btn", title: isBreak ? "Togli questo spazio" : "Togli questa parola" }, "×");
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!isEditMode()) return;
      if (!isBreak && !confirm("Togliere questa parola dalla pagina?")) return;
      page.images = page.images.filter((i) => i.uid !== item.uid);
      saveArchivePages(pages);
      renderRoute();
    });
    li.appendChild(deleteBtn);
    list.appendChild(li);

    // Si riordina con la stessa maniglia blu ⠿ della lista in home
    makeReorderable(li, {
      container: list,
      axis: "y",
      onReorder: (from, to) => {
        const order = listRows.map((row) => row.item);
        const [moved] = order.splice(from, 1);
        order.splice(to, 0, moved);
        const others = page.images.filter((i) => i.type !== "word" && i.type !== "break");
        page.images = order.concat(others);
        saveArchivePages(pages);
        renderRoute();
      },
    });
  };

  // Render images/words on this page
  page.images.forEach((item) => {
    if (item.type === "word" || item.type === "break") {
      buildRow(item);
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
    // Proporzioni VERE della foto (vedi KNOWN_IMAGE_SIZES), non quelle dell'ingrandimento: altrimenti la schiaccia
    const known = knownImageSize(item.poolSrc || poolImg.src);
    const imgAttrs = { src: TINY_GIF, class: "photo-img", draggable: false };
    imgAttrs.style = (known ? `aspect-ratio: ${known[0]} / ${known[1]}; ` : "") + "transition: opacity 0.3s; opacity: 0;";
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
    
    // Posizione di partenza sparsa, così le foto non si sovrappongono del tutto finché non le sposti:
    // diversa per ogni foto ma SEMPRE la stessa a ogni visita e su ogni browser (prima era a caso a ogni caricamento)
    const scatterX = (stableUnit(item.uid, "x") - 0.5) * 400; // da -200 a 200
    const scatterY = (stableUnit(item.uid, "y") - 0.5) * 300; // da -150 a 150

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
          siteStore.setItem(CAPTION_STORE_KEY, JSON.stringify(allCaps));
        });
      }
      figcaption.appendChild(captionP);
      frame.appendChild(figcaption);
    }
    
    figure.appendChild(frameWrapper);
  });
  
  const pageControls = el("div", { class: "archive-page-controls", style: "position: fixed; bottom: 20px; left: 20px; z-index: 1000; display: " + (isEditMode() ? "flex" : "none") + "; gap: 8px; flex-direction: column;" });
  
  const addWordBtn = el("button", { style: "padding: 8px; background: #7a5d2b; color: #f4f0e6; border-radius: 4px; border: none; cursor: pointer; font-family: monospace;" }, "+ Parola");
  addWordBtn.addEventListener("click", () => {
    page.images.push({ type: "word", text: "Nuova parola", uid: `uid_${Date.now()}_${Math.floor(Math.random()*10000)}` });
    saveArchivePages(pages);
    renderRoute();
  });

  const addBreakBtn = el("button", { style: "padding: 8px; background: #2b547a; color: #f4f0e6; border-radius: 4px; border: none; cursor: pointer; font-family: monospace;" }, "+ Spazio");
  addBreakBtn.addEventListener("click", () => {
    page.images.push({ type: "break", uid: `uid_${Date.now()}_${Math.floor(Math.random()*10000)}` });
    saveArchivePages(pages);
    renderRoute();
  });
  
  const oldArchiveBtn = el("a", { href: "#/old-archive", target: "_blank", style: "padding: 8px; background: #9c6e26; color: #f4f0e6; border-radius: 4px; border: none; cursor: pointer; font-family: monospace; text-decoration: none; text-align: center;" }, "Guarda Vecchio Archivio");
  
  pageControls.appendChild(addWordBtn);
  pageControls.appendChild(addBreakBtn);
  pageControls.appendChild(oldArchiveBtn);
  
  const toggleControls = () => {
    renderRoute();
  };
  window.addEventListener("edit-mode-toggled", toggleControls);
  
  const track = el("div", { class: "photo-track" }, [figure]);
  const viewport = el("div", { class: "photo-viewport" }, [track]);
  
  const { topbar } = buildTopbar("archive", "0", ARCHIVE.title);
  
  const bottomIndexEl = el("span", { class: "topbar-index" }, "0");
  // La posizione dello "0" in fondo non è un numero scritto qui: la calcola alignBottomNumber (più sotto) sulla pagina vera, così è
  // sempre sulla stessa linea verticale del titolo e dell'elenco e alla stessa distanza dall'ultima parola che in alto c'è tra il "0"
  // e il titolo. Resta la maniglia verde per un ritocco a mano a partire da quella posizione. Chiave NUOVA: la vecchia,
  // "archive.bottomIndexPos", era una posizione assoluta messa a occhio e riferita al centro dello schermo (cambiava con la larghezza
  // dello schermo), e non vale più; se è rimasta salvata in site-state.js viene ignorata.
  makeMovableFree(bottomIndexEl, `archive.bottomIndexNudge`, "Trascina per ritoccare la posizione del numero");
  const centerGroup = el("div", { class: "gallerybar-center" }, [bottomIndexEl]);
  const footerBar = el("div", { class: "gallerybar archive-bar" }, [centerGroup]);

  const spacerBottom = el("div", { class: "gallery-spacer" });
  makeHeightResizable(spacerBottom, "archive.spacerBottom", "Trascina per allungare la pagina", parseFloat(LAYOUT.gallery.spacerBottomHeight) || 0);

  app.appendChild(topbar);
  app.appendChild(viewport);
  app.appendChild(pageControls);
  app.appendChild(footerBar);
  app.appendChild(spacerBottom);
  // Solo in modifica su telefono (vedi ".edit-bottom-room" in style_v58.css): posto in più in fondo, perché i pulsanti fissi in
  // basso a sinistra (+ Parola, + Spazio, Vecchio archivio) non coprano il numero della barra.
  app.appendChild(el("div", { class: "edit-bottom-room", "aria-hidden": "true" }));

  const alignmentGuides = setupAlignmentGuides(app, galleryKey);

  // L'elenco parte esattamente sotto il titolo "core archive" e il suo bordo sinistro coincide con quello del titolo
  // (misurato sul titolo vero, dovunque sia: cambia con lo schermo e se lo sposti in modalità modifica).
  // Il distacco dal titolo è quello della home tra l'intestazione e la lista.
  const titleEl = topbar.querySelector(".topbar-title");
  const alignList = () => {
    if (!titleEl || !titleEl.isConnected) return;
    list.style.marginLeft = "0px";
    list.style.marginTop = "0px";
    const t = titleEl.getBoundingClientRect();
    const l = list.getBoundingClientRect();
    list.style.marginLeft = `${Math.round((t.left - l.left) * 100) / 100}px`;
    list.style.marginTop = `${Math.max(0, Math.round((t.bottom + 68 - l.top) * 100) / 100)}px`;
  };
  alignList();
  window.addEventListener("resize", alignList);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignList);

  // Lo "0" in fondo: sulla stessa linea verticale del titolo (e quindi dell'elenco) e, dall'ultima parola, alla stessa distanza che
  // in alto c'è tra il "0" e il titolo. Misurato sulla pagina vera come l'elenco (vale su ogni schermo, e se in modifica sposti il
  // numero o il titolo la distanza li segue). Il foglio si allunga da solo: la distanza è il padding in alto della barra in fondo,
  // quello a sinistra la porta sulla linea del titolo. Si usano differenze tra rettangoli, che non risentono di spostamenti comuni.
  const topIndexEl = topbar.querySelector(".topbar-index");
  const alignBottomNumber = () => {
    if (!titleEl || !titleEl.isConnected || !topIndexEl || !footerBar.isConnected) return;
    const title = titleEl.getBoundingClientRect();
    const bar = footerBar.getBoundingClientRect();
    footerBar.style.paddingLeft = `${Math.round((title.left - bar.left) * 100) / 100}px`;
    const words = list.querySelectorAll(".archive-word");
    const lastWord = words[words.length - 1];
    if (!lastWord) return;
    const gapAtTop = title.top - topIndexEl.getBoundingClientRect().bottom;
    const gapNow = bar.top - lastWord.getBoundingClientRect().bottom; // il "0" parte in cima alla barra, dopo il suo padding
    footerBar.style.paddingTop = `${Math.max(0, Math.round((gapAtTop - gapNow) * 100) / 100)}px`;
  };
  alignBottomNumber();
  window.addEventListener("resize", alignBottomNumber);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignBottomNumber);
  if (typeof ResizeObserver === "function") {
    const barObserver = new ResizeObserver(alignBottomNumber);
    barObserver.observe(viewport);
    barObserver.observe(topbar);
    resizeObservers.push(barObserver);
  }

  currentTeardown = () => {
    window.removeEventListener("edit-mode-toggled", toggleControls);
    window.removeEventListener("resize", alignList);
    window.removeEventListener("resize", alignBottomNumber);
    alignmentGuides.teardown();
    resizeObservers.forEach(o => o.disconnect());
  };
}

// A quale progetto appartiene la foto collegata a una parola (è il nome che compare accanto alla foto ingrandita).
// In ordine: il progetto salvato insieme alla parola; la cartella della foto (images/<progetto>/...); una copia
// identica della foto dentro un progetto (le foto della cartella "core archive" sono quasi tutte copie); lo stesso nome
// di file in un progetto; il nome del file che comincia col nome del progetto (stills-10.jpg); infine il collegamento
// "project/..." scelto a mano. Restituisce il progetto (da PROJECTS) oppure null.
function archiveImageProject(src, linkTo, savedSlug) {
  const bySlug = (slug) => PROJECTS.find((project) => project.slug === slug) || null;
  if (savedSlug && bySlug(savedSlug)) return bySlug(savedSlug);
  const clean = String(src || "").replace(/\?.*$/, "");
  const lower = clean.toLowerCase();
  const folder = clean.split("/")[1];
  if (bySlug(folder)) return bySlug(folder);
  const twins = window.IMAGE_TWINS || {};
  const twinKey = Object.keys(twins).find((key) => key.toLowerCase() === lower);
  if (twinKey) {
    const twinProject = bySlug(String(twins[twinKey]).split("/")[1]);
    if (twinProject) return twinProject;
  }
  const fileName = lower.split("/").pop();
  const sameName = PROJECTS.filter((project) => (project.images || []).some((img) => img.src && img.src.toLowerCase().split("/").pop() === fileName));
  if (sameName.length === 1) return sameName[0];
  const prefix = fileName.replace(/\.[a-z0-9]+$/, "").replace(/-\d+(-\d+)?$/, "");
  if (bySlug(prefix)) return bySlug(prefix);
  if (linkTo && /^project\//.test(linkTo)) return bySlug(linkTo.split("/")[1]);
  return null;
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
if (!siteStore.getItem(MIGRATION_ZOOM_RESET_V3)) {
  siteStore.keys().forEach(key => {
    if (key.startsWith("site-pos-v1-")) {
      if (key.includes(".zoom.descriptionPos") || 
          key.includes(".zoom.topbarTitlePos") || 
          key.includes(".descriptionZoomSize") || 
          key.includes(".descriptionZoomPos")) {
        siteStore.removeItem(key);
      }
    }
  });
  siteStore.setItem(MIGRATION_ZOOM_RESET_V3, "true");
}


// Una tantum, SOLO sul tuo computer (mai per chi visita il sito): le didascalie rimesse il 12 ottobre vanno anche nel Core Archive.
//  - "tie, saint laurent" diventa "tie saint laurent" (senza virgola, come la didascalia);
//  - le parole che mancavano (una per foto) si aggiungono in fondo, in un gruppo a parte, ciascuna legata alla sua foto.
// "porcelain" c'è già e porta alla stessa foto di "ionia porcelain set": non si duplica. Una volta fatto, si ricorda (flag):
// se poi togli o sposti una di queste parole dal browser, non ricompare. Le parole sono normali parole del Core Archive:
// si cambiano, si spostano e si tolgono con le maniglie di sempre, e il salvataggio le scrive in site-state.js e content.js.
(function addRestoredWordsToArchive() {
  const FLAG_KEY = "site-archive-words-added-v1";
  if (!IS_EDITOR || siteStore.getItem(FLAG_KEY)) return;
  try {
    const pages = loadArchivePages();
    if (!pages || !pages.length) return;
    const items = pages[0].images || (pages[0].images = []);
    let changed = false;

    items.forEach((item) => {
      if (item.type === "word" && item.text === "tie, saint laurent") {
        item.text = "tie saint laurent";
        changed = true;
      }
    });

    const wanted = [
      { uid: "uid_added_wine", text: "wine sales negotiations", src: "images/homes/1 wine.jpg", project: "homes" },
      { uid: "uid_added_barns", text: "barns", src: "images/homes/6 huts.jpg", project: "homes" },
      { uid: "uid_added_construction", text: "construction", src: "images/homes/7 ongoing.jpg", project: "homes" },
      { uid: "uid_added_cigarettes", text: "cigarettes", src: "images/recognition/recognition-5.jpg", project: "recognition" },
      { uid: "uid_added_perfume", text: "vintage perfume bottle", src: "images/stills/stills-7.jpg", project: "stills" },
    ];
    const known = Array.isArray(window.DYNAMIC_IMAGES) ? window.DYNAMIC_IMAGES : null;
    const toAdd = wanted
      .map((word) => {
        const real = known ? known.find((path) => path.toLowerCase() === word.src.toLowerCase()) : word.src;
        return real ? { ...word, src: real } : null; // se la foto non c'è più, la parola non si aggiunge
      })
      .filter((word) => word && !items.some((item) => item.uid === word.uid || (item.type === "word" && String(item.linkedImageSrc || "").toLowerCase() === word.src.toLowerCase())));
    if (toAdd.length) {
      if (items.length && items[items.length - 1].type !== "break") items.push({ type: "break", uid: "uid_added_break_1" });
      toAdd.forEach((word) => {
        items.push({ type: "word", text: word.text, uid: word.uid, linkedImageSrc: word.src, linkedImageLinkTo: `project/${word.project}`, linkedImageProject: word.project });
      });
      changed = true;
    }
    if (changed) saveArchivePages(pages);
    siteStore.setItem(FLAG_KEY, "1");
  } catch (e) {
    /* se qualcosa non va, si riprova al prossimo avvio: il flag non è stato scritto */
  }
})();
