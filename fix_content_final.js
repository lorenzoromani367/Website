const fs = require('fs');
const path = 'js/content.js';
let content = fs.readFileSync(path, 'utf8');

// Replace any occurrence of multiple offsets like `offset: { x: -100, y: 60, offset: { x: -100, y: 60 } }`
// Actually it's easier to just strip all `, offset: { ... }` from the single line and re-append.

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('images: [{ caption: "back", src: "images/beach/beach-1.jpg"')) {
    lines[i] = '    images: [{ caption: "back", src: "images/beach/beach-1.jpg", offset: { x: -100, y: 60 } }],';
  } else if (lines[i].includes('images: [{ caption: "horse", src: "images/plastic/plastic-1.jpg"')) {
    lines[i] = '    images: [{ caption: "horse", src: "images/plastic/plastic-1.jpg", offset: { x: -111, y: 52 } }],';
  } else if (lines[i].includes('images: [{ caption: "dye", src: "images/hair/hair-1.jpg"')) {
    lines[i] = '    images: [{ caption: "dye", src: "images/hair/hair-1.jpg", offset: { x: -100, y: 60 } }],';
  } else if (lines[i].includes('images: [{ caption: "ivy", src: "images/eating/dreams.jpg"')) {
    lines[i] = '    images: [{ caption: "ivy", src: "images/eating/dreams.jpg", offset: { x: -80, y: 60 } }],';
  } else if (lines[i].includes('images: [{ caption: "granade", src: "images/toy/toy-1.jpg"')) {
    lines[i] = '    images: [{ caption: "granade", src: "images/toy/toy-1.jpg", offset: { x: -140, y: 60 } }],';
  } else if (lines[i].includes('images: [{ caption: "beyond", src: "images/whitening/whitening-1.jpg"')) {
    lines[i] = '    images: [{ caption: "beyond", src: "images/whitening/whitening-1.jpg", offset: { x: -140, y: 60 } }],';
  } else if (lines[i].includes('images: [{ caption: "fun fair", src: "images/bar/bar-1.jpg"')) {
    lines[i] = '      { caption: "fun fair", src: "images/bar/bar-1.jpg", offset: { x: -160, y: 60 } },';
  } else if (lines[i].includes('images: [{ caption: "dinner", src: "images/fluoxetine/dinner.JPG"')) {
    lines[i] = '    images: [{ caption: "dinner", src: "images/fluoxetine/dinner.JPG", offset: { x: -120, y: 40 } }],';
  } else if (lines[i].includes('caption: "", src: "images/compression/compression-1.jpg"')) {
    lines[i] = '      { caption: "", src: "images/compression/compression-1.jpg", offset: { x: -60, y: 60 } },';
  } else if (lines[i].includes('images: [{ caption: "sushi disco", src: "images/sofa/sushi discotheque.jpg"')) {
    lines[i] = '    images: [{ caption: "sushi disco", src: "images/sofa/sushi discotheque.jpg", offset: { x: -140, y: 60 } }],';
  } else if (lines[i].includes('images: [{ caption: "rock", src: "images/paper-tape/rock.JPG"')) {
    lines[i] = '    images: [{ caption: "rock", src: "images/paper-tape/rock.JPG", offset: { x: -100, y: 60 } }],';
  }
}

fs.writeFileSync(path, lines.join('\n'));
