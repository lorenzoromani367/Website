const fs = require('fs');
let code = fs.readFileSync('js/content.js', 'utf8');

code = code.replace(/slug: "tower",\s*name: "Tower",\s*\},/, `slug: "tower",
    name: "Tower",
    images: [
      { caption: "repetition", src: "images/tower/tower-1.jpg", width: "380px", height: "auto", align: "left", offset: { x: 0, y: 52 } },
      { caption: "repetition", src: "images/tower/tower-2.jpg" }
    ],
  },`);

code = code.replace(/slug: "licking",\s*name: "Licking",\s*\},/, `slug: "licking",
    name: "Licking",
    images: [{ caption: "father", src: "images/licking/licking-1.jpg" }],
  },`);

code = code.replace(/slug: "moon",\s*name: "Moon",\s*\},/, `slug: "moon",
    name: "Moon",
    images: [{ caption: "embossing", src: "images/moon/moon-1.jpg" }],
  },`);

fs.writeFileSync('js/content.js', code);
console.log('Fixed!');
