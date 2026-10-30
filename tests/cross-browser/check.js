'use strict';
/* ==========================================================================
   CONTROLLO SU PIÙ BROWSER
   Apre il sito (come lo vede chi lo visita: "?visitor") su tre motori — Chromium (Chrome, Edge, Vivaldi, Brave, Samsung
   Internet), Firefox e WebKit (il motore di Safari: su iPhone lo usano anche Chrome e Firefox) — in due formati (computer
   1440 × 900, telefono 390 × 844 con tocco), su TUTTE le pagine, e controlla:
     ERRORI (fanno fallire il controllo):
       - nessun errore JavaScript e nessun file del sito mancante o rifiutato (404, ecc.);
       - la pagina si disegna (c'è del testo) e non è mai più larga dello schermo;
       - tasto "torna alla home": tre lineette, area sensibile al tocco di almeno 44 × 44 px (minimo di Apple per un tocco);
       - Core Archive: lo "0" in fondo sulla stessa linea verticale del titolo e alla stessa distanza dall'ultima parola
         che in alto c'è tra il "0" e il titolo;
       - galleria di un progetto, su computer: mentre la galleria scorre e la foto cambia altezza (foto più alta e più bassa) il numero con
         le frecce resta FERMO sullo schermo (sposta la pagina, non la barra: startBarHold in js/app_v58.js); su telefono la pagina
         non si muove; in Mediality la foto non sale di scatto quando la successiva è più alta (al massimo 150 px al secondo: la stessa onda lenta della discesa);
         chi scende con la rotella e si ferma a metà pagina viene accompagnato in fondo, chi sale resta dove si ferma.
     AVVISI (si leggono nel riassunto, non fanno fallire): differenze di misura tra i motori (altezza della pagina e
       posizione/dimensione degli elementi principali).
   Produce: riassunto in italiano (report/riassunto.md, anche nella pagina della corsa su GitHub), report.json, le schermate
   di ogni motore (report/schermate) e i confronti affiancati Chromium | Firefox | WebKit (report/confronti).
   Uso:  node check.js --site=../../_site --out=report [--engines=chromium,firefox,webkit] [--quick]
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const http = require('http');

const pw = (() => {
  try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); }
})();

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return [m[1], m[2] === '' ? true : m[2]]; }));
const SITE = path.resolve(String(args.site || '../../_site'));
// --url=https://...: invece di servire la cartella del sito, apre il sito VERO pubblicato (come lo vede un visitatore: senza "?visitor",
// anche con l'indirizzo senza "#"). Serve a capire se un problema visto su un telefono dipende dal sito pubblicato o da quel telefono.
const LIVE_URL = args.url && args.url !== true ? String(args.url).replace(/\/+$/, '') : null;
const OUT = path.resolve(String(args.out || 'report'));
const ENGINES = String(args.engines || 'chromium,firefox,webkit').split(',').filter(Boolean);
const QUICK = !!args.quick;
const SETTLE_MS = Number(args.settle || 1800);
const LABEL = { chromium: 'Chromium (Chrome, Edge, Vivaldi)', firefox: 'Firefox', webkit: 'WebKit (Safari)', 'chromium-linux': 'Chromium di serie su Linux (lettere arrotondate)' };
// Chromium parte con "--font-render-hinting=none": come Chrome su Mac e su Windows, dove la larghezza delle lettere NON si arrotonda
// al pixel intero. Di serie su Linux (i computer di GitHub) invece sì: il testo viene più largo del 3 % circa e 8-13 paragrafi
// su 300 vanno a capo una riga prima/dopo rispetto a Firefox, Safari e a un Chrome vero (verificato: con questa opzione le
// larghezze coincidono con quelle di Firefox e WebKit entro lo 0,6 %). "chromium-linux" = quello di serie, solo per diagnosi.
const VARIANTS = {
  chromium: { engine: 'chromium', args: ['--font-render-hinting=none'] },
  'chromium-linux': { engine: 'chromium' },
  firefox: { engine: 'firefox' },
  webkit: { engine: 'webkit' },
};
// Tre formati: computer con schermo normale (1 punto per pixel), computer con schermo "retina" come i Mac (2 punti per pixel:
// qui le lettere non si arrotondano al pixel intero e le righe del testo vanno a capo come sul Mac) e telefono come un iPhone (3).
// Le schermate si salvano solo per il primo e l'ultimo (alla misura dello schermo, non ai pixel veri: file più leggeri).
const PROFILES = {
  computer: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: false, isMobile: false, shots: true },
  'computer retina': { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false, shots: false },
  telefono: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, shots: true },
};
// Pagine di cui si salvano le schermate (e il confronto affiancato): le altre si controllano e basta.
const SHOT_ROUTES = ['', '#/', '#/project/boudaries', '#/project/stills', '#/project/sospension', '#/archive', '#/about', '#/contacts'];
// Sotto queste differenze tra i motori non si avvisa (i caratteri e gli arrotondamenti cambiano di qualche decimo di pixel).
const WARN_PX = 4;
const WARN_DOC_HEIGHT_PX = 10;
// Il testo piccolo (12 px) si disegna con sfumature un po' diverse da un motore all'altro: sulle pagine di solo testo, su telefono, fino al 96,4 %
// di somiglianza e all'8 % di punti molto diversi è normale. Si avvisa solo oltre: è il segno di un'immagine che manca o di un blocco spostato.
const VISUAL_WARN_SIM = 95; // sotto questa somiglianza (%) con Chromium si avvisa
const VISUAL_WARN_BIG = 8; // oltre questa quota (%) di punti molto diversi si avvisa

/* ------------------------------ piccolo server statico ------------------------------ */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function startServer(root) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        if (rel.endsWith('/')) rel += 'index.html';
        const file = path.join(root, path.normalize(rel));
        if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
        fs.stat(file, (err, st) => {
          if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Non trovato'); }
          res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
          if (req.method === 'HEAD') return res.end();
          fs.createReadStream(file).pipe(res);
        });
      } catch (e) { res.writeHead(400); res.end(); }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* ------------------------------ misure dentro la pagina ------------------------------ */
