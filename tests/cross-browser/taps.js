'use strict';
/* ==========================================================================
   GIRO DEI TOCCHI
   Apre il sito con un "telefono" (390 × 844, tocco, schermo fitto come un iPhone) su Chromium, Firefox e WebKit (il motore di
   Safari) e TOCCA ogni collegamento come farebbe un dito: ogni voce della home, i tre link in fondo (core archive, contacts,
   about), le frecce avanti/indietro di ogni progetto (anche oltre l'ultimo, che ricomincia dal primo) e il tasto home.
   Dopo ogni tocco controlla che si sia aperta una pagina vera — mai "not found" ("Questa pagina non esiste.") né l'avviso
   di indirizzo vecchio ("This page no longer exists", che è il comportamento giusto SOLO per un indirizzo vecchio) — e che non
   ci siano errori JavaScript.
   Serve a capire se, toccando in giro, un telefono può finire su una pagina inesistente: il controllo normale (check.js) apre
   ogni pagina dall'indirizzo, qui invece si arriva alle pagine come ci arriva un visitatore. Controlla anche che le icone
   (scheda del browser, anteprima per i social) si scarichino davvero dal sito pubblicato.
   Uso:  node taps.js --url=https://lorenzoromani367.github.io/Website [--engines=webkit,chromium,firefox] [--out=report]
   Esce con errore (codice 1) se una pagina risulta inesistente, vuota o con errori JavaScript.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const pw = (() => {
  try { return require('playwright'); } catch (e) { return require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright'); }
})();

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)=?(.*)$/); return [m[1], m[2] === '' ? true : m[2]]; }));
if (!args.url || args.url === true) {
  console.error('Manca --url=<indirizzo del sito>');
  process.exit(2);
}
const BASE = String(args.url).replace(/\/+$/, '');
// ("chromium-linux" di check.js qui è lo stesso Chromium)
const ENGINES = [...new Set(String(args.engines || 'webkit,chromium,firefox').split(',').filter(Boolean).map((e) => e.replace(/-linux$/, '')))];
const OUT = path.resolve(String(args.out || 'report'));
const LABEL = { chromium: 'Chromium (Chrome, Edge, Vivaldi)', firefox: 'Firefox', webkit: 'WebKit (Safari)' };
const SETTLE_MS = 1200;

// Un iPhone: Firefox non sa fingersi "telefono" (isMobile), gli si danno comunque misura e tocco.
function phoneOptions(engine) {
  const options = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true };
  if (engine !== 'firefox') {
    options.isMobile = true;
    options.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  }
  return options;
}

async function snapshot(page) {
  return page.evaluate(() => ({
    hash: location.hash,
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 70),
    length: document.body.innerText.trim().length,
    notFound: /Questa pagina non esiste|This page no longer exists/.test(document.body.innerText),
    fatal: /errore in content\.js/.test(document.body.innerText),
  }));
}

async function openHome(page) {
  await page.goto(`${BASE}/#/`, { waitUntil: 'load' });
  await page.waitForSelector('#app > *', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(SETTLE_MS);
  // Se la pagina era già aperta su un altro "#", goto cambia solo il "#": si lascia il tempo di ridisegnare.
  await page.waitForSelector('.home-list .home-word-input', { state: 'attached', timeout: 15000 });
}

async function runEngine(engine) {
  const result = { engine, label: LABEL[engine] || engine, steps: [], problems: [], jsErrors: [] };
  const browser = await pw[engine].launch(engine === 'chromium' ? { args: ['--font-render-hinting=none'] } : {});
  try {
    const context = await browser.newContext(phoneOptions(engine));
    const page = await context.newPage();
    page.on('pageerror', (e) => result.jsErrors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) result.jsErrors.push(`console: ${m.text()}`); });

    const record = async (what, s) => {
      const bad = s.notFound || s.fatal || s.length < 8;
      result.steps.push({ what, hash: s.hash, ok: !bad });
      if (bad) result.problems.push(`${what} → ${s.hash || '(nessun #)'}: ${s.notFound ? '"Questa pagina non esiste."' : s.fatal ? 'errore di content.js' : 'pagina vuota'}`);
    };

    // 0. indirizzi vecchi, come quelli che Safari riapre dalla cronologia (un progetto tolto, una parola cancellata): partendo da
    //    zero con quell'indirizzo deve comparire la home con l'avviso, mai la pagina "not found". Ogni indirizzo in una scheda nuova.
    for (const old of ['#/project/lines', '#/project/boundaries', '#/word/word-che-non-esiste', '#/old-archive']) {
      const fresh = await context.newPage();
      fresh.on('pageerror', (e) => result.jsErrors.push(e.message));
      await fresh.goto(`${BASE}/${old}`, { waitUntil: 'load' });
      await fresh.waitForSelector('#app > *', { state: 'attached', timeout: 15000 });
      await fresh.waitForTimeout(SETTLE_MS);
      const r = await fresh.evaluate(() => ({
        hash: location.hash,
        rows: document.querySelectorAll('.home-list .home-word-input').length,
        notice: (document.querySelector('[role="status"]') || {}).textContent || '',
        notFoundPage: /not found/.test((document.querySelector('.topbar-title') || {}).textContent || ''),
      }));
      const ok = r.rows > 0 && /^#\/?$/.test(r.hash) && !r.notFoundPage && r.notice.includes('This page no longer exists');
      result.steps.push({ what: `indirizzo vecchio ${old}`, hash: r.hash, ok });
      if (!ok) result.problems.push(`indirizzo vecchio ${old} → ${r.hash || '(nessun #)'}: ${r.notFoundPage ? 'pagina "not found"' : r.rows ? "manca l'avviso" : 'la home non si vede'}`);
      await fresh.close();
    }

    // 0b. un indirizzo senza "#" che sul sito non esiste (una cartella digitata a mano, un vecchio collegamento): GitHub risponde con
    //     404.html, che riporta alla home. Si controlla che si finisca davvero sulla home del sito (non sulla pagina bianca di GitHub).
    {
      const fresh = await context.newPage();
      fresh.on('pageerror', (e) => result.jsErrors.push(e.message));
      await fresh.goto(`${BASE}/pagina-che-non-esiste/ancora`, { waitUntil: 'load' }).catch(() => {});
      await fresh.waitForSelector('.home-list .home-word-input', { state: 'attached', timeout: 15000 }).catch(() => {});
      await fresh.waitForTimeout(SETTLE_MS);
      const r = await fresh.evaluate(() => ({ path: location.pathname, rows: document.querySelectorAll('.home-list .home-word-input').length }));
      const homePath = new URL(`${BASE}/`).pathname;
      const ok = r.rows > 0 && r.path === homePath;
      result.steps.push({ what: 'indirizzo inesistente senza # (pagina 404)', hash: r.path, ok });
      if (!ok) result.problems.push(`indirizzo inesistente senza # → ${r.path}: ${r.rows ? 'non si torna alla home del sito' : 'la home non si vede (pagina 404 di GitHub?)'}`);
      await fresh.close();
    }

    // 0c. icone: l'icona della scheda (SVG, .ico, apple-touch-icon) e l'immagine dell'anteprima per i social devono esistere sul sito
    //     pubblicato. La pubblicazione copia solo certe cartelle e un file dimenticato darebbe 404 senza che nessuno se ne accorga
    //     (i browser automatici non richiedono l'icona da soli). L'immagine dell'anteprima punta al dominio vero: si controlla il
    //     file con lo stesso nome sul sito che si sta provando.
    {
      await openHome(page);
      const files = await page.evaluate(() => {
        const list = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].map((l) => ({ what: `icona: ${l.getAttribute('href')}`, url: l.href }));
        const og = document.querySelector('meta[property="og:image"]');
        if (og && og.content) {
          const file = new URL(og.content).pathname.replace(/^\/+/, '');
          list.push({ what: `anteprima social: ${file}`, url: new URL(file, document.baseURI).href });
        }
        return list;
      });
      if (!files.some((f) => f.what.startsWith('icona:'))) result.problems.push('nessuna icona della scheda dichiarata in index.html');
      for (const f of files) {
        const r = await page.evaluate(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            return { status: res.status, type: res.headers.get('content-type') || '', bytes: (await res.arrayBuffer()).byteLength };
          } catch (e) {
            return { status: 0, type: String(e.message || e), bytes: 0 };
          }
        }, f.url);
        const ok = r.status === 200 && /^image\//.test(r.type) && r.bytes > 100;
        result.steps.push({ what: f.what, hash: ok ? r.type : `${r.status} ${r.type}`, ok });
        if (!ok) result.problems.push(`${f.what} → ${r.status || 'non raggiungibile'} ${r.type} (${r.bytes} byte)`);
      }
    }

    // 1. ogni voce della home (progetti e parole)
    await openHome(page);
    const names =await page.$$eval('.home-list .home-word-input', (inputs) => inputs.map((i) => i.value || '(parola senza testo)'));
    for (let i = 0; i < names.length; i++) {
      await openHome(page);
      const target = (await page.$$('.home-list .home-word-input'))[i];
      await target.scrollIntoViewIfNeeded();
      await target.tap({ timeout: 8000 });
      await page.waitForTimeout(SETTLE_MS);
      await record(`home → "${names[i]}"`, await snapshot(page));
    }

    // 2. i tre link in fondo alla home
    const footerCount = await (async () => { await openHome(page); return (await page.$$('a.footer-link')).length; })();
    for (let i = 0; i < footerCount; i++) {
      await openHome(page);
      const link = (await page.$$('a.footer-link'))[i];
      const label = (await link.textContent() || '').trim();
      await link.scrollIntoViewIfNeeded();
      await link.tap({ timeout: 8000 });
      await page.waitForTimeout(SETTLE_MS);
      await record(`home → link "${label}"`, await snapshot(page));
      // nei contatti un indirizzo email scritto in pagina deve essere un collegamento "mailto:" (cliccabile), non solo testo
      if (/contact/i.test(label)) {
        const mail = await page.evaluate(() => ({ text: /[^\s@]+@[^\s@]+\.[^\s@]+/.test(document.body.innerText), link: !!document.querySelector('a[href^="mailto:"]') }));
        const mailOk = !mail.text || mail.link;
        result.steps.push({ what: 'contacts: email cliccabile', hash: mail.link ? 'mailto' : mail.text ? '(solo testo)' : '(nessuna email)', ok: mailOk });
        if (!mailOk) result.problems.push("contacts: l'email c'è ma non è un collegamento mailto (non si può cliccare)");
      }
      // dal link, il tasto home riporta alla home
      const burger = await page.$('a.hamburger');
      if (burger) {
        await burger.tap({ timeout: 8000 });
        await page.waitForTimeout(SETTLE_MS);
        const back = await snapshot(page);
        if (!/^#\/?$/.test(back.hash) && back.hash !== '#/home') result.problems.push(`tasto home da "${label}" porta a ${back.hash || '(nessun #)'} invece che alla home`);
        else result.steps.push({ what: `tasto home da "${label}"`, hash: back.hash, ok: true });
      } else {
        result.problems.push(`pagina "${label}": manca il tasto home`);
      }
    }

    // 3. frecce dei progetti: dal primo progetto si va avanti fino a tornare al primo (così si passa da tutti, ultimo compreso)
    const projectNames = names.filter((n) => n && !n.startsWith('(parola'));
    if (projectNames.length) {
      await openHome(page);
      const first = (await page.$$('.home-list .home-word-input'))[0];
      await first.tap({ timeout: 8000 });
      await page.waitForTimeout(SETTLE_MS);
      const startHash = (await snapshot(page)).hash;
      const seen = [];
      for (let step = 0; step < 60; step++) {
        const next = await page.$('button.nav-arrow.next');
        if (!next) { result.problems.push(`freccia "avanti" assente su ${(await snapshot(page)).hash}`); break; }
        await next.scrollIntoViewIfNeeded();
        await next.tap({ timeout: 8000 });
        await page.waitForTimeout(SETTLE_MS);
        const s = await snapshot(page);
        await record(`freccia avanti (${step + 1})`, s);
        seen.push(s.hash);
        if (s.hash === startHash) break;
      }
      // e una freccia "indietro" dal primo: deve finire sull'ultimo, non su una pagina inesistente
      const prev = await page.$('button.nav-arrow.prev');
      if (prev) {
        await prev.scrollIntoViewIfNeeded();
        await prev.tap({ timeout: 8000 });
        await page.waitForTimeout(SETTLE_MS);
        await record('freccia indietro dal primo', await snapshot(page));
      } else {
        result.problems.push('freccia "indietro" assente');
      }
    }

    if (result.jsErrors.length) result.problems.push(`${result.jsErrors.length} errori JavaScript: ${[...new Set(result.jsErrors)].slice(0, 3).join(' | ')}`);
    await context.close();
  } catch (error) {
    result.problems.push(`il giro si è interrotto: ${String(error.message || error).split('\n')[0]}`);
  } finally {
    await browser.close();
  }
  return result;
}

(async () => {
  console.log(`Giro dei tocchi su ${BASE} — telefono, motori: ${ENGINES.join(', ')}`);
  const results = [];
  for (const engine of ENGINES) {
    if (!pw[engine]) { console.error(`Motore sconosciuto: ${engine}`); process.exit(2); }
    const r = await runEngine(engine);
    results.push(r);
    console.log(`  ${r.label}: ${r.steps.length} tocchi, ${r.steps.filter((s) => s.ok).length} su pagine vere, problemi: ${r.problems.length}`);
    r.problems.forEach((p) => console.log(`    ✗ ${p}`));
  }

  const lines = ['# Giro dei tocchi (telefono)', '', `Sito: ${BASE}`, '', '| Motore | Tocchi | Pagine vere | Problemi |', '|---|---|---|---|'];
  results.forEach((r) => lines.push(`| ${r.label} | ${r.steps.length} | ${r.steps.filter((s) => s.ok).length} | ${r.problems.length ? '❌ ' + r.problems.length : '✅ nessuno'} |`));
  const withProblems = results.filter((r) => r.problems.length);
  lines.push('');
  if (withProblems.length) {
    lines.push('## Problemi', '');
    withProblems.forEach((r) => { lines.push(`**${r.label}**`, ''); r.problems.forEach((p) => lines.push(`- ${p}`)); lines.push(''); });
  } else {
    lines.push('## ✅ Nessun problema', '', 'Ogni tocco ha portato a una pagina vera (mai "Questa pagina non esiste.") e non ci sono stati errori JavaScript.', '');
  }
  const reference = results[0];
  if (reference) {
    lines.push('## Cosa è stato toccato', '', reference.steps.map((s) => `- ${s.what} → \`${s.hash || '(nessun #)'}\``).join('\n'), '');
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'tocchi.md'), lines.join('\n'));
  fs.writeFileSync(path.join(OUT, 'tocchi.json'), JSON.stringify(results, null, 2));
  console.log('\n' + lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n' + lines.join('\n') + '\n');
  process.exit(withProblems.length ? 1 : 0);
})();
