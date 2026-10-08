const fs = require('fs');
let contentJs = fs.readFileSync('js/content.js', 'utf8');
const homesObject = fs.readFileSync('cleaned_homes.txt', 'utf8').trim();

// Add homes after boudaries
contentJs = contentJs.replace(/(slug:\s*"boudaries"[\s\S]*?\],[\s\S]*?\},)/, `$1\n  ${homesObject},`);

fs.writeFileSync('js/content.js', contentJs);
console.log("Added homes!");
