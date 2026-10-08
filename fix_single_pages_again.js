const fs = require('fs');
const path = 'js/content.js';
let content = fs.readFileSync(path, 'utf8');

const captionsMap = {
  "paper-tape": "rock",
  "beach": "back",
  "plastic": "horse",
  "hair": "dye",
  "eating": "ivy",
  "toy": "granade",
  "whitening": "beyond",
  "fluoxetine": "dinner",
  "licking": "father",
  "moon": "embossing",
  "bar": "fun fair", // wait, bar has 2 images
  "sofa": "sushi disco",
  "pile": "cars"
};

// Loop through ALL projects in the string
const projectRegex = /\{\s*slug:\s*["']([^"']+)["'][\s\S]*?images:\s*\[([\s\S]*?)\]/g;
let match;
const projectsToUpdate = [];

while ((match = projectRegex.exec(content)) !== null) {
  const slug = match[1];
  const imagesInner = match[2];
  
  // Count how many objects '{' are in imagesInner
  const numImages = (imagesInner.match(/\{/g) || []).length;
  
  if (numImages === 1) {
    projectsToUpdate.push({ slug, imagesInner });
  }
}

console.log("Projects with 1 image:", projectsToUpdate.map(p => p.slug));

let newContent = content;

projectsToUpdate.forEach(proj => {
  const slug = proj.slug;
  const captionText = captionsMap[slug] || "";
  
  const slugBlockRegex = new RegExp(`(slug:\\s*["']${slug}["'][\\s\\S]*?images:\\s*\\[\\s*\\{)([\\s\\S]*?)(\\}\\s*\\])`);
  
  newContent = newContent.replace(slugBlockRegex, (match, p1, inner, p3) => {
    // Remove existing width, height, offset, captionOffset
    let newInner = inner.replace(/,\s*offset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*captionOffset:\s*\{[^}]+\}/g, '');
    newInner = newInner.replace(/,\s*width:\s*["'][^"']+["']/g, '');
    newInner = newInner.replace(/,\s*height:\s*["'][^"']+["']/g, '');
    
    // Update caption
    newInner = newInner.replace(/caption:\s*["'][^"']*["']/, `caption: "${captionText}"`);
    if (!newInner.includes('caption:')) {
      newInner = `caption: "${captionText}", ` + newInner;
    }
    
    // Add our fixed layout
    newInner += `, width: "380px", height: "auto", offset: { x: -111, y: 52 }`;
    
    return p1 + newInner + p3;
  });
});

fs.writeFileSync('js/content.js', newContent);
console.log("Updated content.js!");
