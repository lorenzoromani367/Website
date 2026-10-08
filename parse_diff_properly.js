const fs = require('fs');

const lines = fs.readFileSync('/Users/lorenzoromani/.gemini/antigravity-ide/brain/e161f08c-a861-43af-8254-de19e3a1f774/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.type === 'RUN_COMMAND' && step.content && step.content.includes('diff --git a/js/content.js b/js/content.js')) {
      // Just dump the entire string to a file, they will overwrite each other but the last one is probably what we want.
      // Wait, there might be multiple RUN_COMMANDs. Let's save them all.
      fs.writeFileSync(`full_diff_${i}.txt`, step.content);
      console.log(`Saved full_diff_${i}.txt with length ${step.content.length}`);
    }
  } catch (e) {}
}
