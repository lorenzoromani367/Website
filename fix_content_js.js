const fs = require('fs');

let contentJs = fs.readFileSync('js/content.js', 'utf8');
const boudariesImages = fs.readFileSync('cleaned_boudaries.txt', 'utf8').trim();
const homesObject = fs.readFileSync('cleaned_homes.txt', 'utf8').trim();

// Fix boudaries
contentJs = contentJs.replace(/slug:\s*"boudaries",[\s\S]*?images:\s*\[[\s\S]*?\],/, (match) => {
    return match.replace(/images:\s*\[[\s\S]*?\],/, boudariesImages + ",");
});

// Fix homes
contentJs = contentJs.replace(/\{\s*slug:\s*"homes"[\s\S]*?images:\s*\[\]\s*\},/, homesObject + ",");

fs.writeFileSync('js/content.js', contentJs);
console.log("Updated content.js!");
