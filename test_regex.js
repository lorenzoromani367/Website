const fs = require('fs');
let content = `
{
caption: "wire",
src: "images/boudaries/1 wire.JPG",
width: "480px",
height: "673px",
captionOffset: { x: 100, y: 360 },
mobile: { width: "280px", height: "393px" },
},
{ caption: "field", src: "images/boudaries/3 field.jpg", width: "440px", height: "622px", mobile: { width: "280px", height: "396px" } },
`;

const src = "images/boudaries/1 wire.JPG";
// We need to find the object containing this src.
// Since it's inside an array, an object starts with { and ends with } (not containing another { inside ideally, though zoomBox has {} inside it!)
