'use strict';
/* ==========================================================================
   GIRO DELLE MISURE
   Apre TUTTE le pagine del sito (home, ogni progetto, core archive, about, contacts) a 13 misure di schermo — telefoni piccoli e
   grandi (320 × 568 è un iPhone SE, 430 × 932 un iPhone Pro Max), telefoni orizzontali, tablet (768 × 1024 e 1180 × 820 sono iPad),
   computer da 1280 a 2560 px — su Chromium, Firefox e WebKit (il motore di Safari), e controlla per ogni pagina:
     - nessun errore o avviso JavaScript in console, nessun file mancante o rifiutato (404, ecc.);
     - la pagina si disegna (c'è del testo) e non diventa mai più larga dello schermo (niente scorrimento laterale);
     - nessuna foto rotta, nessun testo che esce dai bordi dello schermo;
     - mai la pagina "not found" né l'avviso di indirizzo vecchio.
   È il fratello di check.js (che confronta i tre motori a fondo su 2 misure) e di taps.js (tocchi su telefono): qui si cambia la MISURA.
   Uso:  node sizes.js --site=../../_site [--url=https://...] [--engines=webkit,chromium,firefox] [--out=report] [--quick]
         --url   prova il sito VERO pubblicato invece della cartella preparata (come lo vede un visitatore, senza "?visitor")
         --quick solo 5 misure (telefono piccolo, telefono, iPad, computer, schermo grande)
   Esce con errore (codice 1) se qualcosa non va.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const http = require('http');

const pw = (() => {
  try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); }
})();

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return [m[1], m[2] === '' ? true : m[2]]; }));
const SITE = path.resolve(String(args.site || '../../_site'));
const LIVE_URL = args.url && args.url !== true ? String(args.url).replace(/\/+$/, '') : null;
const OUT = path.resolve(String(args.out || 'report'));
const ENGINES = [...new Set(String(args.engines || 'chromium,firefox,webkit').split(',').filter(Boolean).map((e) => e.replace(/-linux$/, '')))];
const QUICK = !!args.quick;
const LABEL = { chromium: 'Chromium (Chrome, Edge, Vivaldi)', firefox: 'Firefox', webkit: 'WebKit (Safari)' };

const VIEWPORTS = QUICK
  ? [[320, 568], [390, 844], [768, 1024], [1440, 900], [2560, 1440]]
  : [[320, 568], [360, 640], [390, 844], [430, 932], [667, 375], [844, 390], [768, 1024], [1024, 1366], [1180, 820], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]];
const isPhone = (w, h) => Math.min(w, h) < 700;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
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

// misure dentro la pagina: larghezza, foto rotte, testi fuori dallo schermo (si misura il TESTO, non la scatola: una scatola vuota più larga
// dello schermo non si vede e non fa scorrere nulla; le foto scorrevoli e il testo che scorre da solo escono dai bordi per costruzione)
function measureInPage() {
  const iw = window.innerWidth;
  const scrollers = '.photo-viewport, .photo-track, [class*="marquee"], .description-marquee, .description-track, .zoom-layer, .lightbox';
  const outside = [];
  document.querySelectorAll('#app *').forEach((e) => {
    if (e.closest(scrollers)) return;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const replaced = e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'IMG';
    if (!own && !replaced) return;
    let b;
    if (own && !replaced) { const r = document.createRange(); r.selectNodeContents(e); b = r.getBoundingClientRect(); } else b = e.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) return;
    if (b.right > iw + 1 || b.left < -1) outside.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} "${(e.value || e.textContent || e.alt || '').trim().slice(0, 24)}" l=${Math.round(b.left)} r=${Math.round(b.right)}`);
  });
  const text = document.body.innerText || '';
  return {
    innerW: iw,
    docW: document.documentElement.scrollWidth,
    textLen: text.trim().length,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.currentSrc.startsWith('data:')).map((i) => decodeURIComponent(i.currentSrc.split('/').slice(-2).join('/'))).slice(0, 4),
    outside: outside.slice(0, 5),
    nOutside: outside.length,
    notFound: /Questa pagina non esiste|This page no longer exists|^\s*not found\s*$/im.test(text),
  };
}

async function runEngine(engine, base, suffix) {
  const result = { engine, label: LABEL[engine] || engine, pages: 0, problems: [] };
  const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--font-render-hinting=none'] } : {});
  try {
    for (const [w, h] of VIEWPORTS) {
      const phone = isPhone(w, h);
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: phone ? 3 : 1, hasTouch: phone, isMobile: phone && engine !== 'firefox' });
      const page = await context.newPage();
      let errors = [];
      let failed = [];
      page.on('pageerror', (e) => errors.push(`JS: ${e.message}`));
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/favicon/i.test(m.text())) errors.push(`console.${m.type()}: ${m.text().slice(0, 140)}`); });
      page.on('response', (r) => { if (r.status() >= 400 && !/favicon/i.test(r.url())) failed.push(`${r.status()} ${r.url().replace(base, '')}`); });
      page.on('requestfailed', (r) => { if (!/favicon/i.test(r.url())) failed.push(`fallita ${r.url().replace(base, '')} (${(r.failure() || {}).errorText})`); });
      await page.goto(`${base}/${suffix}#/`, { waitUntil: 'load' });
      await page.waitForSelector('#app > *', { state: 'attached', timeout: 20000 });
      await page.waitForTimeout(1200);
      const slugs = await page.evaluate(() => PROJECTS.map((p) => p.slug));
      const routes = ['#/', ...slugs.map((s) => `#/project/${s}`), '#/archive', '#/about', '#/contacts'];
      let badHere = 0;
      for (const route of routes) {
        errors = []; failed = [];
        await page.evaluate((r) => { location.hash = r; }, route);
        await page.waitForTimeout(900);
        // si scorre fino in fondo: così si caricano anche le foto "pigre"
        await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
        await page.waitForTimeout(400);
        const m = await page.evaluate(measureInPage);
        const bad = [];
        if (m.docW > m.innerW + 1) bad.push(`la pagina è più larga dello schermo (${m.docW} > ${m.innerW})`);
        if (m.textLen < 8) bad.push('pagina vuota');
        if (m.broken.length) bad.push(`foto rotte: ${m.broken.join(', ')}`);
        if (m.nOutside) bad.push(`${m.nOutside} testi/foto fuori dallo schermo: ${m.outside.join(' | ')}`);
        if (m.notFound) bad.push('pagina "not found" o avviso di indirizzo vecchio');
        if (errors.length) bad.push(`errori: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
        if (failed.length) bad.push(`richieste fallite: ${[...new Set(failed)].slice(0, 3).join(' | ')}`);
        result.pages++;
        if (bad.length) { badHere++; result.problems.push(`${w}×${h} ${route}: ${bad.join(' ;; ')}`); }
      }
      await context.close();
      console.log(`  ${result.label} ${w}×${h}: ${routes.length} pagine, con problemi: ${badHere}`);
    }
  } catch (error) {
    result.problems.push(`il giro si è interrotto: ${String(error.message || error).split('\n')[0]}`);
  } finally {
    await browser.close();
  }
  return result;
}

(async () => {
  let server = null;
  let base;
  let suffix = '';
  if (LIVE_URL) { base = LIVE_URL; } else {
    server = await startServer(SITE);
    base = `http://127.0.0.1:${server.address().port}`;
    suffix = '?visitor';
  }
  console.log(`Giro delle misure su ${LIVE_URL || SITE} — ${VIEWPORTS.length} misure, motori: ${ENGINES.join(', ')}`);
  const results = [];
  for (const engine of ENGINES) {
    if (!pw[engine]) { console.error(`Motore sconosciuto: ${engine}`); process.exit(2); }
    const r = await runEngine(engine, base, suffix);
    results.push(r);
    console.log(`${r.label}: ${r.pages} pagine controllate, problemi: ${r.problems.length}`);
    r.problems.slice(0, 20).forEach((p) => console.log(`    ✗ ${p}`));
  }
  if (server) server.close();

  const lines = ['# Giro delle misure', '', `Sito: ${LIVE_URL || 'quello preparato qui (cartella _site)'}`, `Misure: ${VIEWPORTS.map(([w, h]) => `${w}×${h}`).join(', ')}`, '', '| Motore | Pagine controllate | Problemi |', '|---|---|---|'];
  results.forEach((r) => lines.push(`| ${r.label} | ${r.pages} | ${r.problems.length ? '❌ ' + r.problems.length : '✅ nessuno'} |`));
  const withProblems = results.filter((r) => r.problems.length);
  lines.push('');
  if (withProblems.length) {
    lines.push('## Problemi', '');
    withProblems.forEach((r) => { lines.push(`**${r.label}**`, ''); r.problems.forEach((p) => lines.push(`- ${p}`)); lines.push(''); });
  } else {
    lines.push('## ✅ Nessun problema', '', 'Ogni pagina si disegna, non è mai più larga dello schermo, non ha foto rotte né errori in console, a tutte le misure provate.', '');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'misure.md'), lines.join('\n'));
  fs.writeFileSync(path.join(OUT, 'misure.json'), JSON.stringify(results, null, 2));
  console.log('\n' + lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + lines.join('\n') + '\n');
  process.exit(withProblems.length ? 1 : 0);
})();
