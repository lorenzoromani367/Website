/* Contatore di fluidità. Non fa parte del sito: serve a misurare, sul computer vero (scheda grafica, schermo, browser), quello che da un
   altro computer non si vede. Si accende e si spegne con Opzione+Maiusc+F (o aprendo il sito con ?fps in fondo all'indirizzo); chi
   visita il sito non lo carica nemmeno: lo scarica app_v58.js solo in quel momento.

   In alto a sinistra mostra:
   - quanti fotogrammi al secondo sta disegnando il browser adesso (60 su uno schermo normale, 120 su uno veloce, meno se il Mac limita
     le animazioni, per esempio in risparmio energetico), il fotogramma più lento degli ultimi 10 secondi e il più lento da quando è acceso;
   - quanti "buchi" ci sono stati (un buco è un fotogramma arrivato dopo quasi il doppio del tempo normale: a occhio è un singhiozzo) e gli
     ultimi, ciascuno con ciò che era appena successo (inizio di uno scorrimento della galleria, cambio pagina, finestra ridimensionata o
     tornata in primo piano, rotella, tasto, clic);
   - i "lavori lunghi del sito": quando il browser si blocca più di 50 ms a eseguire il sito (funzione e file responsabili, se il browser lo
     dice: Chrome sì). Se c'è un buco ma nessun lavoro lungo, il tempo non l'ha perso il sito: l'ha perso la scheda grafica o il sistema.
   - «Barra ferma»: se, a ogni scorrimento della galleria, il numero con le frecce è stato tenuto fermo sullo schermo e, se no, perché
     (riduci movimento, schermo tattile, modalità modifica, pagina mossa da poco...). Lo scrive il sito in window.__framingLog.
   "Copia rapporto" mette tutto negli appunti, da incollare in chat. */
