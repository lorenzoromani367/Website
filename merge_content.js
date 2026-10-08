const fs = require('fs');
const oldContent = fs.readFileSync('/Users/lorenzoromani/Library/Application Support/Code/User/History/-6739207a/1WOt.js', 'utf8');
const newContent = fs.readFileSync('js/content.js', 'utf8');

const oldProjectsMatch = oldContent.match(/const PROJECTS = \[\s*([\s\S]*?)\n\];/);
const newProjectsMatch = newContent.match(/const PROJECTS = \[\s*([\s\S]*?)\n\];/);

if (oldProjectsMatch && newProjectsMatch) {
    const merged = newContent.replace(newProjectsMatch[0], oldProjectsMatch[0]);
    fs.writeFileSync('js/content.js', merged);
    console.log("Merged PROJECTS successfully");
} else {
    console.log("Failed to match");
}
