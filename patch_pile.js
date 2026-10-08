const fs = require('fs');
let content = fs.readFileSync('js/content.js', 'utf8');

content = content.replace(
  /(slug:\s*["']pile["'][\s\S]*?images:\s*\[\s*\{\s*caption:\s*["'][^"']*["'],\s*src:\s*["'][^"']+["']\s*,\s*width:\s*["'][^"']+["'],\s*height:\s*["'][^"']+["'],)\s*offset:\s*\{\s*x:\s*-?\d+,\s*y:\s*-?\d+\s*\}/,
  `$1 align: "left", offset: { x: 10, y: 52 }`
);

fs.writeFileSync('js/content.js', content);
console.log("Patched pile!");
