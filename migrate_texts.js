const fs = require('fs');
const path = require('path');

const contentCode = fs.readFileSync('js/content.js', 'utf8');

// A helper to extract and remove descriptions
function extractAndRemoveDescriptions(code) {
  let newCode = code;
  
  // Regex to match description blocks: description: [ ... ]
  // We need to be careful with nested brackets.
  // Actually, we can use a small parser or just eval the whole thing if we mock window.
  
  return newCode;
}

// Let's just mock the environment, load the data, write to files, and then do a regex replace to clean up content.js
const sandbox = { window: {}, document: {}, LAYOUT: {} };
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(contentCode, sandbox);

const projects = sandbox.PROJECTS || [];
const archive = sandbox.ARCHIVE || {};

for (const p of projects) {
  if (p.description) {
    const text = p.description.join('\n');
    const filename = `testi/${p.slug}.txt`;
    fs.writeFileSync(filename, text);
    console.log(`Scritto ${filename}`);
  } else {
    fs.writeFileSync(`testi/${p.slug}.txt`, "");
  }
}

if (archive.description) {
  const text = archive.description.join('\n');
  fs.writeFileSync('testi/core_archive.txt', text);
  console.log(`Scritto testi/core_archive.txt`);
} else {
  fs.writeFileSync('testi/core_archive.txt', "");
}

// Now let's remove the descriptions from content.js using regex
let cleanCode = contentCode;
// We'll match `description: [\n ... \n    ],` and `description: [\n ... \n  ]`
cleanCode = cleanCode.replace(/description:\s*\[[\s\S]*?\],\n/g, '');
cleanCode = cleanCode.replace(/description:\s*\[[\s\S]*?\]\n/g, '\n');
// Also clean up any lingering description keys
cleanCode = cleanCode.replace(/description:\s*\[[\s\S]*?\]/g, '');

fs.writeFileSync('js/content.js', cleanCode);
console.log('Pulizia content.js completata.');
