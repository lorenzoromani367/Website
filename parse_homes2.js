const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test.json', 'utf8'));
const content = data.content;
const matchLines = content.match(/151:   \{\n152:     slug: "homes",\n(?:.*?\n)*?168:   \},/);
if (matchLines) {
  let cleaned = matchLines[0].split('\n').map(l => l.replace(/^\d+:\s*/, '')).join('\n');
  cleaned = cleaned.replace(/images\/home\//g, 'images/homes/');
  fs.writeFileSync('cleaned_homes.txt', cleaned);
  console.log("Extracted homes!");
} else {
  console.log("No match found for homes");
}
