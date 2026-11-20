/* ==========================================================================
   ORDER.JS — prova dell'ORDINE STABILE delle foto (js/photo-order.js + watch_images.js)
   --------------------------------------------------------------------------
   Perché esiste (20 novembre): ogni foto di un progetto ha un NUMERO, la sua posizione nell'elenco delle foto (dopo le voci scritte in content.js), e le
   misure, l'ordine e il posto delle didascalie salvati in modalità modifica sono legati a quel numero. Quando l'elenco era sempre in ordine alfabetico, una
   foto nuova con un nome che viene prima di altre spingeva avanti tutte le seguenti: ognuna prendeva le misure e il posto di un'altra. È successo con le
   foto aggiunte il 20 novembre in Stills, Homes e Complicity; in Stills «murano» è diventata alta 855 px (più della finestra) e la pagina non scendeva
   più fino in fondo. Ora le foto che c'erano restano dove sono e quelle nuove vanno in fondo; l'ordine ricordato sta in js/images-order.js.

   Cosa fa, senza aprire nessun browser (dura un secondo):
     1) prova la funzione che mette in ordine (js/photo-order.js, la stessa che usa il sito);
     2) in una cartella temporanea mette il generatore copiato da qui e qualche foto finta, genera i file, poi aggiunge/toglie/rinomina foto e rigenera,
        controllando ogni volta sia js/images-data.js (resta in ordine alfabetico, come prima) sia js/images-order.js (l'ordine ricordato).
   Uso:  node order.js          (esce con errore se qualcosa non torna)
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PhotoOrder = require(path.join(ROOT, 'js', 'photo-order.js'));
let failures = 0;

const say = (ok, text) => { if (!ok) failures += 1; console.log(`${ok ? 'OK    ' : 'ERRORE'} ${text}`); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const show = (list) => `[${list.join(' · ')}]`;

/* ---------- 1) la funzione che mette in ordine ---------- */
{
  const files = ['A.jpg', 'B.jpg', 'C.jpg', 'D.jpg', 'E.jpg', 'F.jpg'];
  let out = PhotoOrder.arrange(files, ['B.jpg', 'D.jpg', 'F.jpg']);
  say(same(out, ['B.jpg', 'D.jpg', 'F.jpg', 'A.jpg', 'C.jpg', 'E.jpg']), `foto ricordate nell'ordine ricordato, poi le nuove in ordine alfabetico: ${show(out)}`);
  out = PhotoOrder.arrange(['D.jpg', 'B.jpg'], ['B.jpg', 'X.jpg', 'D.jpg']);
  say(same(out, ['B.jpg', 'D.jpg']), `una foto ricordata che non c'è più non conta: ${show(out)}`);
  out = PhotoOrder.arrange(['B.jpg', 'a.JPG'], ['A.jpg', 'b.JPG']);
  say(same(out, ['a.JPG', 'B.jpg']), `maiuscole e minuscole non contano, e il nome restituito è quello vero: ${show(out)}`);
  out = PhotoOrder.arrange(['b.jpg', 'a.jpg'], undefined);
  say(same(out, ['a.jpg', 'b.jpg']), `senza ordine ricordato: ordine alfabetico, come prima: ${show(out)}`);
  out = PhotoOrder.arrange(['b.jpg', 'a.jpg'], ['b.jpg', 7, null, {}, 'a.jpg']);
  say(same(out, ['b.jpg', 'a.jpg']), `voci strane nell'ordine ricordato sono ignorate: ${show(out)}`);
}

