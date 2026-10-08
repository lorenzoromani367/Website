const fs = require('fs');
let code = fs.readFileSync('js/app_v58.js', 'utf8');

// For caption position:
code = code.replace(
  /const captionMove = makeMovableFree\(\n\s*figcaption,\n\s*\`\$\{sizeKeyPrefix\}\.captionPos\.\$\{origIndex\}\`,\n\s*"Trascina per spostare la didascalia",\n\s*\{/g,
  `const captionMove = makeMovableFree(
      figcaption,
      \`\$\{sizeKeyPrefix\}.captionPos.\$\{origIndex\}\`,
      "Trascina per spostare la didascalia",
      {
        src: image.src,
        propType: "captionOffset",`
);

// For image frame resizing:
code = code.replace(
  /makeResizable\(\n\s*frame,\n\s*\`\$\{sizeKeyPrefix\}\.image\.\$\{origIndex\}\`,/g,
  `makeResizable(
        frame,
        \`\$\{sizeKeyPrefix\}.image.\$\{origIndex\}\`,`
);
// Wait, replacing line by line is safer. Let's just find the options object of makeResizable for frame.
code = code.replace(
  /\{\n\s*lockRatioTo: img,\n\s*onResizeEnd: \(\) => \{\n\s*clearPositionOverride/g,
  `{
          src: image.src,
          propType: "size",
          lockRatioTo: img,
          onResizeEnd: () => {
            clearPositionOverride`
);

// For image frame moving:
code = code.replace(
  /makeMovableFree\(frame, \`\$\{sizeKeyPrefix\}\.\$\{images\.length === 1 \? 'singleImagePos' : 'imagePos'\}\.\$\{origIndex\}\`, "Trascina per spostare la foto", \{/g,
  `makeMovableFree(frame, \`\$\{sizeKeyPrefix\}.\$\{images.length === 1 ? 'singleImagePos' : 'imagePos'\}.\$\{origIndex\}\`, "Trascina per spostare la foto", {
      src: image.src,
      propType: "offset",`
);

fs.writeFileSync('js/app_v58.js', code);
console.log("Patched renderGallery calls!");
