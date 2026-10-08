const fs = require('fs');

const lines = fs.readFileSync('/Users/lorenzoromani/.gemini/antigravity-ide/brain/e161f08c-a861-43af-8254-de19e3a1f774/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.type === 'VIEW_FILE' && step.content && step.content.includes('1 wire.JPG')) {
      const content = step.content;
      // Extract the lines project
      const match = content.match(/slug: \\"lines\\"[\\s\\S]*?images: \\[(\\n(?:.*?\\n)*?)\\s*\\],/);
      if (match) {
        fs.writeFileSync('extracted_lines_images.txt', match[1]);
        console.log("Found lines images!");
        break; // take the latest one
      }
    }
  } catch(e) {}
}
