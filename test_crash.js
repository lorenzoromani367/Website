const fs = require('fs');

global.window = {};
global.document = {
  createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {} }, appendChild: () => {}, setAttribute: () => {} }),
  getElementById: () => ({ innerHTML: '', style: {}, classList: { add: () => {}, remove: () => {} } }),
  querySelector: () => ({ style: {}, classList: { add: () => {}, remove: () => {} } })
};
global.navigator = { userAgent: 'Mozilla' };

// Load the necessary data
eval(fs.readFileSync('js/images-data.js', 'utf8'));
eval(fs.readFileSync('js/content.js', 'utf8'));

// Now mock the minimal parts of app_v58 to see if it crashes
const appCode = fs.readFileSync('js/app_v58.js', 'utf8');

// We just want to see if mergeDynamicImages crashes or if we can find the issue
console.log("PROJECTS lines images BEFORE:", PROJECTS.find(p => p.slug === 'lines').images.map(img => img.src));

// Extract the mergeDynamicImages function
const match = appCode.match(/\(function mergeDynamicImages\(\) \{[\s\S]*?\}\)\(\);/);
if (match) {
  eval(match[0]);
  console.log("PROJECTS lines images AFTER:", PROJECTS.find(p => p.slug === 'lines').images.map(img => img.src));
}
