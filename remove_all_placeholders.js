const fs = require('fs');
let content = fs.readFileSync('js/content.js', 'utf8');

// Replace all descriptions that start with "Descrizione da definire" with empty arrays
content = content.replace(/description:\s*\[\s*["'`]Descrizione da definire[^\]]*["'`]\s*\]/g, 'description: []');

fs.writeFileSync('js/content.js', content);
console.log("Removed all placeholder descriptions!");
