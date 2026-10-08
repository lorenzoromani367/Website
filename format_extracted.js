const fs = require('fs');
const lines = fs.readFileSync('extracted_lines.txt', 'utf8').split('\n');

let cleaned = lines.map(line => {
  // Remove the line number prefix like "122: "
  return line.replace(/^\d+:\s*/, '');
}).join('\n');

// Replace images/lines/ with images/boudaries/
cleaned = cleaned.replace(/images\/lines\//g, 'images/boudaries/');

fs.writeFileSync('cleaned_boudaries.txt', cleaned);
