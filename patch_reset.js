const fs = require('fs');
let code = fs.readFileSync('js/app_v58.js', 'utf8');

const resetLogic = `
        if (changed) {
          localStorage.setItem(k, JSON.stringify(obj));
        }
      } catch (e) {}
    });

    // AUTO-SAVE FIX: If we cleared localStorage, we must also clear content.js
    // for all images in the current page so the reset actually takes effect!
    const isArchive = window.location.hash.startsWith("#/archive");
    const isSimple = window.location.hash.startsWith("#/simple/");
    let imagesToReset = [];
    
    if (isArchive && typeof ARCHIVE !== "undefined" && ARCHIVE.images) {
       imagesToReset = ARCHIVE.images;
    } else if (isSimple) {
       // not fully supported yet
    } else {
       const slug = prefix.replace(/^project\\./, '');
       const proj = typeof PROJECTS !== "undefined" ? PROJECTS.find(p => p.slug === slug) : null;
       if (proj && proj.images) {
          imagesToReset = proj.images;
       }
    }
    
    imagesToReset.forEach(img => {
       const src = img._src || img.src;
       if (src) {
         fetch('http://localhost:8000/api/save-image-props', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             src, 
             props: { width: null, height: null, offset: null, captionOffset: null, zoomBox: null } 
           })
         }).catch(e => {});
       }
    });

    setTimeout(() => location.reload(), 100);
  });
`;

code = code.replace(
/        if \(changed\) \{\n\s*localStorage\.setItem\(k, JSON\.stringify\(obj\)\);\n\s*\}\n\s*\} catch \(e\) \{\}\n\s*\}\);\n\n\s*location\.reload\(\);\n\s*\}\);/g,
resetLogic.trim() + "\n});"
);

fs.writeFileSync('js/app_v58.js', code);
console.log("Patched reset logic!");
