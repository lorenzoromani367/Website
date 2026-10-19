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
         che in alto c'è tra il "0" e il titolo.
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
const OUT = path.resolve(String(args.out || 'report'));
const ENGINES = String(args.engines || 'chromium,firefox,webkit').split(',').filter(Boolean);
const QUICK = !!args.quick;
const SETTLE_MS = Number(args.settle || 1800);
const LABEL = { chromium: 'Chromium (Chrome, Edge, Vivaldi)', firefox: 'Firefox', webkit: 'WebKit (Safari)' };
const PROFILES = {
  computer: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: false, isMobile: false },
  telefono: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
// Pagine di cui si salvano le schermate (e il confronto affiancato): le altre si controllano e basta.
const SHOT_ROUTES = ['#/', '#/project/boudaries', '#/project/stills', '#/project/sospension', '#/archive', '#/about', '#/contacts'];
// Sotto queste differenze tra i motori non si avvisa (i caratteri e gli arrotondamenti cambiano di qualche decimo di pixel).
const WARN_PX = 4;
const WARN_DOC_HEIGHT_PX = 10;
const VISUAL_WARN_SIM = 96; // sotto questa somiglianza (%) con Chromium si avvisa
const VISUAL_WARN_BIG = 3; // oltre questa quota (%) di punti molto diversi si avvisa

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
      try { await page.goto(`${base}/?visitor${route}`, { waitUntil: 'load', timeout: 45000 }); await page.waitForSelector('#app > *', { state: 'attached', timeout: 20000 }); break; }
      catch (e) { if (attempt >= 2) throw e; await page.waitForTimeout(1500); }
    }
    await page.evaluate(() => (document.fonts && document.fonts.ready) || null);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    metrics = await page.evaluate(measureInPage);
    if (withShot) { await page.addStyleTag({ content: '.description-track{transform:none !important;animation:none !important} *{caret-color:transparent !important}' }); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: shotPath, fullPage: true, type: 'jpeg', quality: 62 }); }
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

/* ------------------------------ un motore intero ------------------------------ */
async function runEngine(engine, base, origin, routes) {
  const browser = await pw[engine].launch();
  const version = browser.version();
  const results = [];
  for (const [profileName, profile] of Object.entries(PROFILES)) {
    const opts = { viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor, hasTouch: profile.hasTouch };
    if (profile.isMobile && engine !== 'firefox') opts.isMobile = true; // Firefox non conosce "isMobile": il formato telefono si decide dalla larghezza (come fa il sito)
    const context = await browser.newContext(opts);
    context.__profile = profileName;
    for (const route of routes) {
      const slug = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
      const withShot = SHOT_ROUTES.includes(route);
      const shotPath = path.join(OUT, 'schermate', `${slug}__${profileName}__${engine}.jpg`);
      const r = await checkPage(context, base, origin, route, withShot, shotPath);
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
    const file = path.join(OUT, 'confronti', `${route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}__${profile}.jpg`);
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
  lines.push(QUICK ? `Prova rapida: ${total / 2} pagine, in formato computer e telefono.` : `Pagine controllate: ${total / 2} (tutte quelle del sito), ciascuna in formato computer e telefono, su ogni motore.`, '');
  lines.push('| Motore | Versione | Pagine con problemi |', '|---|---|---|');
  for (const e of all) { const bad = e.results.filter((r) => r.problems.length).length; lines.push(`| ${LABEL[e.engine]} | ${e.version} | ${bad === 0 ? '✅ nessuna' : '❌ ' + bad} |`); }
  const problems = all.flatMap((e) => e.results.filter((r) => r.problems.length).map((r) => ({ e: e.engine, r })));
  lines.push('');
  if (problems.length) {
    lines.push('## ❌ Problemi', '');
    for (const { e, r } of problems) for (const p of r.problems) lines.push(`- **${LABEL[e]}**, ${r.profile}, \`${r.route}\`: ${p}`);
  } else lines.push('## ✅ Nessun problema', '', 'Nessun errore JavaScript, nessun file mancante, nessuna pagina più larga dello schermo, tasto home sempre toccabile, Core Archive in regola.');
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
  if (!fs.existsSync(path.join(SITE, 'index.html'))) { console.error(`Non trovo il sito in ${SITE}`); process.exit(2); }
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(path.join(OUT, 'schermate'), { recursive: true });
  const server = await startServer(SITE); const origin = `http://127.0.0.1:${server.address().port}`;
  let routes;
  try {
    const src = await (await fetch(`${origin}/js/content.js`)).text();
    const { PROJECTS } = new Function(`${src}\n;return { PROJECTS };`)();
    routes = ['#/', ...PROJECTS.map((p) => `#/project/${p.slug}`), '#/archive', '#/about', '#/contacts', '#/zzz'];
  } catch (e) { console.error('Non riesco a leggere l\'elenco dei progetti da content.js:', e.message); process.exit(2); }
  if (QUICK) routes = routes.filter((r) => ['#/', '#/project/boudaries', '#/project/stills', '#/archive', '#/contacts', '#/zzz'].includes(r));
  console.log(`Sito: ${SITE} (${origin}) — ${routes.length} pagine × ${Object.keys(PROFILES).length} formati × ${ENGINES.length} motori (${ENGINES.join(', ')})`);
  const all = await Promise.all(ENGINES.map((engine) => runEngine(engine, origin, origin, routes).catch((e) => ({ engine, version: '?', results: [{ engine, profile: '-', route: '-', problems: [`il motore non è partito: ${String(e.message).split('\n')[0]}`], metrics: null, shot: null }] }))));
  server.close();
  const diffs = engineDifferences(all);
  let sheets = [];
  try { sheets = await contactSheets(all); } catch (e) { console.error('Confronti affiancati non creati:', e.message); }
  let visual = [];
  try { visual = await visualSimilarity(all); } catch (e) { console.error('Somiglianza visiva non calcolata:', e.message); }
  const md = summary(all, diffs, started, visual);
  fs.writeFileSync(path.join(OUT, 'riassunto.md'), md);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ engines: all.map((e) => ({ engine: e.engine, version: e.version })), differences: diffs, topDifferences: diffs.top, visual, results: all.flatMap((e) => e.results.map((r) => ({ engine: r.engine, profile: r.profile, route: r.route, problems: r.problems, metrics: r.metrics }))) }, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
  console.log('\n' + md);
  const failed = all.some((e) => e.results.some((r) => r.problems.length));
  console.log(`\nConfronti affiancati: ${sheets.length}. Esito: ${failed ? 'CI SONO PROBLEMI' : 'tutto in regola'}.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