function measureInPage() {
  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(2), t: +(b.top + window.scrollY).toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2) }; };
  const out = {
    innerW: window.innerWidth, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight,
    textLen: (document.body.innerText || '').trim().length,
    page: rect(document.querySelector('.page')), topbar: rect(document.querySelector('.topbar')), title: rect(document.querySelector('.topbar-title')),
    description: rect(document.querySelector('.description')), firstFrame: rect(document.querySelector('.photo-frame')), firstCaption: rect(document.querySelector('.caption-input')),
  };
  // a capo: quante righe occupa ogni paragrafo di testo e ogni didascalia (se un motore spezza una riga in un punto diverso, qui si vede)
  const lineCount = (el) => {
    try {
      const rg = document.createRange(); rg.selectNodeContents(el);
      const tops = [...rg.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5).map((q) => q.top).sort((a, b) => a - b);
      let n = 0, last = -1e9; for (const t of tops) if (t - last > 8) { n++; last = t; }
      return n;
    } catch (e) { return -1; }
  };
  const natWidth = (el) => { try { const cs = getComputedStyle(el); const sp = document.createElement('span'); sp.style.cssText = `position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};letter-spacing:${cs.letterSpacing};font-kerning:${cs.fontKerning};text-rendering:${cs.textRendering}`; sp.textContent = el.textContent; document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove(); return +w.toFixed(2); } catch (e) { return -1; } };
  out.paragraphs = [...document.querySelectorAll('#app p, #app .contact-line')].filter((e) => !e.closest('[aria-hidden="true"]') && e.getBoundingClientRect().width > 0).slice(0, 60).map((e) => { const n = lineCount(e); return { t: (e.textContent || '').trim().slice(0, 28), n, cw: +e.getBoundingClientRect().width.toFixed(2), nat: n >= 2 ? natWidth(e) : 0 }; });
  out.captionLines = [...document.querySelectorAll('.caption-input')].filter((e) => e.getBoundingClientRect().width > 0).slice(0, 60).map((e) => { const cs = getComputedStyle(e); return Math.round((e.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / (parseFloat(cs.lineHeight) || 18)); });
  // immagini che il browser non è riuscito a mostrare (file illeggibile per quel motore) e carattere del sito
  out.brokenImages = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.currentSrc.startsWith('data:')).map((i) => decodeURIComponent(i.currentSrc.split('/').slice(-2).join('/'))).slice(0, 5);
  out.siteFont = (() => { try { const faces = [...document.fonts].filter((f) => /Strichpunkt/i.test(f.family)); return faces.length ? faces.map((f) => f.status).join(',') : 'assente'; } catch (e) { return 'non leggibile'; } })();
  // tasto "torna alla home"
  const h = document.querySelector('.hamburger');
  if (h) {
    const lines = [...h.querySelectorAll('span')].map((s) => s.getBoundingClientRect());
    const cx = lines.length ? lines[0].left + lines[0].width / 2 : 0; const cy = lines.length ? (lines[0].top + lines[lines.length - 1].bottom) / 2 : 0;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (let x = Math.floor(cx - 40); x <= Math.ceil(cx + 40); x++) for (let y = Math.floor(cy - 40); y <= Math.ceil(cy + 40); y++) {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === h || h.contains(hit))) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    out.hamburger = { lines: lines.length, lineW: lines.length ? +lines[0].width.toFixed(2) : 0, lineH: lines.length ? +lines[0].height.toFixed(2) : 0, right: lines.length ? +lines[0].right.toFixed(2) : 0, cy: +cy.toFixed(2), hitW: maxX >= minX ? maxX - minX + 1 : 0, hitH: maxY >= minY ? maxY - minY + 1 : 0 };
  }
  // Core Archive: lo "0" in fondo
  const words = [...document.querySelectorAll('.archive-word')];
  const zero = document.querySelector('.gallerybar .topbar-index'); const topIndex = document.querySelector('.topbar .topbar-index'); const title = document.querySelector('.topbar-title');
  if (words.length && zero && topIndex && title) {
    const z = zero.getBoundingClientRect(), t = title.getBoundingClientRect(), ti = topIndex.getBoundingClientRect(), last = words[words.length - 1].getBoundingClientRect();
    out.archive = { words: words.length, lineDiff: +(z.left - t.left).toFixed(2), gapTop: +(t.top - ti.bottom).toFixed(2), gapBottom: +(z.top - last.bottom).toFixed(2), inside: z.right <= document.querySelector('.page').getBoundingClientRect().right };
  }
  return out;
}

