const fs = require('fs');

const path = 'js/content.js';
let content = fs.readFileSync(path, 'utf8');

function updateFirstImage(slug, offsetStr, captionStr) {
  const slugRegex = new RegExp(`(slug:\\s*["']${slug}["'][\\s\\S]*?images:\\s*\\[\\s*\\{\\s*)([^}]+?)(\\s*\\})`);
  content = content.replace(slugRegex, (match, p1, inner, p3) => {
    // strip offset, width, height, caption
    let newInner = inner.replace(/,\s*offset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*captionOffset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*width:\s*["'][^"']+["']/g, '');
    newInner = newInner.replace(/,\s*height:\s*["'][^"']+["']/g, '');
    if (captionStr !== undefined) {
      newInner = newInner.replace(/caption:\s*["'][^"']*["']/, `caption: "${captionStr}"`);
    }
    
    if (offsetStr) {
      newInner += `, offset: ${offsetStr}`;
    }
    return p1 + newInner + p3;
  });
}

updateFirstImage('compression', '{ x: -80, y: 60 }', undefined);
updateFirstImage('sofa', '{ x: -120, y: 60 }', 'sushi disco');
updateFirstImage('Pile', '{ x: -120, y: 60 }', 'cars');

fs.writeFileSync(path, content);
