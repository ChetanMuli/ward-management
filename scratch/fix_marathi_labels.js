const fs = require('fs');

let fam = fs.readFileSync('frontend/src/pages/Families.jsx', 'utf8');
fam = fam.replace(/<span className="notranslate" translate="no">Native village<\/span>/g, '<span>Native village</span>');
fam = fam.replace(/<b className="notranslate" translate="no">Native village:<\/b>/g, '<b>Native village:</b>');
fam = fam.replace(/<strong className="notranslate" translate="no">Native village \(optional\)<\/strong>/g, '<strong>Native village (optional)</strong>');
fam = fam.replace(/<span className="notranslate" translate="no">Native village \(optional\)<\/span>/g, '<span>Native village (optional)</span>');
fs.writeFileSync('frontend/src/pages/Families.jsx', fam, 'utf8');
console.log('Fixed Families.jsx');

let ppl = fs.readFileSync('frontend/src/pages/People.jsx', 'utf8');
ppl = ppl.replace(/<b className="notranslate" translate="no">Native village:<\/b>/g, '<b>Native village:</b>');
fs.writeFileSync('frontend/src/pages/People.jsx', ppl, 'utf8');
console.log('Fixed People.jsx');
