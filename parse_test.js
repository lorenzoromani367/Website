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

function updateImageProps(code, src, props) {
    const srcIndex = code.indexOf(`"${src}"`) !== -1 ? code.indexOf(`"${src}"`) : code.indexOf(`'${src}'`);
    if (srcIndex === -1) return code;
    
    // Find starting {
    let startIdx = srcIndex;
    let braceCount = 0;
    while (startIdx >= 0) {
        if (code[startIdx] === '}') braceCount++;
        if (code[startIdx] === '{') {
            if (braceCount === 0) break;
            braceCount--;
        }
        startIdx--;
    }
    
    if (startIdx < 0) return code;
    
    // Find ending }
    let endIdx = startIdx;
    braceCount = 0;
    while (endIdx < code.length) {
        if (code[endIdx] === '{') braceCount++;
        if (code[endIdx] === '}') {
            braceCount--;
            if (braceCount === 0) break;
        }
        endIdx++;
    }
    
    if (endIdx >= code.length) return code;
    
    let objStr = code.substring(startIdx, endIdx + 1);
    
    // Now modify objStr
    // Remove old properties
    if (props.zoomBox !== undefined) objStr = objStr.replace(/,\s*zoomBox:\s*\{[^}]+\}/g, '');
    if (props.width !== undefined) objStr = objStr.replace(/,\s*width:\s*["'][^"']+["']/g, '');
    if (props.height !== undefined) objStr = objStr.replace(/,\s*height:\s*["'][^"']+["']/g, '');
    if (props.offset !== undefined) objStr = objStr.replace(/,\s*offset:\s*\{[^}]+\}/g, '');
    if (props.captionOffset !== undefined) objStr = objStr.replace(/,\s*captionOffset:\s*\{[^}]+\}/g, '');
    
    // Append new properties
    let additions = [];
    if (props.zoomBox) additions.push(`zoomBox: { width: "${props.zoomBox.width}", height: "${props.zoomBox.height}", offset: { x: ${Math.round(props.zoomBox.offset.x)}, y: ${Math.round(props.zoomBox.offset.y)} } }`);
    if (props.width !== undefined) additions.push(`width: "${props.width}"`);
    if (props.height !== undefined) additions.push(`height: "${props.height}"`);
    if (props.offset !== undefined) additions.push(`offset: { x: ${Math.round(props.offset.x)}, y: ${Math.round(props.offset.y)} }`);
    if (props.captionOffset !== undefined) additions.push(`captionOffset: { x: ${Math.round(props.captionOffset.x)}, y: ${Math.round(props.captionOffset.y)} }`);
    
    if (additions.length > 0) {
        // Insert right before the last closing brace
        const isMultiLine = objStr.includes('\n');
        const insertStr = additions.map(a => isMultiLine ? `\n${a}` : `, ${a}`).join(isMultiLine ? ',' : '');
        
        if (isMultiLine) {
            // find last newline before the closing brace
            const lastNewline = objStr.lastIndexOf('\n');
            objStr = objStr.substring(0, lastNewline) + ',' + insertStr + objStr.substring(lastNewline);
        } else {
            objStr = objStr.substring(0, objStr.length - 1) + insertStr + " }";
        }
    }
    
    return code.substring(0, startIdx) + objStr + code.substring(endIdx + 1);
}

console.log(updateImageProps(content, "images/boudaries/1 wire.JPG", { width: "1000px" }));
console.log(updateImageProps(content, "images/boudaries/3 field.jpg", { width: "999px" }));

