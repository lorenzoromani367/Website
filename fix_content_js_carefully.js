const fs = require('fs');

let content = fs.readFileSync('js/content.js', 'utf8');

const boudariesImagesStr = fs.readFileSync('cleaned_boudaries.txt', 'utf8').trim();
const homesStr = fs.readFileSync('cleaned_homes.txt', 'utf8').trim();

// Find the index of `slug: "boudaries"`
let bIndex = content.indexOf('slug: "boudaries"');
if (bIndex === -1) bIndex = content.indexOf('slug: "lines"');

// Find the images array of boudaries
let imagesStart = content.indexOf('images: [', bIndex);
let imagesEnd = content.indexOf('    ],', imagesStart) + 6;

// Replace boudaries images array
let newContent = content.substring(0, imagesStart) + boudariesImagesStr + content.substring(imagesEnd);

// Now, insert homes after boudaries project object ends
let bEnd = newContent.indexOf('  },', imagesStart) + 4;
newContent = newContent.substring(0, bEnd) + '\n  ' + homesStr + ',' + newContent.substring(bEnd);

fs.writeFileSync('js/content.js', newContent);
console.log("Updated carefully!");
