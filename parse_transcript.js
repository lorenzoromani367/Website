const fs = require('fs');

const path = '/Users/lorenzoromani/.gemini/antigravity-ide/brain/e161f08c-a861-43af-8254-de19e3a1f774/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');

const updates = {};

lines.forEach(line => {
  if (!line.trim()) return;
  const obj = JSON.parse(line);
  if (obj.type === 'USER_INPUT' && obj.content) {
    const text = obj.content;
    const projectMatch = text.match(/# project\.([^.]+)\.singleImagePos\.0\s*(\{ x: -?\d+, y: -?\d+ \})/g);
    if (projectMatch) {
      projectMatch.forEach(m => {
        const parts = m.match(/# project\.([^.]+)\.singleImagePos\.0\s*(\{ x: -?\d+, y: -?\d+ \})/);
        if (parts) {
          const slug = parts[1];
          const pos = parts[2];
          if (!updates[slug]) updates[slug] = {};
          updates[slug].offset = pos;
        }
      });
    }
    
    // Also parse caption
    const captionMatches = text.match(/# Progetto "([^"]+)", foto #1\s+→\s+aggiorna "caption" su quella voce di "images"\s*caption: "([^"]*)"/g);
    if (captionMatches) {
      captionMatches.forEach(m => {
        const parts = m.match(/# Progetto "([^"]+)", foto #1\s+→\s+aggiorna "caption" su quella voce di "images"\s*caption: "([^"]*)"/);
        if (parts) {
          const slug = parts[1];
          const cap = parts[2];
          if (!updates[slug]) updates[slug] = {};
          updates[slug].caption = cap;
        }
      });
    }
  }
});

console.log(JSON.stringify(updates, null, 2));
