const fs = require('fs');
let code = fs.readFileSync('js/app_v58.js', 'utf8');

// Update signature
code = code.replace(
  /function makeResizable\(node, key, defaults = \{\}, \{ lockRatioTo, onResizeEnd, alwaysVisible \} = \{\}\) \{/,
  'function makeResizable(node, key, defaults = {}, { lockRatioTo, onResizeEnd, alwaysVisible, src, propType = "size" } = {}) {'
);

// Update right handle (onPointerUp)
code = code.replace(
  /saveSizeOverride\(key, \{ width: node\.style\.width \}\);/,
  `saveSizeOverride(key, { width: node.style.width, height: node.style.height });
      if (src && propType === "size") {
        fetch('http://localhost:8000/api/save-image-props', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src, props: { width: node.style.width, height: node.style.height } })
        }).catch(e => console.error("Auto-save failed", e));
      }`
);

// Update bottom handle (onPointerUp)
code = code.replace(
  /saveSizeOverride\(key, \{ height: node\.style\.height \}\);/,
  `saveSizeOverride(key, { width: node.style.width, height: node.style.height });
    if (src && propType === "size") {
      fetch('http://localhost:8000/api/save-image-props', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, props: { width: node.style.width, height: node.style.height } })
      }).catch(e => console.error("Auto-save failed", e));
    }`
);

// Update corner handle (onPointerUp)
code = code.replace(
  /saveSizeOverride\(activeKey, \{ width: \`\$\{newMaxW\}px\`, height: \`\$\{newMaxH\}px\` \}\);/,
  `saveSizeOverride(activeKey, { width: \`\$\{newMaxW\}px\`, height: \`\$\{newMaxH\}px\` });
      if (src && propType === "size") {
        fetch('http://localhost:8000/api/save-image-props', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ src, props: { width: \`\$\{newMaxW\}px\`, height: \`\$\{newMaxH\}px\` } })
        }).catch(e => console.error("Auto-save failed", e));
      }`
);

fs.writeFileSync('js/app_v58.js', code);
console.log("Patched makeResizable in app_v58.js!");
