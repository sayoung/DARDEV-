const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules')) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = [...walk('packages'), ...walk('apps'), ...walk('scripts')];
let changedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('thumbnailUrl') && !content.includes('derivatives')) {
    const updated = content.replace(/(thumbnailUrl:\s*(?:null|'[^']*'|"[^"]*"),?)(?:\r?\n)/g, '$1\n  derivatives: {},\n');
    if (updated !== content) {
      fs.writeFileSync(file, updated);
      console.log('Updated ' + file);
      changedCount++;
    }
  }
}

console.log('Total files changed: ' + changedCount);