/* ------------------------------ una pagina, un motore, un formato ------------------------------ */
async function checkPage(context, base, origin, route, withShot, shotPath) {
  const problems = [];
  const page = await context.newPage();
  const errors = []; const bad = [];
  page.on('pageerror', (e) => errors.push(`errore JavaScript: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on('response', (r) => { try { const u = new URL(r.url()); if (u.origin === origin && r.status() >= 400 && !/favicon/i.test(u.pathname)) bad.push(`${r.status()} ${u.pathname}`); } catch (e) { /* indirizzo non leggibile */ } });
  page.on('requestfailed', (r) => { try { const u = new URL(r.url()); if (u.origin === origin && !/favicon/i.test(u.pathname)) bad.push(`non scaricato ${u.pathname} (${(r.failure() && r.failure().errorText) || '?'})`); } catch (e) { /* idem */ } });
  let metrics = null;
  try {
    for (let attempt = 1; ; attempt++) {
      try { await page.goto(`${base}/${LIVE_URL ? '' : '?visitor'}${route}`, { waitUntil: 'load', timeout: 45000 }); await page.waitForSelector('#app > *', { state: 'attached', timeout: 20000 }); break; }
      catch (e) { if (attempt >= 2) throw e; await page.waitForTimeout(1500); }
    }
    await page.evaluate(() => (document.fonts && document.fonts.ready) || null);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    metrics = await page.evaluate(measureInPage);
    // Il testo di un progetto deve comparire: se in testi/ c'è un file col nome del progetto (o col suo indirizzo interno) e non è
    // vuoto, la pagina deve mostrarlo. Succedeva che dopo aver rinominato un progetto ("Boundaries" → "Collusion") e scritto il testo in
    // un file col nuovo nome, la pagina restasse con le sole foto (il sito cercava solo il vecchio indirizzo interno).
    try {
      const textCheck = await page.evaluate(async () => {
        const m = location.hash.match(/^#\/project\/([^/]+)/);
        if (!m || typeof PROJECTS === 'undefined') return null;
        const project = PROJECTS.find((p) => p.slug === m[1]);
        if (!project) return null;
        const lower = new Map((Array.isArray(window.DYNAMIC_TEXTS) ? window.DYNAMIC_TEXTS : []).map((f) => [f.toLowerCase(), f]));
        const name = String(project.name || '').trim().toLowerCase();
        const file = [name, name.replace(/\s+/g, '-'), name.replace(/\s+/g, '_'), project.slug].map((c) => lower.get(`${c}.txt`)).find(Boolean);
        if (!file) return { file: null };
        const body = (await (await fetch(`testi/${encodeURIComponent(file)}`)).text()).trim();
        const shown = [...document.querySelectorAll('.description-content p')].map((p) => p.textContent.trim()).filter(Boolean).join(' ').length;
        return { file, length: body.length, shown };
      });
      if (textCheck && textCheck.file && textCheck.length > 0 && textCheck.shown === 0) problems.push(`il testo di testi/${textCheck.file} non compare nella pagina del progetto`);
    } catch (e) { /* controllo accessorio: se non si riesce a farlo non si inventa un errore */ }
    // Anche la galleria deve comparire: se in images/ ci sono foto del progetto (cartella col suo indirizzo interno o col suo nome),
    // la pagina deve mostrarne almeno una. Succedeva che dopo aver rinominato la cartella delle foto ("boudaries" → "collusion") la
    // galleria restasse vuota: il sito toglieva le foto che content.js ricordava ancora nella cartella col vecchio nome.
    try {
      const galleryCheck = await page.evaluate(() => {
        const m = location.hash.match(/^#\/project\/([^/]+)/);
        if (!m || typeof PROJECTS === 'undefined') return null;
        const project = PROJECTS.find((p) => p.slug === m[1]);
        if (!project) return null;
        const name = String(project.name || '').trim().toLowerCase();
        const folders = [String(project.slug).toLowerCase(), name, name.replace(/\s+/g, '-'), name.replace(/\s+/g, '_')].filter(Boolean);
        const onDisk = (Array.isArray(window.DYNAMIC_IMAGES) ? window.DYNAMIC_IMAGES : []).filter((f) => folders.some((d) => f.toLowerCase().startsWith(`images/${d}/`))).length;
        const shown = [...document.querySelectorAll('.photo-frame img')].filter((i) => i.getAttribute('src') && !i.getAttribute('src').startsWith('data:')).length;
        return { onDisk, shown };
      });
      if (galleryCheck && galleryCheck.onDisk > 0 && galleryCheck.shown === 0) problems.push(`la galleria del progetto è vuota anche se in images/ ci sono ${galleryCheck.onDisk} sue foto`);
    } catch (e) { /* controllo accessorio */ }
    if (withShot) { await page.addStyleTag({ content: '.description-track{transform:none !important;animation:none !important} *{caret-color:transparent !important}' }); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: shotPath, fullPage: true, type: 'jpeg', quality: 62, scale: 'css' }); }
  } catch (e) {
    problems.push(`la pagina non si è caricata: ${String(e.message).split('\n')[0]}`);
  }
  if (errors.length) problems.push(...[...new Set(errors)].slice(0, 4));
  if (bad.length) problems.push(...[...new Set(bad)].slice(0, 4).map((b) => `file del sito mancante o rifiutato: ${b}`));
  if (metrics) {
    if (metrics.textLen < 8) problems.push('la pagina è rimasta vuota');
    if (metrics.brokenImages && metrics.brokenImages.length) problems.push(`immagini che non si vedono: ${metrics.brokenImages.join(', ')}`);
    if (metrics.siteFont && !/loaded/.test(metrics.siteFont) && metrics.siteFont !== 'assente') problems.push(`il carattere del sito non si è caricato (stato: ${metrics.siteFont})`);
    if (metrics.docW > metrics.innerW + 1) problems.push(`la pagina è più larga dello schermo (${metrics.docW} px contro ${metrics.innerW} px)`);
    const h = metrics.hamburger;
    if (h) {
      if (h.lines !== 3) problems.push(`il tasto "torna alla home" ha ${h.lines} lineette invece di 3`);
      // 44 px è il minimo di Apple; la misura si fa su pixel interi e ogni motore arrotonda a modo suo (Firefox dà 43 dove gli altri danno 44): 1 px di tolleranza
      if (context.__profile === 'telefono' && (h.hitW < 43 || h.hitH < 43)) problems.push(`il tasto "torna alla home" è troppo piccolo da toccare (${h.hitW} × ${h.hitH} px, minimo 44 × 44)`);
    }
    const a = metrics.archive;
    if (a) {
      if (Math.abs(a.lineDiff) > 0.6) problems.push(`Core Archive: lo "0" in fondo non è sulla linea del titolo (${a.lineDiff} px di differenza)`);
      if (Math.abs(a.gapBottom - a.gapTop) > 1) problems.push(`Core Archive: distanza ultima parola → 0 = ${a.gapBottom} px, in alto 0 → titolo = ${a.gapTop} px`);
      if (!a.inside) problems.push('Core Archive: lo "0" in fondo esce dal foglio');
    }
  }
  await page.close();
  return { problems, metrics };
}

/* ------------------------------ inquadratura in fondo ------------------------------ */
// Quando la galleria scorre la foto cambia altezza (quasi sempre) e con lei la pagina: su computer la barra col numero e le frecce deve restare
// ferma sullo schermo, a muoversi deve essere la foto (startBarHold in js/app_v58.js: la pagina viene spostata a ogni fotogramma di quanto
// basta). Si guarda la posizione della barra sullo schermo mentre cambia la foto: prima +62 px, poi +114, +60 e -177 (Complicity,
// #/project/boudaries); non deve spostarsi di più di 3 px (1-2 px sono l'arrotondamento a pixel interi del browser). Su telefono la pagina
// non si deve muovere. Si usa una pagina nuova: dopo un movimento della pagina fatto dall'utente (anche solo uno "scroll" mandato dal
// test) l'inquadratura iniziale aspetta 15 s per non portare via la pagina a chi la sta leggendo.
const FRAMING_ROUTE = '#/project/boudaries';
const BAR_TOLERANCE_PX = 3;
// Posizione della barra e della pagina sullo schermo, fotogramma per fotogramma, per "ms" millisecondi. "peak": velocità massima della pagina
// (pixel al secondo, su 4 fotogrammi), cioè con quale velocità sale o scende la foto quando la barra sta ferma.
const watchPage = (page, ms) => page.evaluate((duration) => new Promise((resolve) => {
  const bar = document.querySelector('.gallerybar'); const t0 = performance.now(); const tops = []; const ys = []; const ts = [];
  // (si legge DOPO che il fotogramma è pronto, con un timer subito dopo le funzioni di fotogramma: è quello che si vede, non lo stato a metà)
  const tick = () => { setTimeout(() => { tops.push(bar.getBoundingClientRect().top); ys.push(window.scrollY); ts.push(performance.now()); }, 0); if (performance.now() - t0 < duration) requestAnimationFrame(tick); else setTimeout(() => { let peak = 0; for (let k = 4; k < ys.length; k++) { const dt = ts[k] - ts[k - 4]; if (dt > 20) peak = Math.max(peak, Math.abs(ys[k] - ys[k - 4]) / dt * 1000); } resolve({ min: Math.min(...tops), max: Math.max(...tops), last: tops[tops.length - 1], y0: ys[0], y1: ys[ys.length - 1], peak }); }, 60); };
  requestAnimationFrame(tick);
}), ms);
async function checkFraming(context, base) {
  const problems = [];
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${LIVE_URL ? '' : '?visitor'}${FRAMING_ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    const read = () => page.evaluate(() => ({ y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight, photos: document.querySelectorAll('.photo-track > figure.photo:not(.photo-clone)').length }));
    const watchBar = (ms) => watchPage(page, ms);
    const before = await read();
    if (before.photos < 2 || before.max <= 8) return problems; // una foto sola, o la pagina sta tutta nella finestra: niente da tenere fermo
    if (context.__profile === 'telefono') {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(2500);
      const after = await read();
      if (Math.abs(after.y - before.y) > 3) problems.push(`su telefono la galleria che scorre ha mosso la pagina (da ${Math.round(before.y)} a ${Math.round(after.y)} px): la barra ferma è solo per il computer`);
      return problems;
    }
    // 1) primo scorrimento (+62 px): la pagina scende fino alla posizione di serie; si aspetta che arrivi
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(2600);
    const first = await read();
    if (first.y < before.y + 20) { problems.push(`la galleria scorre ma la pagina non si porta alla posizione di serie (è a ${Math.round(first.y)} px, era a ${Math.round(before.y)} px)`); return problems; }
    const base1 = (await watchBar(150)).last;
    // 2) foto più alta (+114 px), poi (+60 px), poi più bassa (-177 px, sei secondi): la barra non si muove
    const windows = [['foto più alta di 114 px', 2300], ['foto più alta di 60 px', 1800], ['foto più bassa di 177 px', 4200]];
    for (let i = 0; i < windows.length; i++) {
      const [label, ms] = windows[i];
      await page.keyboard.press('ArrowRight');
      const w = await watchBar(ms);
      if (w.max - w.min > BAR_TOLERANCE_PX) problems.push(`con la ${label} il numero con le frecce si sposta sullo schermo di ${(w.max - w.min).toFixed(1)} px (deve restare fermo: massimo ${BAR_TOLERANCE_PX} px)`);
      else if (Math.abs(w.last - base1) > BAR_TOLERANCE_PX) problems.push(`con la ${label} il numero con le frecce finisce ${(w.last - base1).toFixed(1)} px più in là di dov'era`);
      if (Math.abs(w.y1 - w.y0) < 1 && label !== 'foto più alta di 60 px') problems.push(`con la ${label} la pagina non si è spostata: la barra è ferma per caso?`);
      await page.waitForTimeout(700);
    }
  } catch (e) {
    problems.push(`prova della barra ferma non riuscita: ${String(e.message).split('\n')[0]}`);
  }
  await page.close();
  return problems;
}

