const fs = require('fs');
const path = 'js/content.js';
let content = fs.readFileSync(path, 'utf8');

const updates = {
  "paper-tape": { "offset": "{ x: -100, y: 60 }", "caption": "rock" },
  "beach": { "offset": "{ x: -100, y: 60 }", "caption": "back" },
  "plastic": { "offset": "{ x: -111, y: 52 }", "caption": "horse" },
  "hair": { "offset": "{ x: -100, y: 60 }", "caption": "dye" },
  "eating": { "offset": "{ x: -80, y: 60 }", "caption": "ivy" },
  "toy": { "offset": "{ x: -140, y: 60 }", "caption": "granade" },
  "whitening": { "offset": "{ x: -140, y: 60 }", "caption": "beyond" },
  "fluoxetine": { "offset": "{ x: -120, y: 40 }", "caption": "dinner" },
  "bar": { "offset": "{ x: -160, y: 60 }", "caption": "fun fair" },
  "compression": { "offset": "{ x: -60, y: 60 }" },
  "sofa": { "offset": "{ x: -140, y: 60 }", "caption": "sushi disco" }
};

for (const slug in updates) {
  const update = updates[slug];
  // Match the specific image line or block for this slug's first image
  // We can just match the SRC and then replace that image block
  
  let srcMatch;
  if (slug === 'paper-tape') srcMatch = 'images/paper-tape/rock.JPG';
  else if (slug === 'beach') srcMatch = 'images/beach/beach-1.jpg';
  else if (slug === 'plastic') srcMatch = 'images/plastic/plastic-1.jpg';
  else if (slug === 'hair') srcMatch = 'images/hair/hair-1.jpg';
  else if (slug === 'eating') srcMatch = 'images/eating/dreams.jpg';
  else if (slug === 'toy') srcMatch = 'images/toy/toy-1.jpg';
  else if (slug === 'whitening') srcMatch = 'images/whitening/whitening-1.jpg';
  else if (slug === 'fluoxetine') srcMatch = 'images/fluoxetine/dinner.JPG';
  else if (slug === 'bar') srcMatch = 'images/bar/bar-1.jpg';
  else if (slug === 'compression') srcMatch = 'images/compression/compression-1.jpg';
  else if (slug === 'sofa') srcMatch = 'images/sofa/sushi discotheque.jpg';

  if (!srcMatch) continue;

  const regex = new RegExp(`(\\{\\s*caption:\\s*["'][^"']*["']\\s*,\\s*src:\\s*["']${srcMatch}["'])([\\s\\S]*?)(\\s*\\})`);
  
  content = content.replace(regex, (match, p1, inner, p3) => {
    // p1 has caption and src.
    if (update.caption !== undefined) {
      p1 = p1.replace(/caption:\s*["'][^"']*["']/, `caption: "${update.caption}"`);
    }
    
    // return just p1 + the new offset + p3
    return p1 + `, offset: ${update.offset}` + p3;
  });
}

fs.writeFileSync(path, content);
console.log("Safe update complete.");
