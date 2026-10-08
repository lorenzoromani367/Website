const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// We will replace the block inside /api/save-image-props
const newBlock = `
            if (props.zoomBox) {
              line = line.replace(/,\\s*zoomBox:\\s*\\{[^}]+\\}/, '');
              const zoomBoxStr = \`, zoomBox: { width: "\${props.zoomBox.width}", height: "\${props.zoomBox.height}", offset: { x: \${Math.round(props.zoomBox.offset.x)}, y: \${Math.round(props.zoomBox.offset.y)} } }\`;
              line = line.replace(/\\}(\\s*,)?$/, \`\${zoomBoxStr} }$1\`);
            }
            if (props.width !== undefined) {
              line = line.replace(/,\\s*width:\\s*["'][^"']+["']/, '');
              line = line.replace(/\\}(\\s*,)?$/, \`, width: "\${props.width}" }$1\`);
            }
            if (props.height !== undefined) {
              line = line.replace(/,\\s*height:\\s*["'][^"']+["']/, '');
              line = line.replace(/\\}(\\s*,)?$/, \`, height: "\${props.height}" }$1\`);
            }
            if (props.offset !== undefined) {
              line = line.replace(/,\\s*offset:\\s*\\{[^}]+\\}/, '');
              line = line.replace(/\\}(\\s*,)?$/, \`, offset: { x: \${Math.round(props.offset.x)}, y: \${Math.round(props.offset.y)} } }$1\`);
            }
            if (props.captionOffset !== undefined) {
              line = line.replace(/,\\s*captionOffset:\\s*\\{[^}]+\\}/, '');
              line = line.replace(/\\}(\\s*,)?$/, \`, captionOffset: { x: \${Math.round(props.captionOffset.x)}, y: \${Math.round(props.captionOffset.y)} } }$1\`);
            }
            
            lines[i] = line;
            break;
`;

content = content.replace(/if\s*\(props\.zoomBox\)\s*\{[\s\S]*?\/\/\s*In futuro[\s\S]*?break;\s*}/, newBlock.trim());
fs.writeFileSync('server.js', content);
console.log("Patched server.js!");
