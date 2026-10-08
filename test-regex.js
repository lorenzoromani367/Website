const fs = require('fs');
let contentCode = fs.readFileSync('js/content.js', 'utf8');

const regex = /(const\s+ARCHIVE\s*=\s*\{[\s\S]*?title:\s*["']core archive["'][\s\S]*?description:\s*\[[\s\S]*?\]\s*,?)([\s\S]*?)(\};)/;

const match = contentCode.match(regex);
if (match) {
    console.log("MATCH 1 LENGTH:", match[1].length);
    console.log("MATCH 2 LENGTH:", match[2].length); // should be the images array
    console.log("MATCH 3 LENGTH:", match[3].length);
    console.log("SUCCESS!");
} else {
    console.log("FAIL!");
}