(() => {
  if (window.__fpsMeterToggle) return;

  const WINDOW_MS = 10000; // quanto indietro si guarda per "il più lento degli ultimi 10 s"
  const CONTEXT_MS = 7000; // entro quanto un evento (scorrimento, cambio pagina...) conta come "appena successo"

  let box = null;
  let textEl = null;
  let rafId = 0;
  let running = false;
  let timer = 0;
  let last = null; // istante dell'ultimo fotogramma
  let startedAt = 0;
  let frames = []; // [istante, durata] degli ultimi 10 secondi
  let baseline = 16.7; // durata "normale" di un fotogramma, ricalcolata ogni tanto (vedi updateBaseline)
  let sinceBaseline = 0;
  let gaps = []; // buchi: { dt, ctx, hash }
  let gapCount = 0;
  let gapOver50 = 0;
  let gapOver100 = 0;
  let worstEver = null; // il fotogramma più lento da quando è acceso: { dt, ctx, hash }
  let work = []; // lavori lunghi del sito: { dur, ctx, scripts, styleLayout, kind }
  let workCount = 0;
  let workSource = "non disponibile in questo browser";
  let observers = [];
  let lastTransform = null;
  // Gli ultimi eventi, per dire cosa era appena successo accanto a un buco
  const marks = { slide: null, route: null, resize: null, focus: null, scroll: null, key: null, click: null };
  const MARK_LABEL = {
    slide: "dopo l'inizio dello scorrimento della galleria",
    route: "dopo il cambio pagina",
    resize: "dopo che la finestra è stata ridimensionata",
    focus: "dopo che la finestra è tornata in primo piano",
    scroll: "dopo la rotella",
    key: "dopo un tasto",
    click: "dopo un clic",
  };

  const fmt = (ms) => `${Math.round(ms)} ms`;
  const secs = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  const percentile = (list, p) => {
    if (!list.length) return null;
    const sorted = list.slice().sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  };

  // La durata "normale" di un fotogramma è la più bassa che si vede spesso (il 25° percentile degli ultimi 10 s), non la mediana degli
  // ultimi fotogrammi: se per qualche secondo il browser va a 8 fotogrammi al secondo la mediana sale e i fotogrammi lenti non sembrano
  // più buchi (è successo nel primo rapporto: il più lento era 163 ms e i buchi contati erano 0).
  const updateBaseline = () => {
    const p = percentile(frames.map((f) => f[1]), 0.25);
    if (p != null && frames.length >= 30) baseline = p;
  };

  // Cosa era appena successo prima dell'istante "ts": l'evento più vicino tra quelli ricordati
  const contextAt = (ts) => {
    let best = null;
    Object.keys(marks).forEach((key) => {
      if (marks[key] == null) return;
      const delta = ts - marks[key];
      if (delta < -50 || delta > CONTEXT_MS) return;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { key, delta: Math.max(0, delta) };
    });
    return best;
  };
  const describeContext = (ctx) => (ctx ? `${secs(ctx.delta)} ${MARK_LABEL[ctx.key]}` : "senza niente di vicino (galleria ferma)");

  const tick = (ts) => {
    rafId = requestAnimationFrame(tick);
    if (last != null && !document.hidden) {
      const dt = ts - last;
      if (dt > 0 && dt < 1000) {
        frames.push([ts, dt]);
        if (++sinceBaseline >= 30) { sinceBaseline = 0; updateBaseline(); }
        if (!worstEver || dt > worstEver.dt) worstEver = { dt, ctx: contextAt(ts), hash: location.hash };
        if (frames.length >= 30 && dt > Math.max(1.9 * baseline, baseline + 8)) {
          gapCount++;
          if (dt > 50) gapOver50++;
          if (dt > 100) gapOver100++;
          gaps.push({ dt, ctx: contextAt(ts), hash: location.hash });
          if (gaps.length > 40) gaps.shift();
        }
      }
    }
    last = ts;
    while (frames.length && ts - frames[0][0] > WINDOW_MS) frames.shift();
    // inizio di uno scorrimento tra le foto: la galleria cambia la "transform" del suo binario
    const track = document.querySelector(".photo-track");
    if (track) {
      const value = track.style.transform;
      if (value !== lastTransform) { if (lastTransform !== null) marks.slide = ts; lastTransform = value; }
    } else {
      lastTransform = null;
    }
  };

  // Lavori lunghi del sito. "long-animation-frame" (Chrome 123 in poi) dice anche quale funzione di quale file; "longtask" dice solo
  // quanto è durato il blocco. Si usa il primo se c'è.
  const addWork = (kind, entry) => {
    workCount++;
    const end = entry.startTime + entry.duration;
    const scripts = (entry.scripts || [])
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3)
      .map((s) => {
        const file = String(s.sourceURL || "").split("?")[0].split("/").pop();
        const name = s.sourceFunctionName || s.invoker || "(anonima)";
        return `${name}${file ? ` in ${file}${s.sourceCharPosition >= 0 ? `:${s.sourceCharPosition}` : ""}` : ""} ${fmt(s.duration)}`;
      });
    work.push({
      kind,
      dur: entry.duration,
      blocking: entry.blockingDuration,
      styleLayout: entry.styleAndLayoutStart ? Math.max(0, end - entry.styleAndLayoutStart) : null,
      render: entry.renderStart ? Math.max(0, end - entry.renderStart) : null,
      scripts,
      ctx: contextAt(entry.startTime),
      hash: location.hash,
    });
    if (work.length > 30) work.shift();
  };
  const watch = (type, kind) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => addWork(kind, entry)));
      observer.observe({ type, buffered: false });
      observers.push(observer);
      return true;
    } catch (e) {
      return false;
    }
  };

  const summary = () => {
    const now = performance.now();
    const lastSecond = frames.filter((f) => now - f[0] <= 1000).length;
    const worst = frames.length ? Math.max(...frames.map((f) => f[1])) : 0;
    return { lastSecond, worst, hz: Math.round(1000 / baseline), seconds: (now - startedAt) / 1000 };
  };

  const describeGap = (g) => `${fmt(g.dt)} · ${describeContext(g.ctx)}`;
  const describeWork = (w) => {
    const parts = [];
    if (w.scripts.length) parts.push(`script: ${w.scripts.join("; ")}`);
    if (w.styleLayout != null && w.styleLayout >= 5) parts.push(`stile e layout ${fmt(w.styleLayout)}`);
    return `${fmt(w.dur)}${parts.length ? ` (${parts.join(" · ")})` : ""} · ${describeContext(w.ctx)}`;
  };

  // «Barra ferma»: ultimi scorrimenti della galleria, come li ha registrati il sito (vedi logFraming in app_v58.js)
  const media = (query) => { try { return window.matchMedia(query).matches; } catch (e) { return false; } };
  const describeHold = (e) => {
    const ago = `${Math.max(0, Math.round((Date.now() - e.at) / 1000))} s fa`;
    const grow = e.grow ? ` · ${e.grow}` : ""; // com'è cambiata l'altezza del riquadro in quello scorrimento (growTransitionFor)
    // Accompagnamento verso il fondo dopo che l'utente è sceso a metà pagina (assistSettled in app_v58.js)
    if (e.assist) return e.ran ? `${ago} · pagina portata in fondo dall'accompagnamento (partito con la pagina a ${e.fromY} px dall'alto; la barra è stata portata a ${e.holdY} px dal bordo alto della finestra${e.why ? `; ${e.why}` : ""})` : `${ago} · accompagnamento in fondo NON partito: ${e.why}`;
    if (!e.ran) return `${ago} · NON partito: ${e.why}${grow}`;
    if (e.mode === "tenuta") return `${ago} · barra tenuta ferma dov'era, a ${e.holdY} px dal bordo alto${e.why ? ` (${e.why})` : ""}${grow}`;
    if (e.holdY > e.endY + 2) return `${ago} · barra ferma a ${e.holdY} px, sotto il bordo della finestra (${innerHeight} px): con la barra in fondo la cima della foto più alta sarebbe tagliata di troppo${grow}`;
    return `${ago} · pagina portata in fondo, barra ferma a ${e.holdY} px dal bordo alto${grow}`;
  };
  const holdLines = (limit) => {
    const log = window.__framingLog;
    const conditions = `riduci movimento: ${media("(prefers-reduced-motion: reduce)") ? "SÌ (non cambia la discesa accompagnata)" : "no"} · schermo tattile: ${media("(pointer: coarse)") ? "SÌ" : "no"} · modalità modifica: ${document.body.classList.contains("edit-mode") ? "SÌ" : "no"}`;
    if (!Array.isArray(log)) return ["Barra ferma: questa pagina non ha il codice nuovo (ricaricare con Cmd+Maiusc+R)", conditions];
    // Accompagnamento verso il fondo (assistState in app_v58.js): attivo adesso, o cosa lo ferma
    const assist = typeof window.__assistState === "function" ? window.__assistState() : null;
    const assistLine = assist
      ? `Accompagnamento verso il fondo: ${assist.blocker ? `NON attivo adesso (${assist.blocker})` : `attivo (pagina a ${assist.y} px, l'inquadratura è a ${assist.target} px)`}. Ultima rotella o tasto: ${assist.last}`
        + (assist.glide ? `. Ultima discesa accompagnata: ${assist.glide.ms} ms per ${assist.glide.px} px (${Math.round((Date.now() - assist.glide.at) / 1000)} s fa)` : ". Nessuna discesa accompagnata da quando la pagina è aperta")
        + (assist.stats ? `. Scatti di rotella visti dal sito: ${assist.stats.wheels} (${assist.stats.uncancelable} non annullabili), discese partite: ${assist.stats.taken}, scatti assorbiti: ${assist.stats.absorbed}${assist.stats.last ? `; l'ultimo: ${assist.stats.last}` : ""}` : "")
      : "Accompagnamento verso il fondo: non c'è in questa pagina (non è una galleria, o la pagina non ha il codice nuovo: ricaricare con Cmd+Maiusc+R)";
    const lines = [log.length ? `Barra ferma, ultimi scorrimenti della galleria (${log.length}):` : "Barra ferma: nessuno scorrimento della galleria da quando la pagina è aperta", conditions, assistLine];
    log.slice(-limit).reverse().forEach((e) => lines.push(`- ${describeHold(e)} (${e.hash || "#/"})`));
    return lines;
  };

  const report = () => {
    const s = summary();
    const lines = [
      `Rapporto di fluidità — ${new Date().toLocaleString("it-IT")}`,
      `Browser: ${navigator.userAgent}`,
      `Versione del codice del sito: ${window.SITE_BUILD || "più vecchia di «discesa morbida 2» (il browser sta usando codice vecchio: ricaricare con Cmd+Maiusc+R)"}`,
      `Finestra: ${innerWidth}×${innerHeight}, densità ${window.devicePixelRatio}×, circa ${s.hz} Hz`,
      `Pagina: ${location.hash || "#/"}`,
      `Acceso da ${Math.round(s.seconds)} s. Ora ${s.lastSecond} fotogrammi/s; il più lento degli ultimi 10 s: ${fmt(s.worst)}`,
      worstEver ? `Il più lento da quando è acceso: ${describeGap(worstEver)} (${worstEver.hash || "#/"})` : "Il più lento da quando è acceso: -",
      `Buchi: ${gapCount} (oltre 50 ms: ${gapOver50}; oltre 100 ms: ${gapOver100})`,
    ];
    if (gaps.length) {
      lines.push("Ultimi buchi:");
      gaps.slice(-15).forEach((g) => lines.push(`- ${describeGap(g)} (${g.hash || "#/"})`));
    }
    lines.push(`Lavori lunghi del sito, oltre 50 ms: ${workCount} (misura: ${workSource})`);
    if (work.length) {
      lines.push("Ultimi:");
      work.slice(-10).forEach((w) => lines.push(`- ${describeWork(w)} (${w.hash || "#/"})`));
    }
    holdLines(8).forEach((line) => lines.push(line));
    return lines.join("\n");
  };

  const render = () => {
    if (!textEl) return;
    const s = summary();
    const rows = [
      `Fluidità: ${s.lastSecond} fotogrammi/s (schermo ~${s.hz} Hz)`,
      `Il più lento: ${fmt(s.worst)} negli ultimi 10 s, ${worstEver ? fmt(worstEver.dt) : "-"} in tutto`,
      `Buchi (${Math.round(s.seconds)} s): ${gapCount} · oltre 50 ms: ${gapOver50} · oltre 100 ms: ${gapOver100}`,
      `Lavori lunghi del sito: ${workCount}`,
    ];
    if (gaps.length) {
      rows.push("Ultimi buchi:");
      gaps.slice(-3).reverse().forEach((g) => rows.push(` ${describeGap(g)}`));
    }
    if (work.length) {
      rows.push("Ultimo lavoro lungo:");
      rows.push(` ${describeWork(work[work.length - 1])}`);
    }
    holdLines(2).forEach((line) => rows.push(line));
    textEl.textContent = rows.join("\n");
  };

  const copyReport = async (button) => {
    const text = report();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* si prova il modo vecchio */ }
    if (!ok) {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.cssText = "position: fixed; left: -9999px; top: 0;";
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand("copy");
        area.remove();
      } catch (e) { /* niente appunti: il rapporto resta comunque visibile qui sopra */ }
    }
    button.textContent = ok ? "Copiato" : "Non riesco a copiare";
    setTimeout(() => { button.textContent = "Copia rapporto"; }, 1800);
  };

  const resetNumbers = () => {
    frames = [];
    gaps = [];
    gapCount = gapOver50 = gapOver100 = 0;
    worstEver = null;
    work = [];
    workCount = 0;
    sinceBaseline = 0;
    startedAt = performance.now();
  };

  // eventi che spiegano un buco: si ricorda solo quando sono successi
  const onHash = () => { marks.route = performance.now(); };
  const onResize = () => { marks.resize = performance.now(); };
  const onFocus = () => { marks.focus = performance.now(); };
  const onWheel = () => { marks.scroll = performance.now(); };
  const onKey = () => { marks.key = performance.now(); };
  const onClick = () => { marks.click = performance.now(); };
  // tornando su questa scheda dopo un po', il primo fotogramma arriva "in ritardo" per forza: non è un buco
  const onVisibility = () => { last = null; };
  const listeners = [
    [window, "hashchange", onHash, {}],
    [window, "resize", onResize, {}],
    [window, "focus", onFocus, {}],
    [window, "wheel", onWheel, { passive: true, capture: true }],
    [document, "keydown", onKey, { capture: true }],
    [document, "pointerdown", onClick, { capture: true }],
    [document, "visibilitychange", onVisibility, {}],
  ];

  const start = () => {
    if (running) return;
    running = true;
    last = null;
    lastTransform = null;
    baseline = 16.7;
    Object.keys(marks).forEach((key) => { marks[key] = null; });
    resetNumbers();
    observers = [];
    if (watch("long-animation-frame", "frame")) workSource = "long-animation-frame, con la funzione responsabile";
    else if (watch("longtask", "task")) workSource = "longtask, solo la durata";
    else workSource = "non disponibile in questo browser";
    box = document.createElement("div");
    box.setAttribute("data-fps-meter", "");
    box.style.cssText = "position: fixed; top: 8px; left: 8px; z-index: 100002; background: rgba(20, 20, 20, 0.86); color: #f2f0e6; font: 11px/1.4 ui-monospace, Menlo, Consolas, monospace; padding: 8px 10px; border-radius: 6px; max-width: min(380px, calc(100vw - 16px)); box-sizing: border-box; pointer-events: none;";
    textEl = document.createElement("div");
    textEl.style.whiteSpace = "pre-wrap";
    const buttons = document.createElement("div");
    buttons.style.cssText = "margin-top: 6px; display: flex; gap: 6px; pointer-events: auto;";
    const style = "font: inherit; color: inherit; background: rgba(255, 255, 255, 0.14); border: 0; border-radius: 4px; padding: 3px 8px; cursor: pointer;";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copia rapporto";
    copy.style.cssText = style;
    copy.addEventListener("click", () => copyReport(copy));
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Azzera";
    reset.style.cssText = style;
    reset.addEventListener("click", () => { resetNumbers(); render(); });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Chiudi";
    close.style.cssText = style;
    close.addEventListener("click", () => stop());
    buttons.append(copy, reset, close);
    box.append(textEl, buttons);
    document.body.appendChild(box);
    listeners.forEach(([target, type, handler, options]) => target.addEventListener(type, handler, options));
    rafId = requestAnimationFrame(tick);
    timer = setInterval(render, 400);
    render();
  };

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clearInterval(timer);
    listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
    observers.forEach((observer) => { try { observer.disconnect(); } catch (e) { /* già staccato */ } });
    observers = [];
    if (box) box.remove();
    box = textEl = null;
  };

  window.__fpsMeterToggle = (on) => { const want = on === undefined ? !running : Boolean(on); if (want) start(); else stop(); };
})();
