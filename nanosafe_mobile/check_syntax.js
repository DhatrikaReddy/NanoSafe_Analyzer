
const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');

const srcDir = path.join(__dirname, 'src');

function checkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      checkDir(fullPath);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const code = fs.readFileSync(fullPath, 'utf8');
      try {
        babelParser.parse(code, {
          sourceType: 'module',
          plugins: ['jsx', 'flow', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator']
        });
        console.log('✅ OK:', path.relative(srcDir, fullPath));
      } catch (e) {
        console.error('❌ SYNTAX ERROR in ' + fullPath + ': ' + e.message);
        process.exit(1);
      }
    }
  }
}

checkDir(srcDir);
console.log('ALL MOBILE JS FILES COMPILE WITH 100% CLEAN SYNTAX!');
