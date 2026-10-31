'use strict';
/* ==========================================================================
   PROVA DEI SALVATAGGI (modalità modifica, ridimensionamenti da telefono)
   Apre il sito come lo apre chi lo modifica — l'editor su localhost con il server vero (server.js) — ma su una COPIA della cartella
   in una cartella temporanea: il vero js/site-state.js non si tocca mai. Con l'anteprima mobile (la finestra da telefono dentro
   l'editor) o con uno schermo stretto ridimensiona una foto trascinando la maniglia e controlla che la misura:
     - arrivi su disco (js/site-state.js, chiave "site-size-overrides-v1:m") e resti dopo aver ricaricato la pagina;
   nei casi in cui prima si perdeva in silenzio (la foto restava com'era stata trascinata ma, ricaricando, tornava com'era):
     - chiusura dell'anteprima o ricarica subito dopo il rilascio;
     - il file su disco riportato a una versione vecchia (come «Annulla modifiche» in GitHub Desktop);
     - rilascio del mouse FUORI dall'anteprima;
     - gesto annullato dal browser a metà (touchcancel → pointercancel): prima non si salvava niente;
     - memoria del browser piena (setItem che fallisce): prima non si salvava niente e nessuno lo diceva;
     - indirizzo di rete con «?edit» (il telefono vero): da lì NON si può scrivere su disco, e il sito deve dirlo (avviso a schermo).
   Solo Chromium (servono il tocco e la memoria piena simulati). Esce con 1 se una prova non riesce.
   Uso:  node saves.js [--src=<cartella del sito, di serie quella del repository>] [--out=report]
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const pw = (() => {
  try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); }
})();

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return [m[1], m[2] === '' ? true : m[2]]; }));
const SRC = path.resolve(String(args.src || path.join(__dirname, '..', '..')));
const OUT = path.resolve(String(args.out || 'report'));
const ROUTE = '#/project/boudaries';
const KEY = 'project.boudaries.image.0';
const KEY_NEXT = 'project.boudaries.image.1';
const LAN_HOST = '192.168.1.50'; // indirizzo di rete finto: il browser lo manda al server di prova (come farebbe l'iPhone con quello del Mac)
const TOL = 0.6; // px: la misura salvata ha tre decimali, quella letta dallo schermo due

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(check, ms = 8000, step = 150) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) return value;
    await sleep(step);
  }
}
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const httpOk = (port) => new Promise((resolve) => { const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1500 }, (res) => { res.resume(); resolve(res.statusCode === 200); }); req.on('error', () => resolve(false)); req.on('timeout', () => { req.destroy(); resolve(false); }); });

/* ------------------------------ la copia del sito e il suo server ------------------------------ */
function makeCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salvataggi-'));
  for (const name of ['index.html', '404.html', 'favicon.ico', 'css', 'js', 'fonts', 'icons', 'testi', 'server.js', 'watch_images.js']) {
    const from = path.join(SRC, name);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(dir, name), { recursive: true });
  }
  fs.symlinkSync(path.join(SRC, 'images'), path.join(dir, 'images'), 'dir'); // le foto non si copiano
  return dir;
}
async function startServer(dir) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const up = await until(() => httpOk(port), 15000, 250);
  if (!up) { child.kill(); throw new Error(`il server di prova non parte: ${log.slice(-400)}`); }
  return { port, child, log: () => log };
}

/* ------------------------------ lo stato su disco ------------------------------ */
const stateFile = (dir) => path.join(dir, 'js', 'site-state.js');
function readDisk(dir) { const t = fs.readFileSync(stateFile(dir), 'utf8'); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); }
function widthOnDisk(dir, key = KEY, scope = ':m') { const e = (readDisk(dir).data['site-size-overrides-v1' + scope] || {})[key]; return e && e.width ? parseFloat(e.width) : null; }

