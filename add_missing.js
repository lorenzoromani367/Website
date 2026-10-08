const fs = require('fs');
let code = fs.readFileSync('js/content.js', 'utf8');

if (!code.includes('slug: "pile"')) {
  code = code.replace(/];\s*const ARCHIVE/, `,
  {
    slug: "pile",
    name: "Pile",
    description: [],
    images: []
  }
];

const ARCHIVE`);
}

if (!code.includes('slug: "homes"')) {
  code = code.replace(/];\s*const ARCHIVE/, `,
  {
    slug: "homes",
    name: "Homes",
    description: [],
    images: []
  }
];

const ARCHIVE`);
}

fs.writeFileSync('js/content.js', code);
