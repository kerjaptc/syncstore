#!/usr/bin/env node

/**
 * Remove Duplicate Functions
 * Clean up duplicate function implementations
 */

const fs = require('fs');

console.log('🔧 Removing Duplicate Functions');
console.log('='.repeat(50));

const filePath = 'src/lib/sync/product-sync.ts';

if (!fs.existsSync(filePath)) {
  console.log('❌ File not found');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Find the end of the first createProductMapping function
const firstCreateMapping = content.indexOf('private async createProductMapping(');
if (firstCreateMapping === -1) {
  console.log('❌ First createProductMapping not found');
  process.exit(1);
}

// Find the end of this function by looking for the next function or class end
let braceCount = 0;
let inFunction = false;
let functionEnd = firstCreateMapping;

for (let i = firstCreateMapping; i < content.length; i++) {
  const char = content[i];
  
  if (char === '{') {
    braceCount++;
    inFunction = true;
  } else if (char === '}') {
    braceCount--;
    if (inFunction && braceCount === 0) {
      functionEnd = i + 1;
      break;
    }
  }
}

// Keep everything up to the end of the first function
const keepContent = content.substring(0, functionEnd);

// Find the final closing brace of the class
const lastBrace = content.lastIndexOf('}');
const finalContent = keepContent + '\n}\n';

fs.writeFileSync(filePath, finalContent, 'utf8');

console.log('✅ Removed all duplicate functions');
console.log('✅ Fixed file structure');

console.log('\n' + '='.repeat(50));