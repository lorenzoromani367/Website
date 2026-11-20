// Genera js/images-data.js: l'elenco delle foto in "images/", le loro misure vere
// (larghezza x altezza) e l'elenco dei file in "testi/". Genera anche js/images-order.js:
// l'ORDINE in cui il sito numera le foto (le foto che c'erano restano dove sono, le nuove
// vanno in fondo: vedi js/photo-order.js).
//
//   node watch_images.js          genera i file e resta in ascolto (si aggiornano da soli)
//   node watch_images.js --once   genera i file una volta e finisce (usato anche dalla pubblicazione)
//
// Il server locale (server.js) fa già lo stesso in automatico: questo file serve
// solo se vuoi rigenerare l'elenco a mano.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PhotoOrder = require('./js/photo-order.js');

const ROOT = __dirname;
const IMAGES_DIR = path.join(ROOT, 'images');
const TEXTS_DIR = path.join(ROOT, 'testi');
const OUTPUT_FILE = path.join(ROOT, 'js', 'images-data.js');
const ORDER_FILE = path.join(ROOT, 'js', 'images-order.js');
const IMAGE_RE = /\.(jpg|jpeg|png|webp|gif)$/i;

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir)) {
    if (file.startsWith('.')) continue; // file nascosti
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (IMAGE_RE.test(file)) {
      // percorso relativo alla cartella del sito, con "/" ovunque
      fileList.push(path.relative(ROOT, filePath).replace(/\\/g, '/'));
    }
  }
  return fileList;
}

/* ---- misure delle foto (senza librerie: si leggono dall'intestazione del file) ---- */

function exifOrientation(buf, start, end) {
  // "start" è l'inizio dell'intestazione TIFF dentro il blocco EXIF di un JPEG
  const le = buf.toString('ascii', start, start + 2) === 'II';
  const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  if (start + 8 > end || u16(start + 2) !== 0x2a) return 0;
  const ifd = start + u32(start + 4);
  if (ifd + 2 > end) return 0;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > end) break;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return 0;
}

// Restituisce [larghezza, altezza] COME LE MOSTRA IL BROWSER (cioè già con la
// rotazione EXIF applicata: una foto scattata in verticale resta verticale).
function readImageSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  }
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const kind = buf.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    return null;
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    let orientation = 1;
    while (i + 4 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = buf.readUInt16BE(i + 2);
      if (marker === 0xe1 && buf.toString('ascii', i + 4, i + 8) === 'Exif') {
        orientation = exifOrientation(buf, i + 10, i + 2 + length) || orientation;
      }
      const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrameHeader) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return orientation >= 5 && orientation <= 8 ? [h, w] : [w, h];
      }
      i += 2 + length;
    }
  }
  return null;
}

const sizeCache = new Map(); // percorso -> { mtimeMs, size, dims, hash } (così il controllo ogni secondo non rilegge le foto)

