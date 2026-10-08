const fs = require('fs');

const lines = fs.readFileSync('/Users/lorenzoromani/.gemini/antigravity-ide/brain/e161f08c-a861-43af-8254-de19e3a1f774/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const step = JSON.parse(lines[i]);
    if (step.type === 'RUN_COMMAND' && step.content && step.content.includes('git diff js/content.js')) {
      // no wait, the command is in the PLANNER_RESPONSE args
    }
    
    // The RUN_COMMAND output contains the actual diff
    if (step.type === 'RUN_COMMAND' && step.content && step.content.includes('diff --git a/js/content.js b/js/content.js')) {
      const match = step.content.match(/diff --git[\s\S]+/);
      if (match) {
        fs.writeFileSync('my_recovery.patch', match[0]);
        console.log('Saved patch to my_recovery.patch');
      }
    }
  } catch (e) {}
}
