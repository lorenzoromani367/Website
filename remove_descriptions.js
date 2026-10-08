const fs = require('fs');
let content = fs.readFileSync('js/content.js', 'utf8');

const singlePages = [
  'paper-tape', 'beach', 'plastic', 'hair', 'eating', 'toy', 
  'whitening', 'fluoxetine', 'licking', 'moon', 'sofa', 'pile'
];

singlePages.forEach(slug => {
  const regex = new RegExp(`(slug:\\s*["']${slug}["'][\\s\\S]*?description:\\s*\\[)([^\\]]*)(\\])`);
  content = content.replace(regex, `$1$3`);
});

fs.writeFileSync('js/content.js', content);
console.log("Removed descriptions!");
