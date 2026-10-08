const fs = require('fs');
let code = fs.readFileSync('js/content.js', 'utf8');

const singlePages = ['beach', 'toy', 'sofa', 'hair', 'eating', 'whitening', 'fluoxetine', 'licking', 'moon', 'plastic', 'Pile'];

for (const slug of singlePages) {
    // Empty the description
    const descRegex = new RegExp(`(slug:\\s*"${slug}"[\\s\\S]*?description:\\s*\\[)[^\\]]*(\\])`, 'g');
    code = code.replace(descRegex, '$1$2');

    // Apply specific layout ONLY to plastic
    if (slug === 'plastic') {
        const layoutString = `,
      width: "380px",
      height: "auto",
      offset: { x: -111, y: 52 },
      captionOffset: { x: 76, y: 0 }
    }`;
        const imgRegex = new RegExp(`(slug:\\s*"${slug}"[\\s\\S]*?images:\\s*\\[\\{\\s*caption:)[\\s\\S]*?(src:[^}]+?)(?:,\\s*width:[^}]+?)?\\}\\s*\\]`, 'g');
        code = code.replace(imgRegex, (match, group1, group2) => {
            return group1 + ' "horse", ' + group2 + layoutString + ']';
        });
    }
}

fs.writeFileSync('js/content.js', code);
