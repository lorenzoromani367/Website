const fs = require('fs');
let content = fs.readFileSync('js/content.js', 'utf8');

const singlePages = [
  'paper-tape', 'beach', 'plastic', 'hair', 'eating', 
  'toy', 'whitening', 'fluoxetine', 'licking', 'moon', 'sofa'
];

singlePages.forEach(slug => {
  const regex = new RegExp(`(slug:\\s*["']${slug}["'][\\s\\S]*?images:\\s*\\[\\s*\\{[^}]+?)(offset:\\s*\\{\\s*x:\\s*-?\\d+,\\s*y:\\s*\\d+\\s*\\})`);
  content = content.replace(regex, (match, p1) => {
    // We already have width: "380px" and height: "auto" in these blocks.
    // If align: "left" is already there, we just replace offset.
    // Otherwise we add align: "left".
    let newP1 = p1;
    if (!newP1.includes('align:')) {
      newP1 = newP1.replace(/(width:\s*["'][^"']+["'],\s*height:\s*["'][^"']+["'],\s*)/, '$1align: "left", ');
    }
    return newP1 + 'offset: { x: 0, y: 52 }';
  });
});

fs.writeFileSync('js/content.js', content);
console.log("Applied align: left and offset.x = 0 to all single pages!");