// Misure della foto + "impronta" del contenuto (due file con la stessa impronta sono la stessa foto, copiata)
function infoOf(relPath) {
  const abs = path.join(ROOT, relPath);
  const stat = fs.statSync(abs);
  const cached = sizeCache.get(relPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached;
  let dims = null;
  let hash = null;
  try {
    const buf = fs.readFileSync(abs);
    hash = crypto.createHash('sha1').update(buf).digest('hex');
    dims = readImageSize(buf);
  } catch (e) {
    dims = null;
  }
  if (dims && !(dims[0] > 0 && dims[1] > 0)) dims = null;
  const entry = { mtimeMs: stat.mtimeMs, size: stat.size, dims, hash };
  sizeCache.set(relPath, entry);
  return entry;
}

function listTexts() {
  if (!fs.existsSync(TEXTS_DIR)) return [];
  return fs.readdirSync(TEXTS_DIR).filter((f) => !f.startsWith('.') && /\.txt$/i.test(f)).sort();
}

// ORDINE STABILE (20 novembre; vedi js/photo-order.js per il perché). L'ordine ricordato sta in js/images-order.js: ogni foto di un progetto prende il suo
// numero da lì, non dall'ordine alfabetico, così una foto nuova va in fondo e non fa scivolare le misure salvate sulle foto sbagliate.
// js/images-data.js resta in ordine alfabetico, come prima: così il server locale vecchio (se resta acceso mentre si scarica questo aggiornamento) e
// quello nuovo scrivono lo STESSO file, e il sito mette in ordine da sé le foto (PhotoOrder.arrange) guardando images-order.js.
// Il file dell'ordine si riscrive solo se si legge: se c'è ma non si legge (righe di conflitto di GitHub Desktop, file a metà mentre git lo scrive) non si
// tocca, così non si perde l'ordine ricordato; la pubblicazione, che controlla la sintassi di ogni file di js/, in quel caso si ferma.
let orderWarned = false;
function readOrderMemory() {
  let text;
  try {
    text = fs.readFileSync(ORDER_FILE, 'utf8');
  } catch (e) {
    return { ok: true, list: [] }; // non c'è ancora: si parte dall'ordine alfabetico
  }
  try {
    const sandbox = {};
    new Function('window', text)(sandbox);
    if (!Array.isArray(sandbox.IMAGE_ORDER)) throw new Error('manca window.IMAGE_ORDER');
    return { ok: true, list: sandbox.IMAGE_ORDER.filter((p) => typeof p === 'string') };
  } catch (e) {
    return { ok: false, list: [] };
  }
}

function render(memory) {
  // sort() semplice: stesso ordine su Mac, Windows e sul server di pubblicazione
  const images = scanDirectory(IMAGES_DIR).sort();
  const sizeLines = [];
  const byHash = new Map();
  images.forEach((rel) => {
    const info = infoOf(rel);
    if (info.dims) sizeLines.push(`  ${JSON.stringify(rel)}: [${info.dims[0]}, ${info.dims[1]}]`);
    if (info.hash) byHash.set(info.hash, (byHash.get(info.hash) || []).concat(rel));
  });
  // Le foto della cartella "core archive" sono quasi sempre copie di foto di un progetto: per ognuna, dov'è la copia
  // (serve a sapere a quale progetto appartiene una foto dell'archivio).
  const twinLines = [];
  images.forEach((rel) => {
    if (rel.split('/')[1] !== 'core archive') return;
    const info = infoOf(rel);
    const other = (byHash.get(info.hash) || []).find((candidate) => candidate.split('/')[1] !== 'core archive');
    if (other) twinLines.push(`  ${JSON.stringify(rel)}: ${JSON.stringify(other)}`);
  });
  const texts = listTexts();
  return {
    count: images.length,
    text:
      '// Generato automaticamente da watch_images.js (o dal server locale) — non modificare a mano.\n' +
      `window.DYNAMIC_IMAGES = ${JSON.stringify(images, null, 2)};\n` +
      `window.IMAGE_SIZES = {\n${sizeLines.join(',\n')}\n};\n` +
      `window.IMAGE_TWINS = {\n${twinLines.join(',\n')}\n};\n` +
      `window.DYNAMIC_TEXTS = ${JSON.stringify(texts)};\n`,
    orderText:
      '// Generato automaticamente da watch_images.js (o dal server locale) — non modificare a mano.\n' +
      '// L\'ORDINE in cui il sito numera le foto: quelle che c\'erano restano dove sono, le nuove vanno in fondo (vedi js/photo-order.js).\n' +
      `window.IMAGE_ORDER = ${JSON.stringify(PhotoOrder.arrange(images, memory.list), null, 2)};\n`,
  };
}

// Scrive un file solo se il contenuto è cambiato. Restituisce true se l'ha riscritto.
function writeIfChanged(file, text) {
  let current = null;
  try {
    current = fs.readFileSync(file, 'utf8');
  } catch (e) {
    current = null;
  }
  if (current === text) return false;
  fs.writeFileSync(file, text);
  return true;
}

// Riscrive i file solo se qualcosa è cambiato. "changed" = ne ha riscritto almeno uno.
function generate() {
  const memory = readOrderMemory();
  const { count, text, orderText } = render(memory);
  let changed = writeIfChanged(OUTPUT_FILE, text);
  if (memory.ok) {
    if (writeIfChanged(ORDER_FILE, orderText)) changed = true;
  } else if (!orderWarned) {
    orderWarned = true;
    console.warn('js/images-order.js c\'è ma non si legge (righe di conflitto? file a metà?): non lo riscrivo. Se resta così, sistemalo o cancellalo.');
  }
  return { changed, count };
}

function log(result) {
  console.log(`[${new Date().toLocaleTimeString()}] images-data.js e images-order.js aggiornati (${result.count} foto trovate)`);
}

module.exports = { generate, readImageSize };

if (require.main === module) {
  const once = process.argv.includes('--once');
  try {
    const first = generate();
    log(first);
  } catch (err) {
    console.error('Errore nella generazione di images-data.js:', err);
    if (once) process.exit(1);
  }
  if (!once) {
    // Controllo ogni secondo (più affidabile di fs.watch su macOS, che a volte perde gli eventi)
    setInterval(() => {
      try {
        const result = generate();
        if (result.changed) log(result);
      } catch (err) {
        /* cartella in uso mentre si copiano i file: riprova al prossimo giro */
      }
    }, 1000);
    console.log(`In ascolto di ${IMAGES_DIR} ...\nResto attivo in background per te.`);
  }
}