// La foto non deve salire di scatto quando la successiva è più alta. Con la barra ferma, la pagina si sposta di quanto il riquadro si allunga e quel
// movimento è la salita della foto sullo schermo. Dal 30 ottobre (growTransitionFor in js/app_v58.js) si allunga con la stessa onda lenta di 6 secondi
// dell'accorciamento (velocità massima 2,3 volte la media: per 190 px circa 75 px al secondo); prima ci metteva da 0,2 a 2,3 s (da 200 a 2000 px al
// secondo): la salita era uno «scatto» in confronto alla discesa. Si guarda il primo passo, tra il secondo e il quinto, in cui la foto in arrivo è più alta di
// almeno RISE_MIN_PX (in Mediality, a 1440 × 900, dalla foto 3 alla 4: +190 px), così la prova non dipende da una misura precisa di una foto: chi
// ridimensiona le foto con l'editor ne cambia l'altezza.
const RISE_ROUTE = '#/project/mediality';
const RISE_MIN_PX = 60;
const PHOTO_PEAK_PX_S = 150;
async function checkPhotoRise(context, base) {
  const problems = [];
  if (context.__profile !== 'computer') return problems; // una volta sola per motore: né il retina (stesso risultato) né il telefono (la pagina non si muove)
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${LIVE_URL ? '' : '?visitor'}${RISE_ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    const geo = await page.evaluate(() => {
      // altezza del riquadro con ciascuna foto in vista: fino al punto più basso tra foto, didascalia e figura (come updateViewportHeight)
      const top = document.querySelector('.photo-viewport').getBoundingClientRect().top;
      const heights = [...document.querySelectorAll('.photo-track > figure.photo:not(.photo-clone)')].map((figure) => {
        let bottom = figure.getBoundingClientRect().bottom;
        figure.querySelectorAll('.photo-frame, .caption-box').forEach((node) => { bottom = Math.max(bottom, node.getBoundingClientRect().bottom); });
        return bottom - top;
      });
      return { max: document.documentElement.scrollHeight - window.innerHeight, heights };
    });
    if (geo.heights.length < 2 || geo.max <= 8) return problems;
    let from = -1; // (il primo passo non si misura: lì la pagina scende all'inquadratura di serie e quello sarebbe il movimento misurato)
    for (let i = 1; i < Math.min(5, geo.heights.length - 1); i++) { if (geo.heights[i + 1] - geo.heights[i] >= RISE_MIN_PX) { from = i; break; } }
    if (from < 0) return problems; // nessun passo con una foto molto più alta: niente da misurare
    const rise = geo.heights[from + 1] - geo.heights[from];
    for (let i = 0; i < from; i++) { // si arriva alla foto prima del passo, aspettando che ogni scorrimento sia finito (6 s)
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(6700);
    }
    await page.keyboard.press('ArrowRight'); // il passo con la foto più alta
    const w = await watchPage(page, 3000);
    console.log(`  [salita della foto] ${context.__engine}: passo con +${Math.round(rise)} px (dalla foto ${from + 1} alla ${from + 2}); nei primi 3 s la pagina si sposta di ${Math.round(Math.abs(w.y1 - w.y0))} px, al massimo ${Math.round(w.peak)} px/s (limite ${PHOTO_PEAK_PX_S})`);
    if (Math.abs(w.y1 - w.y0) < 40) problems.push(`in Mediality, con la foto più alta di ${Math.round(rise)} px in arrivo, la pagina non si è spostata abbastanza (${Math.round(Math.abs(w.y1 - w.y0))} px nei primi 3 s): la prova non ha misurato la salita`);
    else if (w.peak > PHOTO_PEAK_PX_S) problems.push(`in Mediality, con la foto più alta di ${Math.round(rise)} px in arrivo, la foto sale troppo di scatto: ${Math.round(w.peak)} px al secondo al massimo (deve restare sotto i ${PHOTO_PEAK_PX_S}: la salita dev'essere lenta e dolce come la discesa, vedi growTransitionFor in js/app_v58.js)`);
  } catch (e) {
    problems.push(`prova della salita della foto non riuscita: ${String(e.message).split('\n')[0]}`);
  }
  await page.close();
  return problems;
}

