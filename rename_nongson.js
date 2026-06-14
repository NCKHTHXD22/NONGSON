const fs = require('fs');
const path = require('path');

const EXCLUDE_DIRS = ['node_modules', '.git', '.vercel', 'dist', 'build', 'images'];
const INCLUDE_EXTS = ['.js', '.jsx', '.json', '.html', '.ejs', '.md', '.yaml', '.mjs', '.css', '.env', '.env.example', '.ps1'];

function processDirectory(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!EXCLUDE_DIRS.includes(file)) {
                processDirectory(fullPath);
            }
        } else {
            const ext = path.extname(file);
            if (INCLUDE_EXTS.includes(ext) || file.startsWith('.env')) {
                processFile(fullPath);
            }
        }
    }
}

function processFile(filePath) {
    if (filePath.endsWith('rename_nongson.js') || filePath.endsWith('replace_text.js') || filePath.endsWith('rename.js')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replacements
    content = content.replace(/vugia-goopy/g, 'nongson-goopy');
    content = content.replace(/vugia/g, 'nongson');
    content = content.replace(/VUGIA/g, 'NONGSON');
    content = content.replace(/Vũ Gia/g, 'Nông Sơn');
    content = content.replace(/VŨ GIA/g, 'NÔNG SƠN');
    content = content.replace(/Vu Gia/g, 'Nong Son');
    content = content.replace(/vu gia/gi, 'nong son');
    
    // EVN specific
    content = content.replace(/PC05GG/g, 'PC05MM'); 
    content = content.replace(/Điện lực Đại Lộc/g, 'Điện lực Quế Sơn');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

processDirectory(__dirname);
console.log('Done renaming NONGSON!');
