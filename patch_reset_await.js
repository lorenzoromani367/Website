const fs = require('fs');
let code = fs.readFileSync('js/app_v58.js', 'utf8');

const asyncResetLogic = `
    const fetchPromises = [];
    imagesToReset.forEach(img => {
       const src = img._src || img.src;
       if (src) {
         fetchPromises.push(
           fetch('http://localhost:8000/api/save-image-props', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               src, 
               props: { width: null, height: null, offset: null, captionOffset: null, zoomBox: null } 
             })
           }).catch(e => {})
         );
       }
    });

    Promise.all(fetchPromises).then(() => {
       setTimeout(() => location.reload(), 100);
    });
  });
`;

code = code.replace(
/    imagesToReset\.forEach\(img => \{[\s\S]*?setTimeout\(\(\) => location\.reload\(\), 150\);\n\s*\}\);/m,
asyncResetLogic.trim()
);

fs.writeFileSync('js/app_v58.js', code);
console.log("Patched reset to use Promise.all!");