/* ------------------------------ l'editor, l'anteprima mobile, le maniglie ------------------------------ */
async function openPreview(page, base) {
  await page.goto('about:blank');
  await page.goto(`${base}/?edit${ROUTE}`, { waitUntil: 'load', timeout: 45000 });
  await page.waitForSelector('.photo-track > figure.photo', { timeout: 25000 });
  await page.waitForSelector('.mobile-preview-toggle', { timeout: 25000 });
  await page.click('.mobile-preview-toggle');
  const frame = await until(() => page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(base)), 15000, 250);
  if (!frame) throw new Error('l\'anteprima mobile non si apre');
  await frame.waitForSelector('.photo-track > figure.photo', { timeout: 25000 });
  await frame.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
  return frame;
}
async function enterEdit(frame) {
  await frame.waitForSelector('.edit-toggle', { timeout: 10000 });
  if (!(await frame.evaluate(() => document.body.classList.contains('edit-mode')))) await frame.click('.edit-toggle');
  await frame.waitForFunction(() => document.body.classList.contains('edit-mode'), null, { timeout: 5000 });
  await sleep(500);
}
const photoWidth = (where, n = 0) => where.evaluate((i) => document.querySelectorAll('.photo-track > figure.photo:not(.photo-clone)')[i].querySelector('.photo-frame').getBoundingClientRect().width, n);
const handleCenter = (where, n = 0) => where.evaluate((i) => {
  const fr = document.querySelectorAll('.photo-track > figure.photo:not(.photo-clone)')[i].querySelector('.photo-frame');
  const r = fr.querySelector(':scope > .resize-handle.resize-handle-top').getBoundingClientRect(); // in alto a destra: l'unica che nelle gallerie non viene tagliata
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: fr.getBoundingClientRect().width };
}, n);
// trascina la maniglia della foto "n" di "dx" px con il mouse, dentro l'anteprima; "releaseOutside": rilascia fuori dal telefono
async function dragWithMouse(page, frame, dx, { n = 0, releaseOutside = false } = {}) {
  const info = await handleCenter(frame, n);
  const off = await page.evaluate(() => { const r = document.querySelector('.mobile-preview-device iframe').getBoundingClientRect(); return { left: r.left, top: r.top }; });
  const px = off.left + info.x, py = off.top + info.y;
  await page.mouse.move(px, py);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(px + (dx * i) / 8, py);
  if (releaseOutside) await page.mouse.move(off.left - 120, py, { steps: 6 });
  await page.mouse.up();
  return { before: info.width, after: await photoWidth(frame, n) };
}
// stesso trascinamento con il dito su una pagina da telefono vera (formato telefono, senza anteprima); "end": come finisce il gesto
async function dragWithTouch(ctx, page, dx, end) {
  const info = await handleCenter(page, 0);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x, y }] });
  await touch('touchStart', info.x, info.y);
  for (let i = 1; i <= 8; i++) await touch('touchMove', info.x + (dx * i) / 8, info.y);
  await touch(end);
  return { before: info.width, after: await photoWidth(page, 0) };
}
const phoneContext = (browser, extra = {}) => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...extra });

/* ------------------------------ le prove ------------------------------ */
// ogni prova restituisce { ok, text }
const TESTS = [
  ['dopo il salvataggio e la ricarica la misura resta', async ({ browser, base, dir }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await ctx.newPage();
    const f = await openPreview(page, base); await enterEdit(f);
    const r = await dragWithMouse(page, f, -45);
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    const f2 = await openPreview(page, base); const w2 = await photoWidth(f2);
    await ctx.close();
    return { ok: d !== null && Math.abs(w2 - r.after) < TOL, text: `trascinata a ${r.after.toFixed(1)} px, su disco ${d}, dopo la ricarica ${w2.toFixed(1)} px` };
  }],
  ['chiudendo l\'anteprima subito dopo il rilascio', async ({ browser, base, dir }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await ctx.newPage();
    const f = await openPreview(page, base); await enterEdit(f);
    const r = await dragWithMouse(page, f, -50);
    await page.click('.mobile-preview-close'); // prima dei 0,6 s in cui il salvataggio parte da solo
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    await ctx.close();
    return { ok: d !== null, text: `trascinata a ${r.after.toFixed(1)} px, su disco ${d}` };
  }],
  ['ricaricando la pagina subito dopo il rilascio', async ({ browser, base, dir }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await ctx.newPage();
    const f = await openPreview(page, base); await enterEdit(f);
    const r = await dragWithMouse(page, f, -55);
    await page.reload({ waitUntil: 'load' });
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    const f2 = await openPreview(page, base); const w2 = await photoWidth(f2);
    await ctx.close();
    return { ok: d !== null && Math.abs(w2 - r.after) < TOL, text: `trascinata a ${r.after.toFixed(1)} px, su disco ${d}, dopo la ricarica ${w2.toFixed(1)} px` };
  }],
  ['il file su disco riportato a una versione vecchia', async ({ browser, base, dir, baseline }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await ctx.newPage();
    const f = await openPreview(page, base); await enterEdit(f);
    const r = await dragWithMouse(page, f, -60);
    await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL; });
    fs.writeFileSync(stateFile(dir), baseline); // come «Annulla modifiche» in GitHub Desktop
    const f2 = await openPreview(page, base); const w2 = await photoWidth(f2);
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    await ctx.close();
    return { ok: d !== null && Math.abs(w2 - r.after) < TOL, text: `trascinata a ${r.after.toFixed(1)} px, file riportato indietro, alla riapertura la foto è ${w2.toFixed(1)} px e su disco torna ${d}` };
  }],
  ['mouse rilasciato fuori dall\'anteprima', async ({ browser, base, dir }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); const page = await ctx.newPage();
    const f = await openPreview(page, base); await enterEdit(f);
    const r = await dragWithMouse(page, f, -30, { releaseOutside: true });
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    await ctx.close();
    return { ok: d !== null, text: `a schermo ${r.before.toFixed(1)} → ${r.after.toFixed(1)} px, su disco ${d}` };
  }],
  ['gesto annullato dal browser a metà (touchcancel)', async ({ browser, base, dir }) => {
    const ctx = await phoneContext(browser); const page = await ctx.newPage();
    await page.goto(`${base}/?edit${ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { timeout: 25000 }); await sleep(1500);
    await page.waitForSelector('.edit-toggle'); await page.tap('.edit-toggle'); await sleep(600);
    const r = await dragWithTouch(ctx, page, -45, 'touchCancel');
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.photo-track > figure.photo'); await sleep(1500);
    const w2 = await photoWidth(page, 0);
    await ctx.close();
    return { ok: d !== null && Math.abs(w2 - r.after) < TOL, text: `a schermo ${r.before.toFixed(1)} → ${r.after.toFixed(1)} px, su disco ${d}, dopo la ricarica ${w2.toFixed(1)} px` };
  }],
  ['memoria del browser piena', async ({ browser, base, dir }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (window.__memoriaPiena && String(key).startsWith('site-size-overrides-v1')) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
        return original.call(this, key, value);
      };
    });
    const page = await ctx.newPage();
    const f = await openPreview(page, base); await enterEdit(f);
    await f.evaluate(() => { window.__memoriaPiena = true; });
    const r = await dragWithMouse(page, f, -50);
    const d = await until(async () => { const w = widthOnDisk(dir); return w !== null && Math.abs(w - r.after) < TOL ? w : null; });
    const warned = await until(() => f.evaluate(() => /piena/i.test(document.body.innerText || '')), 3000);
    await ctx.close();
    return { ok: d !== null && !!warned, text: `trascinata a ${r.after.toFixed(1)} px, su disco ${d}, avviso «memoria piena» ${warned ? 'mostrato' : 'NON mostrato'}` };
  }],
  ['indirizzo di rete con ?edit (il telefono vero): non si salva, e il sito lo dice', async ({ browser, port, dir }) => {
    const ctx = await phoneContext(browser); const page = await ctx.newPage();
    await page.goto(`http://${LAN_HOST}:${port}/?edit${ROUTE}`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForSelector('.photo-track > figure.photo', { timeout: 25000 }); await sleep(1500);
    await page.waitForSelector('.edit-toggle'); await page.tap('.edit-toggle'); await sleep(600);
    const before = widthOnDisk(dir);
    const r = await dragWithTouch(ctx, page, -45, 'touchEnd');
    await sleep(2000);
    const after = widthOnDisk(dir);
    const said = await page.evaluate(() => ({
      alarm: (document.getElementById('save-error-alarm') || {}).textContent || '',
      badge: (document.getElementById('not-saved-badge') || {}).textContent || '',
    }));
    await ctx.close();
    const warned = /NON vanno su disco/.test(said.alarm) && /NON salvato su disco/.test(said.badge);
    return { ok: before === after && warned, text: `foto ${r.before.toFixed(1)} → ${r.after.toFixed(1)} px, su disco prima ${before} dopo ${after} (deve restare uguale); avvisi: allarme ${said.alarm ? 'sì' : 'NO'}, riquadro rosso ${said.badge ? 'sì' : 'NO'}` };
  }],
];

