const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const renameEndpoint = `
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
        const slugPattern = new RegExp('slug:\\s*["\\']' + slug + '["\\']');
        const match = codeContent.match(slugPattern);
        
        if (match) {
            let startIdx = match.index;
            let endIdx = codeContent.indexOf('images:', startIdx); // Just look forward until images or next project
            if (endIdx === -1) endIdx = startIdx + 500;
            
            let chunk = codeContent.substring(startIdx, endIdx);
            chunk = chunk.replace(/name:\\s*["\\'][^"\\']+["\\']/, \`name: "\${newName}"\`);
            
            codeContent = codeContent.substring(0, startIdx) + chunk + codeContent.substring(endIdx);
            fs.writeFileSync(contentPath, codeContent);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("Errore rinomina progetto:", err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }
`;

code = code.replace("  // 1.5 Endpoint per il salvataggio automatico delle proprietà delle immagini", renameEndpoint + "\n  // 1.5 Endpoint per il salvataggio automatico delle proprietà delle immagini");
fs.writeFileSync('server.js', code);
