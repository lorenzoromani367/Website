const fs = require('fs');

const lines = fs.readFileSync('/Users/lorenzoromani/.gemini/antigravity-ide/brain/e161f08c-a861-43af-8254-de19e3a1f774/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.type === 'VIEW_FILE' && step.content && step.content.includes('slug: "plastic"')) {
      const match = step.content.match(/slug:\s*"plastic"[\s\S]*?\}/);
      if (match) {
        console.log("Found in step " + i + ":\n" + match[0]);
      }
    }
  } catch(e) {}
}