/* ------------------------------ principale ------------------------------ */
(async () => {
  const started = Date.now();
  fs.mkdirSync(OUT, { recursive: true });
  const dir = makeCopy();
  const baseline = fs.readFileSync(stateFile(dir), 'utf8');
  let server = null; let browser = null; const lines = []; const problems = [];
  try {
    server = await startServer(dir);
    const base = `http://localhost:${server.port}`;
    browser = await pw.chromium.launch({ args: [`--host-resolver-rules=MAP ${LAN_HOST} 127.0.0.1`] });
    console.log(`Prova dei salvataggi: copia del sito in ${dir}, server su ${base} (sorgente: ${SRC})`);
    for (const [name, fn] of TESTS) {
      fs.writeFileSync(stateFile(dir), baseline); // ogni prova parte dallo stato del repository
      await sleep(400);
      let res;
      try { res = await fn({ browser, base, port: server.port, dir, baseline }); } catch (e) { res = { ok: false, text: `non riuscita: ${String(e.message).split('\n')[0]}` }; }
      const line = `${res.ok ? 'OK' : 'NO'} · ${name}: ${res.text}`;
      lines.push(line);
      console.log(`  [salvataggi] ${line}`);
      if (!res.ok) problems.push(`${name}: ${res.text}`);
    }
  } catch (e) {
    problems.push(`prova dei salvataggi non eseguita: ${e.message}`);
    console.log(`  [salvataggi] ERRORE: ${e.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) server.child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const md = ['# Prova dei salvataggi (ridimensionamenti da telefono)', '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · durata ${Math.round((Date.now() - started) / 1000)} s`, '',
    problems.length ? `## ❌ ${problems.length} prove non riuscite` : '## ✅ Tutte le prove riuscite', '', ...lines.map((l) => `- ${l}`), ''].join('\n');
  fs.writeFileSync(path.join(OUT, 'salvataggi.md'), md);
  console.log(md);
  process.exit(problems.length ? 1 : 0);
})();
