// Server locale del sito: serve i file e salva su disco le modifiche fatte in "modalità modifica".
// Si avvia con Start_Website.command (oppure: node server.js). Porta 8000, cambiabile con PORT=1234.
//
// In più, ogni secondo tiene aggiornato js/images-data.js (elenco e misure delle foto in "images/"):
// non serve più far girare a parte watch_images.js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { generate: generateImageList } = require('./watch_images.js');
const { mergeState, sameState } = require('./js/state-merge.js');

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
  let text;
  try {
    text = fs.readFileSync(STATE_FILE, 'utf8');
  } catch (e) {
    return { exists: false, corrupt: false, version: 0, data: {} }; // file assente: si riparte da uno stato vuoto
  }
  try {
    const match = text.match(/window\.SITE_STATE\s*=\s*([\s\S]*?);?\s*$/);
    if (match) {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed === 'object') {
        return { exists: true, corrupt: false, version: Number(parsed.version) || 0, data: parsed.data && typeof parsed.data === 'object' ? parsed.data : {} };
      }
    }
  } catch (e) {
    /* illeggibile (es. righe "<<<<<<<" lasciate da un conflitto in GitHub Desktop): vedi sotto */
  }
  return { exists: true, corrupt: true, version: 0, data: {} };
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

// L'inverso: il file su disco -> { chiave: "testo" }, come la memoria del browser
function decodeStateValue(value) {
  return value && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.__raw === 'string' ? value.__raw : JSON.stringify(value);
}
function stateToStrings(data) {
  const out = {};
  Object.keys(data).forEach((key) => { out[key] = decodeStateValue(data[key]); });
  return out;
}

// "Quante cose" ci sono nello stato (una posizione, una misura, una didascalia, una riga tolta...): serve solo
// ad accorgersi se un salvataggio ne toglie molte tutte insieme.
function countStateEntries(strings) {
  return Object.keys(strings).reduce((sum, key) => {
    try {
      const value = JSON.parse(strings[key]);
      return sum + (Array.isArray(value) ? value.length : value && typeof value === 'object' ? Object.keys(value).length : 1);
    } catch (e) {
      return sum + 1;
    }
  }, 0);
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
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, STATE_FILE);
}

// Copie di sicurezza in .state-backups/ (non viene pubblicata). Tre livelli, perché le sole "ultime 40" si
// riempiono in pochi minuti di lavoro e non bastano se ci si accorge di un problema il giorno dopo:
//   - ad ogni salvataggio, la versione precedente (si tengono le ultime 40);
//   - una per giorno, nella cartella "giornaliere" (si tengono 90 giorni);
//   - quando un salvataggio toglie molte voci tutte insieme, la versione di prima nella cartella
//     "prima-di-togliere-molto" (si tengono le ultime 30), senza mai ruotare via insieme alle altre.
function backupStateFile(kind) {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const dir = path.join(ROOT, '.state-backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prune = (folder, prefix, keep) => {
      const names = fs.readdirSync(folder).filter((f) => f.startsWith(prefix)).sort();
      names.slice(0, Math.max(0, names.length - keep)).forEach((f) => fs.unlinkSync(path.join(folder, f)));
    };
    if (kind === 'shrink' || kind === 'corrupt') {
      const sub = path.join(dir, kind === 'shrink' ? 'prima-di-togliere-molto' : 'file-illeggibili');
      fs.mkdirSync(sub, { recursive: true });
      const target = path.join(sub, `site-state.${stamp}.js`);
      fs.copyFileSync(STATE_FILE, target);
      prune(sub, 'site-state.', 30);
      return target;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(STATE_FILE, path.join(dir, `site-state.${stamp}.js`));
    prune(dir, 'site-state.', 40);
    const daily = path.join(dir, 'giornaliere');
    fs.mkdirSync(daily, { recursive: true });
    const todays = path.join(daily, `site-state.${new Date().toISOString().slice(0, 10)}.js`);
    if (!fs.existsSync(todays)) {
      fs.copyFileSync(STATE_FILE, todays);
      prune(daily, 'site-state.', 90);
    }
    return null;
  } catch (e) {
    /* la copia di sicurezza non deve mai impedire il salvataggio vero */
    return null;
  }
}

const STATE_KEY_RE = /^[A-Za-z0-9_.:\-]{1,200}$/;

