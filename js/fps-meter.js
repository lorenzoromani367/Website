/* Contatore di fluidità. Non fa parte del sito: serve a misurare, sul computer vero (scheda grafica, schermo, browser), quello che da un
   altro computer non si vede. Si accende e si spegne con Opzione+Maiusc+F (o aprendo il sito con ?fps in fondo all'indirizzo); chi
   visita il sito non lo carica nemmeno: lo scarica app_v58.js solo in quel momento.

   In alto a sinistra mostra:
   - quanti fotogrammi al secondo sta disegnando il browser adesso (60 su uno schermo normale, 120 su uno veloce, meno se il Mac limita
     le animazioni, per esempio in risparmio energetico) e il fotogramma più lento degli ultimi 10 secondi;
   - quanti "buchi" ci sono stati da quando è acceso (un buco è un fotogramma arrivato dopo quasi il doppio del tempo normale: a
     occhio è un singhiozzo) e gli ultimi, con quanto tempo dopo l'inizio dell'ultimo scorrimento della galleria sono capitati.
   "Copia" mette il rapporto negli appunti, da incollare in chat. */
(() => {
  if (window.__fpsMeterToggle) return;

  let box = null;
  let textEl = null;
  let rafId = 0;
  let running = false;
  let timer = 0;
  let last = null; // istante dell'ultimo fotogramma
  let startedAt = 0;
  let frames = []; // [istante, durata] degli ultimi 10 secondi
  let gaps = []; // buchi: { at, dt, since, hash }
  let gapCount = 0;
  let gapOver50 = 0;
  let gapOver100 = 0;
  let slideAt = null; // istante in cui è partito l'ultimo scorrimento della galleria
  let lastTransform = null;

  const median = (list) => {
    if (!list.length) return 16.7;
    const sorted = list.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const fmt = (ms) => `${Math.round(ms)} ms`;
  const secs = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

  const tick = (ts) => {
    rafId = requestAnimationFrame(tick);
    if (last != null && !document.hidden) {
      const dt = ts - last;
      if (dt > 0 && dt < 1000) {
        frames.push([ts, dt]);
        const recent = frames.slice(-120).map((f) => f[1]);
        const normal = median(recent);
        if (recent.length >= 30 && dt > Math.max(1.9 * normal, normal + 8)) {
          gapCount++;
          if (dt > 50) gapOver50++;
          if (dt > 100) gapOver100++;
          gaps.push({ at: ts - startedAt, dt, since: slideAt != null && ts - slideAt < 7000 ? ts - slideAt : null, hash: location.hash });
          if (gaps.length > 40) gaps.shift();
        }
      }
    }
    last = ts;
    while (frames.length && ts - frames[0][0] > 10000) frames.shift();
    // inizio di uno scorrimento tra le foto: la galleria cambia la "transform" del suo binario
    const track = document.querySelector(".photo-track");
    if (track) {
      const value = track.style.transform;
      if (value !== lastTransform) { if (lastTransform !== null) slideAt = ts; lastTransform = value; }
    } else {
      lastTransform = null;
    }
  };

  const summary = () => {
    const now = performance.now();
    const lastSecond = frames.filter((f) => now - f[0] <= 1000).length;
    const worst = frames.length ? Math.max(...frames.map((f) => f[1])) : 0;
    const normal = median(frames.slice(-120).map((f) => f[1]));
    return { lastSecond, worst, normal, hz: Math.round(1000 / normal), seconds: (now - startedAt) / 1000 };
  };

  const describeGap = (g) => `${fmt(g.dt)} · ${g.since != null ? `${secs(g.since)} dopo l'inizio dello scorrimento` : "mentre la galleria era ferma"}`;

  const report = () => {
    const s = summary();
    const lines = [
      `Rapporto di fluidità — ${new Date().toLocaleString("it-IT")}`,
      `Browser: ${navigator.userAgent}`,
      `Finestra: ${innerWidth}×${innerHeight}, densità ${window.devicePixelRatio}×, circa ${s.hz} Hz`,
      `Pagina: ${location.hash || "#/"}`,
      `Acceso da ${Math.round(s.seconds)} s. Ora ${s.lastSecond} fotogrammi/s; il più lento degli ultimi 10 s: ${fmt(s.worst)}`,
      `Buchi: ${gapCount} (oltre 50 ms: ${gapOver50}; oltre 100 ms: ${gapOver100})`,
    ];
    if (gaps.length) {
      lines.push("Ultimi buchi:");
      gaps.slice(-15).forEach((g) => lines.push(`- ${describeGap(g)} (${g.hash || "#/"})`));
    }
    return lines.join("\n");
  };

  const render = () => {
    if (!textEl) return;
    const s = summary();
    const rows = [
      `Fluidità: ${s.lastSecond} fotogrammi/s (schermo ~${s.hz} Hz)`,
      `Il più lento degli ultimi 10 s: ${fmt(s.worst)}`,
      `Buchi da quando è acceso (${Math.round(s.seconds)} s): ${gapCount}`,
      `   oltre 50 ms: ${gapOver50} · oltre 100 ms: ${gapOver100}`,
    ];
    if (gaps.length) {
      rows.push("Ultimi:");
      gaps.slice(-4).reverse().forEach((g) => rows.push(` ${describeGap(g)}`));
    }
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

  const start = () => {
    if (running) return;
    running = true;
    last = null;
    startedAt = performance.now();
    frames = [];
    gaps = [];
    gapCount = gapOver50 = gapOver100 = 0;
    slideAt = null;
    lastTransform = null;
    box = document.createElement("div");
    box.setAttribute("data-fps-meter", "");
    box.style.cssText = "position: fixed; top: 8px; left: 8px; z-index: 100002; background: rgba(20, 20, 20, 0.86); color: #f2f0e6; font: 11px/1.4 ui-monospace, Menlo, Consolas, monospace; padding: 8px 10px; border-radius: 6px; max-width: min(340px, calc(100vw - 16px)); box-sizing: border-box; pointer-events: none;";
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
    reset.addEventListener("click", () => { frames = []; gaps = []; gapCount = gapOver50 = gapOver100 = 0; startedAt = performance.now(); render(); });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Chiudi";
    close.style.cssText = style;
    close.addEventListener("click", () => stop());
    buttons.append(copy, reset, close);
    box.append(textEl, buttons);
    document.body.appendChild(box);
    rafId = requestAnimationFrame(tick);
    timer = setInterval(render, 400);
    document.addEventListener("visibilitychange", onVisibility);
    render();
  };

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    if (box) box.remove();
    box = textEl = null;
  };

  // tornando su questa scheda dopo un po', il primo fotogramma arriva "in ritardo" per forza: non è un buco
  const onVisibility = () => { last = null; };

  window.__fpsMeterToggle = (on) => { const want = on === undefined ? !running : Boolean(on); if (want) start(); else stop(); };
})();
