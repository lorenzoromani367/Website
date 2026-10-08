const fs = require('fs');
let code = fs.readFileSync('js/content.js', 'utf8');
const lines = code.split('\n');

const targetSrc = 'images/lines/1 wire.JPG';
const updates = { zoomBox: { width: '500px', height: '400px' } };

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(`src: "${targetSrc}"`)) {
    // This is the line. It looks like:
    // { caption: "wire", src: "images/lines/1 wire.JPG", width: "540px", height: "361px", captionOffset: { x: 60, y: 0 }, mobile: { width: "280px", height: "393px" } },
    
    // We can use regex to replace or insert zoomBox
    let line = lines[i];
    
    // Remove existing zoomBox if present
    line = line.replace(/,\s*zoomBox:\s*\{[^}]+\}/, '');
    
    // Insert new zoomBox before the closing }
    const zoomBoxStr = `, zoomBox: { width: "${updates.zoomBox.width}", height: "${updates.zoomBox.height}" }`;
    
    // Assuming the line ends with } or },
    line = line.replace(/\}(\s*,)?$/, `${zoomBoxStr} }$1`);
    
    lines[i] = line;
    break;
  }
}

console.log(lines.find(l => l.includes(targetSrc)));
