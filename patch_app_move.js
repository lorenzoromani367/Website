const fs = require('fs');
let code = fs.readFileSync('js/app_v58.js', 'utf8');

// Update signature
code = code.replace(
  /function makeMovableFree\(node, key, title = "Trascina per spostare", \{ onMove, defaultOffset, dualHandles, alwaysVisible, lockAxis, dragOnNode \} = \{\}\) \{/,
  'function makeMovableFree(node, key, title = "Trascina per spostare", { onMove, defaultOffset, dualHandles, alwaysVisible, lockAxis, dragOnNode, src, propType } = {}) {'
);

// Update onPointerUp
code = code.replace(
  /savePositionOverride\(key, pos\);/,
  `savePositionOverride(key, pos);
      if (src && propType) {
        const props = {};
        props[propType] = pos;
        fetch('http://localhost:8000/api/save-image-props', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src, props })
        }).catch(e => console.error("Auto-save failed", e));
      }`
);

fs.writeFileSync('js/app_v58.js', code);
console.log("Patched makeMovableFree in app_v58.js!");
