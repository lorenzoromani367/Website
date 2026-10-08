const fs = require('fs');
let code = fs.readFileSync('js/content.js', 'utf8');

const singlePages = ['beach', 'toy', 'sofa', 'hair', 'eating', 'whitening', 'fluoxetine', 'licking', 'moon', 'plastic'];

const layoutString = `,
      width: "380px",
      height: "auto",
      offset: { x: -111, y: 52 },
      captionOffset: { x: 76, y: 0 }
    }`;

for (const slug of singlePages) {
    const regex = new RegExp(`(slug:\\s*"${slug}"[\\s\\S]*?images:\\s*\\[\\{\\s*caption:[\\s\\S]*?src:[^}]+?)(?:,\\s*width:[^}]+?)?\\}\\s*\\]`, 'g');
    
    code = code.replace(regex, (match, group1) => {
        // Rimuoviamo eventuali width, height, offset, captionOffset già presenti nel match
        let cleanGroup1 = group1.replace(/,\s*(width|height|offset|captionOffset)\s*:[^,]+(,|(?=\s*\}))/g, '');
        if (slug === 'plastic' && !cleanGroup1.includes('caption: "horse"')) {
            cleanGroup1 = cleanGroup1.replace(/caption:\s*""/, 'caption: "horse"');
        }
        return cleanGroup1 + layoutString + ']';
    });
}

fs.writeFileSync('js/content.js', code);