// Stessa prova, ma con la pagina già mossa dall'utente (rotella) in un punto in cui la barra si vede senza essere in fondo: lì la pagina non
// deve andare da nessuna parte, ma la barra deve restare dov'è mentre la foto cambia altezza (era il caso che non funzionava: l'inquadratura
// aspettava 15 s dall'ultimo movimento dell'utente e nel frattempo la barra saliva e scendeva con la foto).
// Chi scende per vedere le foto e si ferma a metà non resta lì: finito il gesto la pagina viene accompagnata in fondo (assistSettled in js/app_v58.js),
// con la barra del numero e delle frecce all'inquadratura di serie. Verso l'alto no: chi sale resta dove si ferma. Si prova con la rotella, come
// un utente: due scatti in giù dalla cima, poi un'attesa; la barra deve stare dove dice il registro del sito (holdY) e il registro deve dire che è
// stata accompagnata; poi uno scatto in su, e la pagina non deve più muoversi.
async function checkAssist(context, base) {
  const problems = [];
  if (context.__profile !== 'computer') return problems; // una volta sola per motore (né il retina, uguale, né il telefono, dove non c'è)
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${LIVE_URL ? '' : '?visitor'}${FRAMING_ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS + 1200); // (nei primi 2 s il sito non conta i movimenti della pagina: il browser a volte la rimette dov'era)
    const geo = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - window.innerHeight, h: window.innerHeight }));
    if (geo.max <= 150) { console.log(`  [accompagnamento] ${context.__engine}: saltata (la pagina scorre solo ${Math.round(geo.max)} px)`); return problems; }
    await page.mouse.move(Math.round(geo.h / 2), 300);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(80);
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);
    const moved = await page.evaluate(() => window.scrollY);
    if (moved < 20) { console.log(`  [accompagnamento] ${context.__engine}: saltata (la rotella non ha mosso la pagina)`); return problems; } // browser di prova: niente da controllare
    await page.waitForTimeout(3500);
    const after = await page.evaluate(() => {
      const log = (window.__framingLog || []).filter((e) => e.assist).slice(-1)[0] || null;
      return { y: window.scrollY, bar: document.querySelector('.gallerybar').getBoundingClientRect().top, log };
    });
    if (!after.log) problems.push(`scendendo con la rotella e fermandosi a metà (a ${Math.round(moved)} px) la pagina non è stata accompagnata in fondo: ora è a ${Math.round(after.y)} px`);
    else if (!after.log.ran) problems.push(`scendendo con la rotella la pagina non è stata accompagnata in fondo: ${after.log.why}`);
    else if (Math.abs(after.bar - after.log.holdY) > BAR_TOLERANCE_PX) problems.push(`scendendo con la rotella la pagina è stata accompagnata, ma il numero con le frecce è a ${Math.round(after.bar)} px dal bordo alto invece di ${after.log.holdY}`);
    // salendo, la pagina resta dove l'utente la lascia
    await page.mouse.wheel(0, -150);
    await page.waitForTimeout(700);
    const up1 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(2200);
    const up2 = await page.evaluate(() => window.scrollY);
    console.log(`  [accompagnamento] ${context.__engine}: la rotella ha portato la pagina a ${Math.round(moved)} px; dopo l'attesa è a ${Math.round(after.y)} px su ${Math.round(geo.max)} (barra a ${Math.round(after.bar)} px, registro ${after.log ? `holdY ${after.log.holdY}` : 'vuoto'}); in su: ${Math.round(up1)} → ${Math.round(up2)} px`);
    if (up1 > after.y - 20) return problems; // la rotella in su non ha mosso la pagina: niente da controllare
    if (Math.abs(up2 - up1) > BAR_TOLERANCE_PX) problems.push(`salendo con la rotella la pagina non è rimasta dove l'utente l'ha lasciata: da ${Math.round(up1)} a ${Math.round(up2)} px`);
  } catch (e) {
    problems.push(`prova dell'accompagnamento verso il fondo non riuscita: ${String(e.message).split('\n')[0]}`);
  }
  await page.close();
  return problems;
}

