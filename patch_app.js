const fs = require('fs');
let content = fs.readFileSync('js/app_v58.js', 'utf8');

content = content.replace(
  /return el\("figure", \{ class: "photo", "data-index": i \}, \[frame\]\);/,
  `const figureAttrs = { class: "photo", "data-index": i };
    if (image.align === "left") {
      figureAttrs.style = "text-align: left;";
    }
    return el("figure", figureAttrs, [frame]);`
);

fs.writeFileSync('js/app_v58.js', content);
console.log("Patched app_v58.js!");
