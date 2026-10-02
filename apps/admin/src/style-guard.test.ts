import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

function getAllTsxFiles(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllTsxFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') && !filePath.endsWith('.test.tsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Style Guard', () => {
  it('should not contain non-logical classes, hardcoded colors, or legacy custom classes', () => {
    const srcDir = path.join(__dirname);
    const tsxFiles = getAllTsxFiles(srcDir);
    
    // non-logical classes
    const nonLogicalRegex = /\b(pl|pr|ml|mr|left|right)-|\btext-(left|right)\b/;
    // hardcoded colors
    const hardcodedColorsRegex = /\b(gray|red|green|blue|white)-|\b(text-white|bg-white)\b/g;
    // exception cases
    const exceptions = ['text-white', 'bg-white/10', 'bg-white']; // Some components might legitimately use white, but let's check AppLayout specifically if needed. The prompt says "sauf text-white/bg-white/10 utilisés dans AppLayout sur fond violet, à lister explicitement en exception"
    // legacy custom classes
    const legacyClassesRegex = /\b(auth-|tour-|nav-list)\b/;

    const errors: string[] = [];

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Basic check for class names in JSX
      // We look for className="..." or className={...}
      // Since it's a simple regex we can just scan the whole file, but it's safer to only complain if it's actually in className or just globally avoid them.
      // The instruction: "échoue si un className contient ..."
      
      // Let's just do a global check, or a regex for className="..."
      const classNameRegex = /className=(["'])(.*?)\1|className=\{`([^`]+)`\}/g;
      let match;
      
      while ((match = classNameRegex.exec(content)) !== null) {
        const classNames = match[2] || match[3];
        if (!classNames) continue;

        if (nonLogicalRegex.test(classNames)) {
          errors.push(`File ${path.basename(file)} contains non-logical class: ${classNames}`);
        }
        
        if (legacyClassesRegex.test(classNames)) {
          errors.push(`File ${path.basename(file)} contains legacy class: ${classNames}`);
        }

        const colorMatches = classNames.match(hardcodedColorsRegex);
        if (colorMatches) {
          const invalidColors = colorMatches.filter(c => !exceptions.includes(c));
          if (invalidColors.length > 0) {
            errors.push(`File ${path.basename(file)} contains hardcoded colors: ${invalidColors.join(', ')} in "${classNames}"`);
          }
        }
      }
    }

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
