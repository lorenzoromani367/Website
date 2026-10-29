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
       - galleria di un progetto: quando scorre (freccia destra) la pagina si porta in fondo, dove stanno il numero e le frecce
         (o, se la finestra è troppo bassa per la foto e la barra insieme, dove la cima della foto sta a 24 px dal bordo alto),
         su computer; su telefono resta ferma (inquadratura in fondo, js/app_v58.js).
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
// Quando la galleria scorre (qui con la freccia destra) la pagina, su computer, si porta in fondo, dove stanno il numero e le frecce, ma
// non oltre il punto in cui la cima della foto sta a 24 px dal bordo alto della finestra (se la finestra è troppo bassa per la foto e la
// barra insieme la cima della foto non si taglia): startBottomFraming in js/app_v58.js. Su telefono la pagina resta ferma. Si usa una
// pagina nuova: dopo un movimento della pagina fatto dall'utente (anche solo uno "scroll" mandato dal test) l'inquadratura aspetta 15 s
// per non portare via la pagina a chi la sta leggendo.
const FRAMING_ROUTE = '#/project/boudaries';
async function checkFraming(context, base) {
  const problems = [];
  const page = await context.newPage();
  try {
    await page.goto(`${base}/${LIVE_URL ? '' : '?visitor'}${FRAMING_ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    const read = () => page.evaluate(() => {
      const frame = document.querySelector('.photo-track > figure.photo .photo-frame');
      return { y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight, top: frame ? frame.getBoundingClientRect().top : null, photos: document.querySelectorAll('.photo-track > figure.photo:not(.photo-clone)').length };
    });
    // "inquadrata": in fondo, oppure ferma dove la cima della foto sta a 24 px dal bordo alto (24 ± 4 px)
    const framed = (st) => st.max - st.y <= 3 || (st.top !== null && Math.abs(st.top - 24) <= 4);
    const describe = (st) => `è a ${Math.round(st.y)} px su ${Math.round(st.max)}, la cima della foto a ${Math.round(st.top)} px dal bordo alto della finestra`;
    const before = await read();
    if (before.photos < 2 || before.max <= 8) return problems; // una foto sola, o la pagina sta tutta nella finestra: niente da inquadrare
    await page.keyboard.press('ArrowRight');
    if (context.__profile === 'telefono') {
      await page.waitForTimeout(2500);
      const after = await read();
      if (Math.abs(after.y - before.y) > 3) problems.push(`su telefono la galleria che scorre ha mosso la pagina (da ${Math.round(before.y)} a ${Math.round(after.y)} px): l'inquadratura in fondo è solo per il computer`);
    } else {
      let now = before;
      for (let i = 0; i < 40 && !framed(now); i++) { await page.waitForTimeout(150); now = await read(); }
      if (!framed(now)) problems.push(`la galleria scorre ma la pagina non si inquadra (${describe(now)}): l'inquadratura in fondo non parte`);
      else {
        // la pagina cambia altezza per un altro secondo circa (la foto in arrivo è più alta o più bassa): deve restare inquadrata fino alla fine
        await page.waitForTimeout(2500);
        now = await read();
        if (!framed(now)) problems.push(`la pagina si inquadra ma poi non ci resta mentre la foto cambia altezza (alla fine ${describe(now)})`);
      }
    }
  } catch (e) {
    problems.push(`prova dell'inquadratura in fondo non riuscita: ${String(e.message).split('\n')[0]}`);
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
    if (variant.css) await context.addInitScript((css) => { const add = () => { const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st); }; add(); }, variant.css);
    for (const route of routes) {
      const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || (route === '' ? 'indirizzo_semplice' : 'home');
      const withShot = profile.shots && SHOT_ROUTES.includes(route);
      const shotPath = path.join(OUT, 'schermate', `${slug}__${profileName.replace(/\s+/g, '-')}__${engine}.jpg`);
      const r = await checkPage(context, base, origin, route, withShot, shotPath);
      if (route === FRAMING_ROUTE) r.problems.push(...await checkFraming(context, base));
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
  } else lines.push('## ✅ Nessun problema', '', 'Nessun errore JavaScript, nessun file mancante, nessuna pagina più larga dello schermo, tasto home sempre toccabile, Core Archive in regola, galleria che porta la pagina in fondo (solo su computer).');
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
  if (QUICK) routes = routes.filter((r) => ['#/', '#/project/boudaries', '#/project/stills', '#/archive', '#/contacts', '#/zzz'].includes(r));
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