async function checkBarHoldAfterUserScroll(context, base) {
  const problems = [];
  if (context.__profile === 'telefono') return problems;
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${LIVE_URL ? '' : '?visitor'}${FRAMING_ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    const geo = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - window.innerHeight, h: window.innerHeight, barTop: document.querySelector('.gallerybar').getBoundingClientRect().top + window.scrollY, photos: document.querySelectorAll('.photo-track > figure.photo:not(.photo-clone)').length }));
    if (geo.photos < 2 || geo.max <= 8) return problems;
    // La pagina «mossa dall'utente» con la barra in vista ma non in fondo: l'utente è sceso fino in fondo e ha poi alzato la pagina di 100 px (se
    // scende e si ferma a metà la pagina viene accompagnata in fondo, vedi checkAssist; verso l'alto resta dov'è). Il test porta la pagina in
    // fondo con window.scrollTo (non vale come gesto dell'utente) e la rotella in su la alza.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    await page.mouse.move(Math.round(geo.h / 2), 300);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(900);
    await page.mouse.move(2, 2);
    const at = await page.evaluate(() => ({ y: window.scrollY, bar: document.querySelector('.gallerybar').getBoundingClientRect().top, h: window.innerHeight }));
    if (!(at.bar < at.h - 20)) return problems; // la rotella non ha portato la barra in vista (browser di prova): niente da controllare
    const watching = page.evaluate((duration) => new Promise((resolve) => {
      const bar = document.querySelector('.gallerybar'); const t0 = performance.now(); const tops = [];
      const tick = () => { setTimeout(() => { tops.push(bar.getBoundingClientRect().top); }, 0); if (performance.now() - t0 < duration) requestAnimationFrame(tick); else setTimeout(() => resolve({ min: Math.min(...tops), max: Math.max(...tops) }), 60); };
      requestAnimationFrame(tick);
    }), 2500);
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowRight');
    const w = await watching;
    if (w.max - w.min > BAR_TOLERANCE_PX) problems.push(`con la pagina già mossa dall'utente (barra in vista, non in fondo) il numero con le frecce si sposta sullo schermo di ${(w.max - w.min).toFixed(1)} px mentre la foto cambia altezza (deve restare fermo: massimo ${BAR_TOLERANCE_PX} px)`);
  } catch (e) {
    problems.push(`prova della barra ferma con la pagina mossa dall'utente non riuscita: ${String(e.message).split('\n')[0]}`);
  }
  await page.close();
  return problems;
}

/* ------------------------------ un motore intero ------------------------------ */
async function runEngine(engine, base, origin, routes) {
  const variant = VARIANTS[engine] || { engine };
  const browser = await pw[variant.engine].launch(variant.args ? { args: variant.args } : {});
  const version = browser.version();
  const results = [];
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    const opts = { viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, hasTouch: profile.hasTouch };
    if (profile.isMobile && variant.engine !== 'firefox') opts.isMobile = true; // Firefox non conosce "isMobile": il formato telefono si decide dalla larghezza (come fa il sito)
    const context = await browser.newContext(opts);
    context.__profile = profileName;
    context.__engine = engine;
    if (variant.css) await context.addInitScript((css) => { const add = () => { const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st); }; add(); }, variant.css);
    for (const route of routes) {
      const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || (route === '' ? 'indirizzo_semplice' : 'home');
      const withShot = profile.shots && SHOT_ROUTES.includes(route);
      const shotPath = path.join(OUT, 'schermate', `${slug}__${profileName.replace(/\s+/g, '-')}__${engine}.jpg`);
      const r = await checkPage(context, base, origin, route, withShot, shotPath);
      if (route === FRAMING_ROUTE) { r.problems.push(...await checkFraming(context, base)); r.problems.push(...await checkBarHoldAfterUserScroll(context, base)); r.problems.push(...await checkAssist(context, base)); }
      if (route === RISE_ROUTE) r.problems.push(...await checkPhotoRise(context, base));
      results.push({ engine, profile: profileName, route, problems: r.problems, metrics: r.metrics, shot: withShot && fs.existsSync(shotPath) ? shotPath : null });
    }
    await context.close();
  }
  await browser.close();
  return { engine, version, results };
}

