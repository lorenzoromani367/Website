const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // Configurazione base CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Endpoint per il salvataggio dei testi in content.js
  if (req.method === 'POST' && req.url === '/api/save-content') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { slug, text } = data;
        
        const textArray = Array.isArray(text) ? text : text.split('\n');
        const rawText = textArray.join('\n');
        
        let filename = slug === 'core archive' ? 'core_archive.txt' : `${slug}.txt`;
        const txtPath = path.join(__dirname, 'testi', filename);
        
        fs.writeFileSync(txtPath, rawText);
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour12: false });
        console.log(`[OK] ${filename} aggiornato su disco alle ${timeString}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: timeString }));
      } catch (err) {
        console.error("Errore salvataggio:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }


  // Endpoint per rinominare i progetti
  if (req.method === 'POST' && req.url === '/api/rename-project') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { slug, newName } = JSON.parse(body);
        const contentPath = path.join(__dirname, 'js', 'content.js');
        let codeContent = fs.readFileSync(contentPath, 'utf8');

        // Find the project object with the given slug
        const slugPattern = new RegExp('slug:\s*["\']' + slug + '["\']');
        const match = codeContent.match(slugPattern);
        
        if (match) {
            let startIdx = match.index;
            let endIdx = codeContent.indexOf('images:', startIdx); // Just look forward until images or next project
            if (endIdx === -1) endIdx = startIdx + 500;
            
            let chunk = codeContent.substring(startIdx, endIdx);
            chunk = chunk.replace(/name:\s*["\'][^"\']+["\']/, `name: "${newName}"`);
            
            codeContent = codeContent.substring(0, startIdx) + chunk + codeContent.substring(endIdx);
            fs.writeFileSync(contentPath, codeContent);
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour12: false });
        console.log(`[OK] content.js aggiornato su disco alle ${timeString}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: timeString }));
      } catch (err) {
        console.error("Errore rinomina progetto:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 1.5 Endpoint per il salvataggio automatico delle proprietà delle immagini (es. zoomBox, width, offset)
  if (req.method === 'POST' && req.url === '/api/save-image-props') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { src, props } = JSON.parse(body);
        const contentPath = path.join(__dirname, 'js', 'content.js');
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
                
                let additions = [];
                if (props.zoomBox) {
                    let zbStr = `zoomBox: { width: "${props.zoomBox.width}", height: "${props.zoomBox.height}"`;
                    if (props.zoomBox.offset) zbStr += `, offset: { x: ${Math.round(props.zoomBox.offset.x)}, y: ${Math.round(props.zoomBox.offset.y)} }`;
                    zbStr += ` }`;
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
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour12: false });
        
        if (props.zoomBox && props.zoomBox.width) {
            const fileName = src.split('/').pop();
            console.log(`[OK] Zoom foto ${fileName} aggiornato a ${props.zoomBox.width} su disco`);
        } else {
            console.log(`[OK] content.js aggiornato su disco alle ${timeString}`);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, timestamp: timeString }));
      } catch (err) {
        console.error("Errore salvataggio image props:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 1.6 Endpoint per il salvataggio completo della struttura a pagine dell'archivio (ARCHIVE.pages)
  if (req.method === 'POST' && req.url === '/api/save-archive-pages') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { pages } = JSON.parse(body);
        const contentPath = path.join(__dirname, 'js', 'content.js');
        let contentCode = fs.readFileSync(contentPath, 'utf8');

        // Crea una rappresentazione testuale formattata dell'array pages
        const pagesString = JSON.stringify(pages, null, 4).replace(/^/gm, '  ');
        
        // Trova l'oggetto ARCHIVE e sostituisci il blocco pages (o immagini, se non ha pages)
        // Siccome l'ARCHIVE è alla fine, usiamo una regex che catturi l'intero blocco ARCHIVE
        const regex = /(const\s+ARCHIVE\s*=\s*\{[\s\S]*?title:\s*["']core archive["'][\s\S]*?description:\s*\[[\s\S]*?\]\s*,?)([\s\S]*?)(\};)/;
        
        if (regex.test(contentCode)) {
           // Rimpiazziamo il contenuto (images o pages preesistenti) con il nuovo pages
           contentCode = contentCode.replace(regex, `$1\n  pages: ${pagesString.trim()}\n$3`);
           fs.writeFileSync(contentPath, contentCode);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour12: false });
        console.log(`[OK] content.js aggiornato su disco alle ${timeString}`);
        
        res.end(JSON.stringify({ success: true, timestamp: timeString }));
      } catch (err) {
        console.error("Errore salvataggio archive pages:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 2. File statici
  let filePath = path.join(__dirname, decodeURIComponent(req.url === '/' ? 'index.html' : req.url.split('?')[0]));
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end("404 Not Found", 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
      }
    } else {
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
  console.log('Premi Ctrl+C per fermare il server.');
});
