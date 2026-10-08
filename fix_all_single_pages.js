const fs = require('fs');
const path = 'js/content.js';
let content = fs.readFileSync(path, 'utf8');

const updates = {
  "paper-tape": { "offset": "{ x: -100, y: 60 }", "caption": "rock" },
  "beach": { "offset": "{ x: -100, y: 60 }", "caption": "back" },
  "plastic": { "offset": "{ x: -111, y: 52 }", "caption": "horse" }, // Keeping -111, 52 since they explicitly verified it
  "hair": { "offset": "{ x: -100, y: 60 }", "caption": "dye" },
  "eating": { "offset": "{ x: -80, y: 60 }", "caption": "ivy" },
  "toy": { "offset": "{ x: -140, y: 60 }", "caption": "granade" },
  "whitening": { "offset": "{ x: -140, y: 60 }", "caption": "beyond" },
  "fluoxetine": { "offset": "{ x: -120, y: 40 }", "caption": "dinner" },
  "licking": { "offset": "{ x: -160, y: 60 }", "caption": "fun fair" }, // this is now 'bar', but maybe wait, let's map licking to bar
  "bar": { "offset": "{ x: -160, y: 60 }", "caption": "fun fair" },
  "compression": { "offset": "{ x: -60, y: 60 }" },
  "sofa": { "offset": "{ x: -140, y: 60 }", "caption": "sushi disco" }
};

for (const slug in updates) {
  const update = updates[slug];
  // Match only the first image in the project
  const slugRegex = new RegExp(`(slug:\\s*["']${slug}["'][\\s\\S]*?images:\\s*\\[\\s*\\{\\s*)([^}]+?)(\\s*\\})`);
  content = content.replace(slugRegex, (match, p1, inner, p3) => {
    let newInner = inner.replace(/,\s*offset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*captionOffset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*width:\s*["'][^"']+["']/g, '');
    newInner = newInner.replace(/,\s*height:\s*["'][^"']+["']/g, '');
    
    if (update.caption !== undefined) {
      newInner = newInner.replace(/caption:\s*["'][^"']*["']/, `caption: "${update.caption}"`);
    }
    
    if (update.offset) {
      newInner += `, offset: ${update.offset}`;
    }
    return p1 + newInner + p3;
  });
}

fs.writeFileSync(path, content);
console.log("Updated content.js fully!");
