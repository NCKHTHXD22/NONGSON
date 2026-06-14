const fs = require('fs');
const path = require('path');

const targetDir = 'D:\\VUGIA';

const ignores = ['.git', 'node_modules', '.env', 'package-lock.json', '.vscode', 'replace_text.js'];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Replace various cases
  content = content.replace(/Quế Sơn/g, 'Vu Gia');
  content = content.replace(/quế sơn/g, 'vu gia');
  content = content.replace(/QUẾ SƠN/g, 'VU GIA');
  content = content.replace(/Que Son/g, 'Vu Gia');
  content = content.replace(/que son/g, 'vu gia');
  content = content.replace(/QUE SON/g, 'VU GIA');
  content = content.replace(/queson/g, 'vugia');
  content = content.replace(/QUESON/g, 'VUGIA');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (ignores.includes(file)) continue;
    
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (stat.isFile()) {
      // Only process text files by simple extension check
      const ext = path.extname(file).toLowerCase();
      const textExts = ['.js', '.jsx', '.json', '.html', '.css', '.md', '.ejs'];
      if (textExts.includes(ext) || file === '.env.example' || !ext) {
        try {
          replaceInFile(fullPath);
        } catch (e) {
          // might be binary, ignore
        }
      }
    }
  }
}

console.log('Starting text replacement...');
walkDir(targetDir);
console.log('Done.');