// Salva lo stato mandato da un browser FONDENDOLO con quello che c'è già su disco (vedi js/state-merge.js):
// mai più "chi salva per ultimo cancella tutto il resto". Il browser manda
//   state       = quello che ha ora,
//   changes     = le voci cambiate QUI dall'ultima volta che ha letto/salvato il file, com'erano prima (null = non c'era):
//                 tutte le altre voci sono rimaste uguali. Assente = il browser non lo sa: allora non si toglie nulla,
//   baseVersion = la versione di quel file.
// Risponde con lo stato fuso: il browser lo adotta, così tutti i browser convergono.
async function handleSyncState(req, res) {
  try {
    const { baseVersion, changes, base, state } = JSON.parse(await readBody(req));
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Stato non valido');

    const local = {};
    for (const [key, value] of Object.entries(state)) {
      if (!STATE_KEY_RE.test(key) || typeof value !== 'string') throw new Error(`Voce non valida: ${key}`);
      local[key] = value;
    }
    // Com'era il file quando questo browser lo ha letto l'ultima volta ("base"), ricostruito da "changes"
    // (oppure mandato per intero in "base")
    let baseStrings = null;
    if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
      baseStrings = {};
      Object.keys(local).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(changes, key)) baseStrings[key] = local[key]; });
      Object.keys(changes).forEach((key) => { if (STATE_KEY_RE.test(key) && typeof changes[key] === 'string') baseStrings[key] = changes[key]; });
    } else if (base && typeof base === 'object' && !Array.isArray(base)) {
      baseStrings = {};
      Object.keys(base).forEach((key) => { if (STATE_KEY_RE.test(key) && typeof base[key] === 'string') baseStrings[key] = base[key]; });
    }
    const clientVersion = Number(baseVersion) || 0;

    const current = readStateFile();
    const remote = stateToStrings(current.data);
    let merged;
    let conflicts = [];
    if (current.corrupt) {
      // Il file su disco non si legge più: se lo si trattasse da vuoto, e poi lo si "fondesse", si perderebbe tutto.
      // Si tiene una copia del file rovinato e si riparte dallo stato completo di questo browser.
      const copy = backupStateFile('corrupt');
      console.log(`[!] js/site-state.js non era leggibile (forse un conflitto in GitHub Desktop): lo ricreo da questo browser.${copy ? ' Copia del file rovinato: ' + path.relative(ROOT, copy) : ''}`);
      merged = local;
    } else if (clientVersion > current.version) {
      // Il file su disco è PIÙ VECCHIO di quello che questo browser aveva già salvato (es. in GitHub Desktop è stato rimesso
      // all'ultima versione pubblicata, o si sta usando un'altra copia della cartella): il browser ha il lavoro più recente,
      // quindi vale quello (le voci che il file ha in più sono quelle che il browser aveva già tolto dopo quella versione).
      merged = local;
    } else {
      ({ merged, conflicts } = mergeState(baseStrings || {}, local, remote, { prefer: 'local' }));
    }

    const unchanged = !current.corrupt && sameState(merged, remote);
    const version = unchanged ? current.version : Math.max(current.version, clientVersion) + 1;
    if (!unchanged) {
      // Se questo salvataggio toglie molte voci tutte insieme, la versione di prima si conserva a parte
      const before = countStateEntries(remote);
      const after = countStateEntries(merged);
      if (!current.corrupt && before - after >= 8 && after < before * 0.85) {
        const copy = backupStateFile('shrink');
        console.log(`[!] questo salvataggio toglie ${before - after} voci (da ${before} a ${after}). Se non era voluto, la versione di prima è in ${copy ? path.relative(ROOT, copy) : '.state-backups'}`);
      }
      if (!current.corrupt) backupStateFile();
      const encoded = {};
      Object.keys(merged).forEach((key) => { encoded[key] = encodeStateValue(merged[key]); });
      writeStateFile(version, encoded);
      console.log(`[OK] modifiche salvate su disco alle ${timeLabel()} (js/site-state.js)${conflicts.length ? ` — ${conflicts.length} voci cambiate in due posti insieme: tenuta l'ultima` : ''}`);
    }
    sendJson(res, 200, { success: true, version, timestamp: timeLabel(), state: merged, conflicts: conflicts.length });
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

// Dove, in "code" (content.js), si trova la foto con questo "src": cerca la voce "src: ..." di un progetto, senza
// badare a maiuscole/minuscole, e NON scambia per foto i collegamenti delle parole del Core Archive ("linkedImageSrc")
// né un'altra riga che contiene lo stesso percorso (prima si prendeva la prima riga qualsiasi che lo conteneva, e le
// misure finivano dentro una parola dell'archivio, dove nessuno le legge). Restituisce -1 se la foto non c'è.
function findImageSrcIndex(code, src) {
  const wanted = String(src || '');
  if (!wanted) return -1;
  const lowerCode = code.toLowerCase();
  const needle = wanted.toLowerCase();
  if (lowerCode.length !== code.length) return -1; // (maiuscole speciali che cambiano lunghezza: non si rischia)
  let from = 0;
  for (;;) {
    const at = lowerCode.indexOf(needle, from);
    if (at < 0) return -1;
    const before = code.slice(Math.max(0, at - 24), at);
    const after = code.charAt(at + needle.length);
    if (/(^|[^A-Za-z0-9_])src["']?\s*:\s*["']$/.test(before) && (after === '"' || after === "'")) return at;
    from = at + 1;
  }
}

// Salvataggio automatico delle proprietà delle immagini (es. zoomBox, width, offset)
async function handleSaveImageProps(req, res) {
  try {
    const { src, props } = JSON.parse(await readBody(req));
    const contentPath = path.join(ROOT, 'js', 'content.js');
    let code = fs.readFileSync(contentPath, 'utf8');
    let updated = false; // vero solo se la foto è stata trovata in content.js e la sua voce riscritta

    const srcIndex = findImageSrcIndex(code, src);
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
        updated = true;
      }
    }

    // Se la foto non sta in content.js non si scrive niente e NON si risponde "salvato" (senza "timestamp" il sito non
    // mostra il segno verde): prima rispondeva sempre di sì, anche quando non aveva scritto nulla.
    if (!updated) {
      console.log(`[--] ${String(src).split('/').pop()}: non c'è in content.js, nessuna modifica`);
      sendJson(res, 200, { success: true, updated: false });
      return;
    }
    fs.writeFileSync(contentPath, code);

    if (props.zoomBox && props.zoomBox.width) {
      console.log(`[OK] Zoom foto ${String(src).split('/').pop()} aggiornato a ${props.zoomBox.width} su disco`);
    } else {
      console.log(`[OK] content.js aggiornato su disco alle ${timeLabel()}`);
    }
    sendJson(res, 200, { success: true, updated: true, timestamp: timeLabel() });
  } catch (err) {
    console.error('Errore salvataggio image props:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
}

// Dentro "codice", sostituisce il blocco "pages: [...]" di ARCHIVE con le pagine nuove (se manca, lo aggiunge alla fine
// di ARCHIVE). Scorre le parentesi tenendo conto dei testi tra virgolette, così non si confonde con "[" o "]" scritti nei testi.
// (Prima si cercava con un'espressione che pretendeva una "description" dentro ARCHIVE: non c'è, quindi non trovava mai nulla
// e content.js non veniva mai aggiornato.)
function replaceArchivePages(code, pages) {
  const archiveAt = code.indexOf('const ARCHIVE');
  if (archiveAt < 0) throw new Error('ARCHIVE non trovato in content.js');
  const pagesString = JSON.stringify(pages, null, 4).replace(/^/gm, '  ').trim();

  const closingOf = (from, open, close) => {
    let depth = 0;
    let inString = null;
    for (let i = from; i < code.length; i++) {
      const c = code[i];
      if (inString) {
        if (c === '\\') i++;
        else if (c === inString) inString = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inString = c; continue; }
      if (c === open) depth++;
      if (c === close) { depth--; if (depth === 0) return i; }
    }
    throw new Error('parentesi non bilanciate in content.js');
  };

  const pagesAt = code.indexOf('pages:', archiveAt);
  if (pagesAt >= 0) {
    const arrayEnd = closingOf(code.indexOf('[', pagesAt), '[', ']');
    return code.slice(0, pagesAt) + 'pages: ' + pagesString + code.slice(arrayEnd + 1);
  }
  const objectEnd = closingOf(code.indexOf('{', archiveAt), '{', '}');
  const before = code.slice(0, objectEnd).replace(/,?\s*$/, ',');
  return before + '\n  pages: ' + pagesString + '\n' + code.slice(objectEnd);
}

// Salvataggio completo della struttura a pagine dell'archivio (ARCHIVE.pages)
async function handleSaveArchivePages(req, res) {
  try {
    const { pages } = JSON.parse(await readBody(req));
    if (!Array.isArray(pages)) throw new Error('Pagine non valide');
    const contentPath = path.join(ROOT, 'js', 'content.js');
    const updated = replaceArchivePages(fs.readFileSync(contentPath, 'utf8'), pages);
    new Function(updated); // content.js deve restare un file valido: se no, non si scrive nulla
    fs.writeFileSync(contentPath, updated);

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
