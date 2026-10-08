const line = '    images: [{ caption: "cars", src: "images/pile/cars.JPG" , width: "380px", height: "auto", align: "left"}],';
const props = { offset: { x: 100, y: 200 } };
let newLine = line.replace(/\}([^}]*)$/, `, offset: { x: ${Math.round(props.offset.x)}, y: ${Math.round(props.offset.y)} } }$1`);
console.log(newLine);
