const fs = require('fs');
let text = fs.readFileSync('js/content.js', 'utf8');

// Rename lines to boudaries
text = text.replace(/slug:\s*"lines"/, 'slug: "boudaries"');
text = text.replace(/name:\s*"Lines"/, 'name: "Boudaries"');
// Wait, the images inside boudaries are already 'images/boudaries/', but what if there's any left?
text = text.replace(/images\/lines\//g, 'images/boudaries/');

// Rename stasis to sospension
text = text.replace(/slug:\s*"stasis"/, 'slug: "sospension"');
text = text.replace(/name:\s*"Stasis"/, 'name: "Sospension"');
text = text.replace(/images\/stasis\//g, 'images/sospension/');

// Wait, where did I append `homes`? I appended it right after `lines/boudaries`.
// And what about `Pile`?
// Pile was added at the bottom.
if (text.indexOf('slug: "pile"') === -1 && text.indexOf('slug: "Pile"') === -1) {
    text = text.replace(/];\n\n\/\/ Link del footer/, `  {
    slug: "pile",
    name: "Pile",
    description: [],
    images: [{ caption: "", src: "images/pile/cars.JPG" }],
  },\n];\n\n// Link del footer`);
}

fs.writeFileSync('js/content.js', text);
