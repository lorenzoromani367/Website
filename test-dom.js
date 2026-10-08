const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const contentJs = fs.readFileSync('js/content.js', 'utf8');
const appJs = fs.readFileSync('js/app_v58.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost:8000/" });

try {
  dom.window.eval(contentJs);
  dom.window.eval(appJs);
  console.log("Edit buttons:", dom.window.document.querySelectorAll('.edit-toggle').length);
  console.log("App content:", !!dom.window.document.getElementById('app').innerHTML);
} catch (e) {
  console.error("DOM ERROR:", e.message);
}
