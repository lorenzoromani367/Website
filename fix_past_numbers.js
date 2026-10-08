const fs = require('fs');

const path = 'js/content.js';
let content = fs.readFileSync(path, 'utf8');

// The requested numbers from past chat (step 1612 to 1861):
const updates = {
  beach: { offset: '{ x: -100, y: 60 }', caption: 'back' },
  fluoxetine: { offset: '{ x: -100, y: 60 }', caption: 'dinner' },
  bar: { offset: '{ x: -140, y: 60 }', caption: 'fun fair' }, // bar was previously licking
  compression: { offset: '{ x: -80, y: 60 }' },
  sofa: { offset: '{ x: -120, y: 60 }', caption: 'sushi disco' },
  Pile: { offset: '{ x: -120, y: 60 }', caption: 'cars' },
  plastic: { offset: '{ x: -111, y: 52 }', caption: 'horse' } // keeping plastic as was recently requested
};

for (const slug in updates) {
  const update = updates[slug];
  
  // Find the block for this slug
  const slugRegex = new RegExp(`(slug:\\s*["']${slug}["'][\\s\\S]*?images:\\s*\\[\\{)([^}]+)(\\}\\])`, 'g');
  content = content.replace(slugRegex, (match, p1, inner, p3) => {
    // 1. Remove any existing offset or captionOffset or width or height
    let newInner = inner.replace(/,\s*offset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*captionOffset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*width:\s*["'][^"']+["']/g, '');
    newInner = newInner.replace(/,\s*height:\s*["'][^"']+["']/g, '');
    
    // 2. Add the offset
    if (update.offset) {
      newInner += `, offset: ${update.offset}`;
    }
    
    // 3. Update caption if requested
    if (update.caption !== undefined) {
      newInner = newInner.replace(/caption:\s*["'][^"']*["']/, `caption: "${update.caption}"`);
    }
    
    return p1 + newInner + p3;
  });
}

fs.writeFileSync(path, content);
console.log("Updated content.js");
