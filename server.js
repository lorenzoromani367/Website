// Server locale del sito: serve i file e salva su disco le modifiche fatte in "modalità modifica".
// Si avvia con Start_Website.command (oppure: node server.js). Porta 8000, cambiabile con PORT=1234.
//
// In più, ogni secondo tiene aggiornato js/images-data.js (elenco e misure delle foto in "images/"):
// non serve più far girare a parte watch_images.js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { generate: generateImageList } = require('./watch_images.js');

const PORT = Number(process.env.PORT) || 8000;
const ROOT = __dirname;
const STATE_FILE = path.join(ROOT, 'js', 'site-state.js');
const MAX_BODY_BYTES = 12 * 1024 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

/* ---------------------------------------------------------------------------
   Sicurezza di base: le richieste che MODIFICANO i file arrivano solo dal sito
   aperto su questo computer (o sulla tua rete di casa), mai da un'altra pagina
   web aperta nel browser.
   --------------------------------------------------------------------------- */
function isLocalHostname(name) {
  name = String(name || '').toLowerCase();
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(name)) return true;
  if (name.endsWith('.local')) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(name)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(name)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(name)) return true;
  return false;
}

function hostnameOf(value) {
  try {
    return new URL(/^[a-z]+:\/\//i.test(value) ? value : 'http://' + value).hostname;
  } catch (e) {
    return '';
  }
}

function writeRequestAllowed(req) {
  const hostName = hostnameOf(req.headers.host || '');
  if (!isLocalHostname(hostName)) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true; // richieste dirette (non da una pagina web)
  const originName = hostnameOf(origin);
  return isLocalHostname(originName);
}

function sendJson(res, status, payload) {
  try {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
  } catch (e) {
    /* connessione già chiusa dal browser */
  }
}

function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Richiesta troppo grande'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function timeLabel() {
  return new Date().toLocaleTimeString('it-IT', { hour12: false });
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---------------------------------------------------------------------------
   Stato salvato su disco (js/site-state.js): tutto quello che in "modalità
   modifica" finiva solo nella memoria del browser (posizioni, misure, voci
   tolte dalla home, parole dell'archivio...). Così lo vedono TUTTI i browser.
   --------------------------------------------------------------------------- */
function readStateFile() {
  try {
    const text = fs.readFileSync(STATE_FILE, 'utf8');
    const match = text.match(/window\.SITE_STATE\s*=\s*([\s\S]*?);?\s*$/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        return { version: Number(parsed.version) || 0, data: parsed.data && typeof parsed.data === 'object' ? parsed.data : {} };
      }
    }
  } catch (e) {
    /* file assente o illeggibile: si riparte da uno stato vuoto */
  }
  return { version: 0, data: {} };
}

// Il browser salva ogni voce come testo; qui la si scrive come JSON leggibile
// quando possibile (e il browser la ricostruisce identica, vedi site-state nel codice del sito).
function encodeStateValue(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (JSON.stringify(parsed) === raw) return parsed;
  } catch (e) {
    /* non è JSON: resta testo */
  }
  return { __raw: raw };
}

// Stesso contenuto = stesso testo, qualunque sia l'ordine delle chiavi
function canonicalJson(value) {
  const sorted = (v) => {
    if (Array.isArray(v)) return v.map(sorted);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach((k) => { out[k] = sorted(v[k]); });
      return out;
    }
    return v;
  };
  return JSON.stringify(sorted(value));
}

function writeStateFile(version, data) {
  const ordered = {};
  Object.keys(data).sort().forEach((key) => { ordered[key] = data[key]; });
  const body = {
    version,
    updatedAt: new Date().toISOString(),
    data: ordered,
  };
  const text =
    '// Generato automaticamente dal server locale: contiene le modifiche fatte in modalità modifica\n' +
    '// (posizioni, misure, voci tolte dalla home...). Non modificare a mano — si aggiorna da solo.\n' +
    `window.SITE_STATE = ${JSON.stringify(body, null, 2)};\n`;
  backupStateFile();
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, STATE_FILE);
}

