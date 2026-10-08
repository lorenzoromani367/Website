const fs = require('fs');

const DYNAMIC_IMAGES = [
  "images/lines/1 wire.JPG",
  "images/lines/2 hill.JPG"
];

const project = {
  slug: "lines",
  images: [
    { src: "images/lines/lines-1.jpg", caption: "house", offset: { x: 100, y: 100 } }
  ]
};

const folderPrefix = `images/${project.slug.toLowerCase()}/`;
const projectFiles = DYNAMIC_IMAGES.filter(path => path.toLowerCase().startsWith(folderPrefix));

project.images = project.images.filter(img => {
  if (!img.src || !img.src.toLowerCase().startsWith(folderPrefix)) return true;
  return projectFiles.some(pf => pf.toLowerCase() === img.src.toLowerCase());
});

projectFiles.forEach(file => {
  const exists = project.images.find(img => img.src && img.src.toLowerCase() === file.toLowerCase());
  if (!exists) {
    project.images.push({ caption: "", src: file });
  }
});

console.log(project.images);
