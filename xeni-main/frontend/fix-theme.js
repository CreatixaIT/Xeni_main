const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!filePath.includes('node_modules') && !filePath.includes('.next')) {
        results = results.concat(walk(filePath));
      }
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

const files = walk('./src');

const skipClasses = ['bg-primary', 'bg-success', 'bg-danger', 'bg-amber', 'bg-emerald', 
                     'bg-gradient', 'badge', 'btn-primary', 'bg-[#', 'from-', 'to-'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  let lines = content.split('\n');
  let newLines = [];
  let modified = false;

  for (let line of lines) {
    if (skipClasses.some(skip => line.includes(skip))) {
      newLines.push(line);
      continue;
    }

    let origLine = line;
    
    // Replace whole words
    line = line.replace(/\btext-white\b/g, 'dark:text-white text-gray-900');
    line = line.replace(/\bbg-white\/5\b/g, 'dark:bg-white/5 bg-black/5');
    line = line.replace(/\bbg-white\/10\b/g, 'dark:bg-white/10 bg-black/10');
    line = line.replace(/\bbg-white\/20\b/g, 'dark:bg-white/20 bg-black/20');
    line = line.replace(/\bborder-white\/5\b/g, 'dark:border-white/5 border-black/5');
    line = line.replace(/\bborder-white\/10\b/g, 'dark:border-white/10 border-black/10');
    line = line.replace(/\bborder-white\/20\b/g, 'dark:border-white/20 border-black/20');
    
    if (origLine !== line) {
      modified = true;
    }
    
    newLines.push(line);
  }

  if (modified) {
    fs.writeFileSync(file, newLines.join('\n'));
    console.log('Updated', file);
  }
});
