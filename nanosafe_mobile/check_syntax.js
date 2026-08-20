
const fs = require('fs');
const path = require('path');
const babelParser = require('@babel/parser');

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
        console.log('✅ OK:', path.relative('c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/nanosafe_mobile/src', fullPath));
      } catch (e) {
        console.error('❌ SYNTAX ERROR in ' + fullPath + ': ' + e.message);
        process.exit(1);
      }
    }
  }
}

checkDir('c:/Users/bhumi/OneDrive/Desktop/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/NanoSafe_Analyzer/nanosafe_mobile/src');
console.log('ALL MOBILE JS FILES COMPILE WITH 100% CLEAN SYNTAX!');