/* ---------- 2) il generatore, in una cartella temporanea ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ordine-foto-'));
const folder = path.join(tmp, 'images', 'prova');
const put = (name, dir = folder) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), Buffer.from([0xff, 0xd8, 0xff, 0xd9])); }; // una «foto» finta
const readVar = (file, name) => { const sandbox = {}; new Function('window', fs.readFileSync(path.join(tmp, 'js', file), 'utf8'))(sandbox); return sandbox[name]; };
const strip = (list) => list.map((p) => p.replace('images/prova/', ''));
const generate = () => { execFileSync(process.execPath, [path.join(tmp, 'watch_images.js'), '--once'], { cwd: tmp, stdio: 'pipe' }); return { data: strip(readVar('images-data.js', 'DYNAMIC_IMAGES')), order: strip(readVar('images-order.js', 'IMAGE_ORDER')) }; };
const orderFile = () => path.join(tmp, 'js', 'images-order.js');

try {
  fs.mkdirSync(path.join(tmp, 'js'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'watch_images.js'), path.join(tmp, 'watch_images.js'));
  fs.copyFileSync(path.join(ROOT, 'js', 'photo-order.js'), path.join(tmp, 'js', 'photo-order.js'));

  // a) primo giro, senza nessun ordine ricordato: ordine alfabetico
  ['B.jpg', 'D.jpg', 'F.jpg', 'foto [2].jpg'].forEach((n) => put(n));
  let r = generate();
  say(same(r.order, ['B.jpg', 'D.jpg', 'F.jpg', 'foto [2].jpg']), `senza ordine ricordato si parte in ordine alfabetico: ${show(r.order)}`);

  // b) foto nuove con nomi che verrebbero PRIMA e IN MEZZO: le vecchie non si muovono, le nuove vanno in fondo (alfabetico fra loro).
  //    L'elenco delle foto resta in ordine alfabetico, come prima: così un server locale vecchio, che non sa niente dell'ordine, scrive lo stesso file.
  ['A.jpg', 'E.jpg', 'C.jpg'].forEach((n) => put(n));
  r = generate();
  say(same(r.order, ['B.jpg', 'D.jpg', 'F.jpg', 'foto [2].jpg', 'A.jpg', 'C.jpg', 'E.jpg']), `foto nuove con nomi che vengono prima: le vecchie restano dove sono, le nuove vanno in fondo: ${show(r.order)}`);
  say(same(r.data, ['A.jpg', 'B.jpg', 'C.jpg', 'D.jpg', 'E.jpg', 'F.jpg', 'foto [2].jpg']), `l'elenco delle foto resta in ordine alfabetico: ${show(r.data)}`);
  say(same(PhotoOrder.arrange(r.data, r.order), r.order), `il sito, che parte dall'elenco alfabetico, mette le foto nello stesso ordine ricordato dal generatore`);

  // c) una foto tolta: sparisce, le altre restano nello stesso ordine
  fs.unlinkSync(path.join(folder, 'D.jpg'));
  r = generate();
  say(same(r.order, ['B.jpg', 'F.jpg', 'foto [2].jpg', 'A.jpg', 'C.jpg', 'E.jpg']), `una foto tolta: le altre restano nello stesso ordine: ${show(r.order)}`);

  // d) solo le maiuscole cambiano (sul Mac «F.jpg» e «f.jpg» sono lo stesso file): resta al suo posto, col nome vero del file
  fs.renameSync(path.join(folder, 'F.jpg'), path.join(folder, 'f.jpg'));
  r = generate();
  say(same(r.order, ['B.jpg', 'f.jpg', 'foto [2].jpg', 'A.jpg', 'C.jpg', 'E.jpg']), `maiuscole cambiate: la foto resta al suo posto, col nome vero del file: ${show(r.order)}`);

  // e) una foto nuova in un'ALTRA cartella (nell'elenco le cartelle sono tutte insieme): in fondo, senza muovere quelle di prima
  put('Z.jpg', path.join(tmp, 'images', 'altra'));
  r = generate();
  say(same(r.order, ['B.jpg', 'f.jpg', 'foto [2].jpg', 'A.jpg', 'C.jpg', 'E.jpg', 'images/altra/Z.jpg']), `una foto nuova in un'altra cartella va in fondo e non muove le altre: ${show(r.order)}`);
  fs.rmSync(path.join(tmp, 'images', 'altra'), { recursive: true, force: true });
  generate();

  // f) il file dell'ordine c'è ma non si legge (righe di conflitto, file a metà): non si riscrive (l'ordine ricordato non si perde), l'elenco delle foto sì
  const broken = '<<<<<<< HEAD\nwindow.IMAGE_ORDER = [\n=======\n>>>>>>> main\n';
  fs.writeFileSync(orderFile(), broken);
  put('G.jpg');
  execFileSync(process.execPath, [path.join(tmp, 'watch_images.js'), '--once'], { cwd: tmp, stdio: 'pipe' });
  say(fs.readFileSync(orderFile(), 'utf8') === broken, `file dell'ordine illeggibile: non viene riscritto`);
  say(readVar('images-data.js', 'DYNAMIC_IMAGES').some((p) => p.endsWith('/G.jpg')), `file dell'ordine illeggibile: l'elenco delle foto si aggiorna lo stesso`);
  fs.unlinkSync(path.join(folder, 'G.jpg'));

  // g) rigenerare senza cambiare niente non cambia niente (il file dell'ordine, già ricostruito, e quello delle foto)
  fs.unlinkSync(orderFile());
  generate();
  const before = ['images-data.js', 'images-order.js'].map((f) => fs.readFileSync(path.join(tmp, 'js', f), 'utf8'));
  generate();
  const after = ['images-data.js', 'images-order.js'].map((f) => fs.readFileSync(path.join(tmp, 'js', f), 'utf8'));
  say(before[0] === after[0] && before[1] === after[1], 'rigenerare senza cambiare niente lascia i due file identici');
} catch (e) {
  failures += 1;
  console.log(`ERRORE la prova non è riuscita: ${String(e.stack || e.message).split('\n').slice(0, 3).join(' | ')}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(failures ? `\nOrdine delle foto: ${failures} PROBLEMI` : '\nOrdine delle foto: tutto in regola');
process.exit(failures ? 1 : 0);