/* ------------------------------ confronti affiancati ------------------------------ */
async function contactSheets(all) {
  const groups = {};
  for (const e of all) for (const r of e.results) if (r.shot) { const key = `${r.route}|${r.profile}`; (groups[key] = groups[key] || {})[e.engine] = r.shot; }
  const keys = Object.keys(groups); if (!keys.length) return [];
  fs.mkdirSync(path.join(OUT, 'confronti'), { recursive: true });
  const browser = await pw.chromium.launch(); const page = await browser.newPage({ viewport: { width: 1900, height: 900 } });
  const files = [];
  for (const key of keys) {
    const [route, profile] = key.split('|'); const w = profile === 'telefono' ? 300 : 600;
    const cells = ENGINES.filter((e) => groups[key][e]).map((e) => `<div style="width:${w}px"><div style="padding:5px 8px;background:#222;color:#fff">${LABEL[e]}</div><img style="width:${w}px;display:block" src="data:image/jpeg;base64,${fs.readFileSync(groups[key][e]).toString('base64')}"></div>`).join('');
    await page.setContent(`<body style="margin:0;background:#fff;font:14px Arial,sans-serif"><div style="padding:6px 8px;font-weight:bold">${route} — ${profile}</div><div style="display:flex;gap:10px;padding:0 8px 8px">${cells}</div></body>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {});
    const file = path.join(OUT, 'confronti', `${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || (route === '' ? 'indirizzo_semplice' : 'home')}__${profile}.jpg`);
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 70 }); files.push(file);
  }
  await browser.close();
  return files;
}

/* ------------------------------ differenze tra i motori ------------------------------ */
function engineDifferences(all) {
  const diffs = [];
  const everything = [];
  const by = {};
  for (const e of all) for (const r of e.results) if (r.metrics) (by[`${r.route}|${r.profile}`] = by[`${r.route}|${r.profile}`] || {})[e.engine] = r.metrics;
  const fields = (m) => {
    const f = { 'altezza della pagina': m.docH };
    for (const k of ['page', 'topbar', 'title', 'description', 'firstFrame', 'firstCaption']) if (m[k]) for (const p of ['l', 't', 'w', 'h']) f[`${k}.${p}`] = m[k][p];
    if (m.hamburger) { f['tasto home: larghezza lineette'] = m.hamburger.lineW; f['tasto home: bordo destro'] = m.hamburger.right; f['tasto home: area tocco larga'] = m.hamburger.hitW; f['tasto home: area tocco alta'] = m.hamburger.hitH; }
    if (m.archive) { f['archive: distanza in alto'] = m.archive.gapTop; f['archive: distanza in fondo'] = m.archive.gapBottom; }
    return f;
  };
  for (const [key, engines] of Object.entries(by)) {
    const names = Object.keys(engines); if (names.length < 2) continue;
    const per = Object.fromEntries(names.map((n) => [n, fields(engines[n])]));
    for (const field of Object.keys(per[names[0]])) {
      const vals = names.map((n) => per[n][field]).filter((v) => typeof v === 'number');
      if (vals.length < 2) continue;
      const spread = Math.max(...vals) - Math.min(...vals);
      const limit = field === 'altezza della pagina' ? WARN_DOC_HEIGHT_PX : WARN_PX;
      const [route, profile] = key.split('|');
      const entry = { route, profile, field, spread: +spread.toFixed(2), values: Object.fromEntries(names.map((n) => [n, per[n][field]])) };
      everything.push(entry);
      if (spread > limit) diffs.push(entry);
    }
  }
  // a capo diversi: stesso paragrafo (o stessa didascalia) su più o meno righe da un motore all'altro
  diffs.wraps = [];
  for (const [key, engines] of Object.entries(by)) {
    const names = Object.keys(engines); if (names.length < 2) continue; const [route, profile] = key.split('|');
    const pl = names.map((n) => engines[n].paragraphs || []); const cl = names.map((n) => engines[n].captionLines || []);
    if (pl.every((a) => a.length === pl[0].length)) pl[0].forEach((p, i) => { const counts = pl.map((a) => a[i].n); if (Math.max(...counts) !== Math.min(...counts)) diffs.wraps.push({ route, profile, what: `paragrafo "${p.t}…"`, values: Object.fromEntries(names.map((n, k) => [n, `${counts[k]} (testo su una riga ${pl[k][i].nat} px, riquadro ${pl[k][i].cw} px)`])) }); });
    if (cl.every((a) => a.length === cl[0].length)) cl[0].forEach((c, i) => { const counts = cl.map((a) => a[i]); if (Math.max(...counts) !== Math.min(...counts)) diffs.wraps.push({ route, profile, what: `didascalia n. ${i + 1}`, values: Object.fromEntries(names.map((n, k) => [n, counts[k]])) }); });
    diffs.wrapsChecked = (diffs.wrapsChecked || 0) + (pl.every((a) => a.length === pl[0].length) ? pl[0].length : 0) + (cl.every((a) => a.length === cl[0].length) ? cl[0].length : 0);
  }
  diffs.sort((a, b) => b.spread - a.spread);
  diffs.top = everything.sort((a, b) => b.spread - a.spread).slice(0, 6); // le più grandi anche se sotto soglia: dice di quanto, in pratica, i motori coincidono
  return diffs;
}

/* ------------------------------ somiglianza visiva con Chromium ------------------------------ */
// Mette una sopra l'altra le schermate della stessa pagina (ridotte a 480 px di larghezza, per non contare le sfumature dei
// bordi delle lettere) e misura quanto si assomigliano: 100 % = identiche. "px molto diversi" = quota di punti che cambiano
// di colore in modo evidente (immagine mancante, lettere in un altro carattere, blocco spostato).
async function visualSimilarity(all) {
  const ref = all.find((e) => e.engine === 'chromium'); if (!ref || all.length < 2) return [];
  const out = [];
  const browser = await pw.chromium.launch(); const page = await browser.newPage();
  const dataUrl = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
  for (const r of ref.results) {
    if (!r.shot) continue;
    for (const e of all) {
      if (e.engine === 'chromium') continue;
      const o = e.results.find((x) => x.route === r.route && x.profile === r.profile);
      if (!o || !o.shot) continue;
      try {
        const res = await page.evaluate(async ([a, b]) => {
          const load = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('immagine illeggibile')); i.src = src; });
          const [ia, ib] = await Promise.all([load(a), load(b)]);
          const W = 480; const sa = W / ia.naturalWidth, sb = W / ib.naturalWidth;
          const H = Math.floor(Math.min(ia.naturalHeight * sa, ib.naturalHeight * sb));
          const grab = (img, sc) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, img.naturalWidth, H / sc, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
          const A = grab(ia, sa), B = grab(ib, sb); let sum = 0, big = 0; const n = W * H;
          for (let i = 0; i < A.length; i += 4) { const dr = Math.abs(A[i] - B[i]), dg = Math.abs(A[i + 1] - B[i + 1]), db = Math.abs(A[i + 2] - B[i + 2]); sum += (dr + dg + db) / 3; if (Math.max(dr, dg, db) > 48) big++; }
          return { similarity: +(100 - (sum / n / 255) * 100).toFixed(2), bigPct: +((big / n) * 100).toFixed(2), hA: ia.naturalHeight, hB: ib.naturalHeight, wA: ia.naturalWidth };
        }, [dataUrl(r.shot), dataUrl(o.shot)]);
        out.push({ route: r.route, profile: r.profile, engine: e.engine, ...res });
      } catch (err) { out.push({ route: r.route, profile: r.profile, engine: e.engine, error: err.message }); }
    }
  }
  await browser.close();
  return out;
}

/* ------------------------------ riassunto ------------------------------ */
function summary(all, diffs, started, visual) {
  const lines = [];
  const total = all[0] ? all[0].results.length : 0;
  lines.push('# Controllo su più browser', '');
  lines.push(`Commit \`${(process.env.GITHUB_SHA || 'locale').slice(0, 8)}\` · ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC · durata ${Math.round((Date.now() - started) / 1000)} s`, '');
  lines.push(QUICK ? `Prova rapida: ${total / Object.keys(PROFILES).length} pagine, nei tre formati.` : `Pagine controllate: ${total / Object.keys(PROFILES).length} (tutte quelle del sito), ciascuna in tre formati (computer, computer con schermo retina, telefono), su ogni motore.`, '');
  lines.push('| Motore | Versione | Pagine con problemi |', '|---|---|---|');
  for (const e of all) { const bad = e.results.filter((r) => r.problems.length).length; lines.push(`| ${LABEL[e.engine]} | ${e.version} | ${bad === 0 ? '✅ nessuna' : '❌ ' + bad} |`); }
  const problems = all.flatMap((e) => e.results.filter((r) => r.problems.length).map((r) => ({ e: e.engine, r })));
  lines.push('');
  if (problems.length) {
    lines.push('## ❌ Problemi', '');
    for (const { e, r } of problems) for (const p of r.problems) lines.push(`- **${LABEL[e]}**, ${r.profile}, \`${r.route}\`: ${p}`);
  } else lines.push('## ✅ Nessun problema', '', 'Nessun errore JavaScript, nessun file mancante, nessuna pagina più larga dello schermo, tasto home sempre toccabile, Core Archive in regola, numero e frecce della galleria fermi sullo schermo mentre la foto cambia altezza e foto che sale piano, senza scatti (solo su computer).');
  lines.push('');
  if (all.length > 1) {
    lines.push('## Differenze tra i motori (avvisi)', '');
    if (!diffs.length) {
      lines.push(`Nessuna differenza oltre ${WARN_PX} px (${WARN_DOC_HEIGHT_PX} px per l'altezza della pagina). Le più grandi trovate, in ogni caso:`, '');
      if (diffs.top && diffs.top.length) { lines.push('| Pagina | Formato | Misura | Differenza | Valori |', '|---|---|---|---|---|'); for (const d of diffs.top) lines.push(`| \`${d.route}\` | ${d.profile} | ${d.field} | ${d.spread} px | ${Object.entries(d.values).map(([k, v]) => `${k} ${v}`).join(' · ')} |`); }
    }
    else {
      lines.push(`Misure che cambiano di più di ${WARN_PX} px da un motore all'altro (prime 25 su ${diffs.length}). Non è un errore: è dove guardare le schermate in \`confronti\`.`, '', '| Pagina | Formato | Misura | Differenza | Valori |', '|---|---|---|---|---|');
      for (const d of diffs.slice(0, 25)) lines.push(`| \`${d.route}\` | ${d.profile} | ${d.field} | ${d.spread} px | ${Object.entries(d.values).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
    }
  }
  if (all.length > 1) {
    lines.push('', '## A capo del testo', '');
    if (!diffs.wraps || !diffs.wraps.length) lines.push(`✅ Identici su tutti i motori: ${diffs.wrapsChecked || 0} blocchi di testo (paragrafi e didascalie) controllati, nessuno va a capo in un punto diverso.`);
    else { lines.push(`⚠ ${diffs.wraps.length} blocchi di testo occupano un numero di righe diverso da un motore all'altro (su ${diffs.wrapsChecked || '?'} controllati):`, '', '| Pagina | Formato | Testo | Righe per motore |', '|---|---|---|---|'); for (const w of diffs.wraps.slice(0, 30)) lines.push(`| \`${w.route}\` | ${w.profile} | ${w.what} | ${Object.entries(w.values).map(([k, v]) => `${k} ${v}`).join(' · ')} |`); }
  }
  if (visual && visual.length) {
    lines.push('', '## Somiglianza visiva con Chromium', '', 'Schermate della stessa pagina messe una sopra l\'altra (100 % = identiche; tra parentesi la quota di punti che cambiano colore in modo evidente).', '');
    const keys = [...new Set(visual.map((v) => `${v.route}|${v.profile}`))]; const engines = [...new Set(visual.map((v) => v.engine))];
    lines.push(`| Pagina | Formato | ${engines.map((e) => LABEL[e]).join(' | ')} |`, `|---|---|${engines.map(() => '---').join('|')}|`);
    for (const k of keys) { const [route, profile] = k.split('|'); lines.push(`| \`${route}\` | ${profile} | ${engines.map((e) => { const v = visual.find((x) => x.engine === e && x.route === route && x.profile === profile); return !v ? '-' : v.error ? v.error : `${String(v.similarity).replace('.', ',')} % (${String(v.bigPct).replace('.', ',')} %)${v.similarity < VISUAL_WARN_SIM || v.bigPct > VISUAL_WARN_BIG ? ' ⚠' : ''}`; }).join(' | ')} |`); }
  }
  lines.push('', '_Cosa NON copre: il telefono vero (barra di Safari che si nasconde, tocco, pixel fitti, caratteri del telefono) e le versioni vecchie dei browser. Qui i tre motori sono recenti e girano su Linux._');
  return lines.join('\n');
}

/* ------------------------------ principale ------------------------------ */
(async () => {
  const started = Date.now();
  if (!LIVE_URL && !fs.existsSync(path.join(SITE, 'index.html'))) { console.error(`Non trovo il sito in ${SITE}`); process.exit(2); }
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'schermate'), { recursive: true });
  const server = LIVE_URL ? null : await startServer(SITE);
  const origin = LIVE_URL ? new URL(LIVE_URL).origin : `http://127.0.0.1:${server.address().port}`;
  const base = LIVE_URL || origin; // con --url l'indirizzo comprende anche la cartella (es. /Website)
  let routes;
  try {
    const src = await (await fetch(`${base}/js/content.js`)).text();
    const { PROJECTS } = new Function(`${src}\n;return { PROJECTS };`)();
    routes = ['', '#/', ...PROJECTS.map((p) => `#/project/${p.slug}`), '#/archive', '#/about', '#/contacts', '#/zzz']; // '' = l'indirizzo del sito senza nient'altro, come lo scrive un visitatore
  } catch (e) { console.error('Non riesco a leggere l\'elenco dei progetti da content.js:', e.message); process.exit(2); }
  if (QUICK) routes = routes.filter((r) => ['#/', '#/project/boudaries', '#/project/mediality', '#/project/stills', '#/archive', '#/contacts', '#/zzz'].includes(r));
  console.log(`Sito: ${LIVE_URL ? 'VERO ' + LIVE_URL : SITE + ' (' + origin + ')'} — ${routes.length} pagine × ${Object.keys(PROFILES).length} formati × ${ENGINES.length} motori (${ENGINES.join(', ')})`);
  const all = await Promise.all(ENGINES.map((engine) => runEngine(engine, base, origin, routes).catch((e) => ({ engine, version: '?', results: [{ engine, profile: '-', route: '-', problems: [`il motore non è partito: ${String(e.message).split('\n')[0]}`], metrics: null, shot: null }] }))));
  if (server) server.close();
  const diffs = engineDifferences(all);
  let sheets = [];
  try { sheets = await contactSheets(all); } catch (e) { console.error('Confronti affiancati non creati:', e.message); }
  let visual = [];
  try { visual = await visualSimilarity(all); } catch (e) { console.error('Somiglianza visiva non calcolata:', e.message); }
  const md = summary(all, diffs, started, visual);
  fs.writeFileSync(path.join(OUT, 'riassunto.md'), md);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ engines: all.map((e) => ({ engine: e.engine, version: e.version })), differences: diffs, topDifferences: diffs.top, wrapDifferences: diffs.wraps, visual, results: all.flatMap((e) => e.results.map((r) => ({ engine: r.engine, profile: r.profile, route: r.route, problems: r.problems, metrics: r.metrics }))) }, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  console.log('\n' + md);
  const failed = all.some((e) => e.results.some((r) => r.problems.length));
  console.log(`\nConfronti affiancati: ${sheets.length}. Esito: ${failed ? 'CI SONO PROBLEMI' : 'tutto in regola'}.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