// Prima di ogni salvataggio, la versione precedente va in .state-backups/ (non viene pubblicata):
// se un giorno una modifica sbagliata cancella qualcosa, si può recuperare. Si tengono le ultime 40.
function backupStateFile() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const dir = path.join(ROOT, '.state-backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(STATE_FILE, path.join(dir, `site-state.${stamp}.js`));
    const old = fs.readdirSync(dir).filter((f) => f.startsWith('site-state.')).sort();
    old.slice(0, Math.max(0, old.length - 40)).forEach((f) => fs.unlinkSync(path.join(dir, f)));
  } catch (e) {
    /* la copia di sicurezza non deve mai impedire il salvataggio vero */
  }
}

const STATE_KEY_RE = /^[A-Za-z0-9_.:\-]{1,200}$/;

async function handleSyncState(req, res) {
  try {
    const { baseVersion, state } = JSON.parse(await readBody(req));
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Stato non valido');

    const incoming = {};
    for (const [key, value] of Object.entries(state)) {
      if (!STATE_KEY_RE.test(key) || typeof value !== 'string') throw new Error(`Voce non valida: ${key}`);
      incoming[key] = encodeStateValue(value);
    }

    const current = readStateFile();
    if ((Number(baseVersion) || 0) < current.version) {
      // Un altro browser (o un'altra finestra) ha salvato più di recente: non lo sovrascriviamo.
      sendJson(res, 409, { success: false, conflict: true, version: current.version });
      return;
    }

    const unchanged = canonicalJson(current.data) === canonicalJson(incoming);
    const version = unchanged ? current.version : Math.max(current.version, Number(baseVersion) || 0) + 1;
    if (!unchanged) {
      writeStateFile(version, incoming);
      console.log(`[OK] modifiche salvate su disco alle ${timeLabel()} (js/site-state.js)`);
    }
    sendJson(res, 200, { success: true, version, timestamp: timeLabel() });
  } catch (err) {
    console.error('Errore salvataggio stato:', err.message);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

/* ---------------------------------------------------------------------------
   Gli altri salvataggi (testi, nomi dei progetti, proprietà delle foto, archivio)
   --------------------------------------------------------------------------- */
async function handleSaveContent(req, res) {
  try {
    const { slug, text } = JSON.parse(await readBody(req));
    const textArray = Array.isArray(text) ? text : String(text).split('\n');
    const rawText = textArray.join('\n');

    const filename = slug === 'core archive' ? 'core_archive.txt' : `${slug}.txt`;
    if (!/^[\w\-. ]+\.txt$/.test(filename) || filename.includes('..')) throw new Error('Nome file non valido');
    fs.writeFileSync(path.join(ROOT, 'testi', filename), rawText);
    console.log(`[OK] ${filename} aggiornato su disco alle ${timeLabel()}`);
    sendJson(res, 200, { success: true, timestamp: timeLabel() });
  } catch (err) {
    console.error('Errore salvataggio:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

async function handleRenameProject(req, res) {
  try {
    const { slug, newName } = JSON.parse(await readBody(req));
    const contentPath = path.join(ROOT, 'js', 'content.js');
    let codeContent = fs.readFileSync(contentPath, 'utf8');

    // Trova il progetto con questo slug e cambia il suo "name"
    const match = codeContent.match(new RegExp('slug:\\s*["\']' + escapeRegExp(slug) + '["\']'));
    if (match) {
      const startIdx = match.index;
      let endIdx = codeContent.indexOf('images:', startIdx);
      if (endIdx === -1) endIdx = startIdx + 500;

      let chunk = codeContent.substring(startIdx, endIdx);
      const safeName = JSON.stringify(String(newName));
      chunk = chunk.replace(/name:\s*["'][^"']*["']/, () => `name: ${safeName}`);
      codeContent = codeContent.substring(0, startIdx) + chunk + codeContent.substring(endIdx);
      fs.writeFileSync(contentPath, codeContent);
    }

    console.log(`[OK] content.js aggiornato su disco alle ${timeLabel()}`);
    sendJson(res, 200, { success: true, timestamp: timeLabel() });
  } catch (err) {
    console.error('Errore rinomina progetto:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

// Salvataggio automatico delle proprietà delle immagini (es. zoomBox, width, offset)
async function handleSaveImageProps(req, res) {
  try {
    const { src, props } = JSON.parse(await readBody(req));
    const contentPath = path.join(ROOT, 'js', 'content.js');
    let code = fs.readFileSync(contentPath, 'utf8');

    const srcIndex = code.indexOf(`"${src}"`) !== -1 ? code.indexOf(`"${src}"`) : code.indexOf(`'${src}'`);
    if (srcIndex !== -1) {
      let startIdx = srcIndex;
      let braceCount = 0;
      while (startIdx >= 0) {
        if (code[startIdx] === '}') braceCount++;
        if (code[startIdx] === '{') {
          if (braceCount === 0) break;
          braceCount--;
        }
        startIdx--;
      }

      let endIdx = startIdx;
      braceCount = 0;
      while (endIdx < code.length) {
        if (code[endIdx] === '{') braceCount++;
        if (code[endIdx] === '}') {
          braceCount--;
          if (braceCount === 0) break;
        }
        endIdx++;
      }

      if (startIdx >= 0 && endIdx < code.length) {
        let objStr = code.substring(startIdx, endIdx + 1);

        if (props.zoomBox !== undefined) objStr = objStr.replace(/,\s*zoomBox:\s*\{[^{}]+(?:\{[^{}]+\}[^{}]*)*\}/g, '');
        if (props.width !== undefined) objStr = objStr.replace(/,\s*width:\s*["'][^"']+["']/g, '');
        if (props.height !== undefined) objStr = objStr.replace(/,\s*height:\s*["'][^"']+["']/g, '');
        if (props.offset !== undefined) objStr = objStr.replace(/,\s*offset:\s*\{[^}]+\}/g, '');
        if (props.captionOffset !== undefined) objStr = objStr.replace(/,\s*captionOffset:\s*\{[^}]+\}/g, '');

        const additions = [];
        if (props.zoomBox) {
          let zbStr = `zoomBox: { width: "${props.zoomBox.width}", height: "${props.zoomBox.height}"`;
          if (props.zoomBox.offset) zbStr += `, offset: { x: ${Math.round(props.zoomBox.offset.x)}, y: ${Math.round(props.zoomBox.offset.y)} }`;
          zbStr += ' }';
          additions.push(zbStr);
        }
        if (props.width) additions.push(`width: "${props.width}"`);
        if (props.height) additions.push(`height: "${props.height}"`);
        if (props.offset !== undefined) additions.push(`offset: { x: ${Math.round(props.offset.x)}, y: ${Math.round(props.offset.y)} }`);
        if (props.captionOffset !== undefined) additions.push(`captionOffset: { x: ${Math.round(props.captionOffset.x)}, y: ${Math.round(props.captionOffset.y)} }`);

        if (additions.length > 0) {
          const isMultiLine = objStr.includes('\n');
          objStr = objStr.replace(/,(\s*)\}$/, '$1}');
          const match = objStr.match(/(\s*)\}$/);
          const whitespace = match ? match[1] : '';
          objStr = objStr.replace(/\s*\}$/, '');

          if (isMultiLine) {
            objStr += ',\n' + additions.join(',\n') + whitespace + '}';
          } else {
            objStr += ', ' + additions.join(', ') + ' }';
          }
        }

        code = code.substring(0, startIdx) + objStr + code.substring(endIdx + 1);
      }
    }

    fs.writeFileSync(contentPath, code);

    if (props.zoomBox && props.zoomBox.width) {
      console.log(`[OK] Zoom foto ${String(src).split('/').pop()} aggiornato a ${props.zoomBox.width} su disco`);
    } else {
      console.log(`[OK] content.js aggiornato su disco alle ${timeLabel()}`);
    }
    sendJson(res, 200, { success: true, timestamp: timeLabel() });
  } catch (err) {
    console.error('Errore salvataggio image props:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

// Salvataggio completo della struttura a pagine dell'archivio (ARCHIVE.pages)
async function handleSaveArchivePages(req, res) {
  try {
    const { pages } = JSON.parse(await readBody(req));
    const contentPath = path.join(ROOT, 'js', 'content.js');
    let contentCode = fs.readFileSync(contentPath, 'utf8');

    const pagesString = JSON.stringify(pages, null, 4).replace(/^/gm, '  ');
    // Trova l'oggetto ARCHIVE e sostituisce il blocco pages (o le immagini, se non ha pages)
    const regex = /(const\s+ARCHIVE\s*=\s*\{[\s\S]*?title:\s*["']core archive["'][\s\S]*?description:\s*\[[\s\S]*?\]\s*,?)([\s\S]*?)(\};)/;
    if (regex.test(contentCode)) {
      contentCode = contentCode.replace(regex, (m, head, rest, tail) => `${head}\n  pages: ${pagesString.trim()}\n${tail}`);
      fs.writeFileSync(contentPath, contentCode);
    }

    console.log(`[OK] content.js aggiornato su disco alle ${timeLabel()}`);
    sendJson(res, 200, { success: true, timestamp: timeLabel() });
  } catch (err) {
    console.error('Errore salvataggio archive pages:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

const API_ROUTES = {
  '/api/save-content': handleSaveContent,
  '/api/rename-project': handleRenameProject,
  '/api/save-image-props': handleSaveImageProps,
  '/api/save-archive-pages': handleSaveArchivePages,
  '/api/sync-state': handleSyncState,
};

/* ---------------------------------------------------------------------------
   File statici. Si comporta come il sito pubblicato: i nomi dei file contano
   con maiuscole e minuscole (su GitHub Pages "rock.jpg" e "rock.JPG" sono due
   file diversi, sul Mac no — qui te ne accorgi subito invece che dopo la pubblicazione).
   --------------------------------------------------------------------------- */
const dirCache = new Map(); // cartella -> { at, names }

function listDirCached(dir, fresh = false) {
  const hit = dirCache.get(dir);
  if (!fresh && hit && Date.now() - hit.at < 1500) return hit.names;
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    names = [];
  }
  dirCache.set(dir, { at: Date.now(), names });
  return names;
}

// Vero se ogni pezzo del percorso ha ESATTAMENTE le stesse maiuscole/minuscole del file sul disco.
function existsWithExactCase(absPath) {
  const rel = path.relative(ROOT, absPath);
  if (rel === '') return true;
  let dir = ROOT;
  for (const part of rel.split(path.sep)) {
    if (!listDirCached(dir).includes(part) && !listDirCached(dir, true).includes(part)) return false;
    dir = path.join(dir, part);
  }
  return true;
}

function findRealName(absPath) {
  const dir = path.dirname(absPath);
  const wanted = path.basename(absPath).toLowerCase();
  return listDirCached(dir, true).find((name) => name.toLowerCase() === wanted) || null;
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Richiesta non valida');
    return;
  }
  if (pathname.includes('\0')) {
    res.writeHead(400);
    res.end();
    return;
  }

  let filePath = path.normalize(path.join(ROOT, pathname === '/' ? 'index.html' : pathname));
  const insideSite = filePath === ROOT || filePath.startsWith(ROOT + path.sep);
  const hidden = path.relative(ROOT, filePath).split(path.sep).some((part) => part.startsWith('.'));
  if (!insideSite || hidden) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  let stat = null;
  try {
    stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = fs.statSync(filePath);
    }
  } catch (e) {
    stat = null;
  }

  if (!stat || !stat.isFile() || !existsWithExactCase(filePath)) {
    const realName = findRealName(filePath);
    if (realName && realName !== path.basename(filePath)) {
      console.log(`[404] ${pathname}  — sul disco il file si chiama "${realName}" (maiuscole/minuscole diverse): sul sito pubblicato non funzionerebbe`);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  const pathname = (req.url || '').split('?')[0];

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      // Sulla stessa pagina non serve; rispondiamo solo a chi arriva da questo computer/rete di casa
      if (writeRequestAllowed(req) && req.headers.origin) {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': req.headers.origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
      } else {
        res.writeHead(403);
      }
      res.end();
      return;
    }
    const handler = API_ROUTES[pathname];
    if (req.method !== 'POST' || !handler) {
      sendJson(res, 404, { success: false, error: 'Non trovato' });
      return;
    }
    if (!writeRequestAllowed(req)) {
      sendJson(res, 403, { success: false, error: 'Richiesta non consentita' });
      return;
    }
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    handler(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  serveStatic(req, res);
});

// Tiene aggiornato l'elenco delle foto (images-data.js) mentre il server è acceso
function refreshImageList(announce) {
  try {
    const result = generateImageList();
    if (announce || result.changed) {
      console.log(`[${timeLabel()}] elenco foto aggiornato (${result.count} foto trovate)`);
    }
  } catch (err) {
    /* cartella occupata mentre si copiano i file: riprova al prossimo giro */
  }
}
refreshImageList(true);
setInterval(() => refreshImageList(false), 1000);

server.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
  console.log('Premi Ctrl+C per fermare il server.');
});
