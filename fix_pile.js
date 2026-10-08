const fs = require('fs');
let code = fs.readFileSync('js/content.js', 'utf8');

const slug = 'Pile';
const layoutString = `,
      width: "380px",
      height: "auto",
      offset: { x: -111, y: 52 },
      captionOffset: { x: 76, y: 0 }
    }`;

const regex = new RegExp(`(slug:\\s*"${slug}"[\\s\\S]*?images:\\s*\\[\\{\\s*caption:[\\s\\S]*?src:[^}]+?)(?:,\\s*width:[^}]+?)?\\}\\s*\\]`, 'g');

code = code.replace(regex, (match, group1) => {
    let cleanGroup1 = group1.replace(/,\s*(width|height|offset|captionOffset)\s*:[^,]+(,|(?=\s*\}))/g, '');
    return cleanGroup1 + layoutString + ']';
});

fs.writeFileSync('js/content.js', code);
