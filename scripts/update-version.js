#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get new version from command line or increment patch version
const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Usage: npm run version <version>');
  console.error('Example: npm run version 1.2.7');
  process.exit(1);
}

// Validate version format
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Invalid version format. Use x.y.z format.');
  process.exit(1);
}

console.log(`📦 Updating koshi-vox to version ${newVersion}...`);

// Files to update
const filesToUpdate = [
  {
    path: 'package.json',
    update: (content) => {
      const pkg = JSON.parse(content);
      pkg.version = newVersion;
      return JSON.stringify(pkg, null, 2) + '\n';
    }
  },
  {
    path: 'README.md',
    update: (content) => {
      // Only update the version in the ASCII art section (line 9)
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('░░ v') && i < 15) { // Only in header area
          lines[i] = lines[i].replace(/v\d+\.\d+\.\d+/, `v${newVersion}`);
          break;
        }
      }
      // Update installation command if it has version
      content = lines.join('\n');
      content = content.replace(/koshi-vox@\d+\.\d+\.\d+/g, `koshi-vox@${newVersion}`);
      return content;
    }
  },
  {
    path: 'scripts/install.js',
    update: (content) => {
      // Only update version in the console.log line around line 1086
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('console.log') && lines[i].includes('░░░█ v') && lines[i].includes('colors.reset')) {
          lines[i] = lines[i].replace(/v\d+\.\d+\.\d+/, `v${newVersion}`);
          break;
        }
      }
      return lines.join('\n');
    }
  }
];

// Update each file
filesToUpdate.forEach(({ path: filePath, update }) => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️  File not found: ${filePath}`);
    return;
  }
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const updated = update(content);
    fs.writeFileSync(fullPath, updated);
    console.log(`✅ Updated ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}: ${error.message}`);
  }
});

// Update package-lock.json
try {
  console.log('📝 Updating package-lock.json...');
  execSync('npm install', { stdio: 'pipe' });
  console.log('✅ Updated package-lock.json');
} catch (error) {
  console.warn('⚠️  Could not update package-lock.json');
}

console.log(`\n✨ Version updated to ${newVersion}!`);
console.log('\nNext steps:');
console.log('1. Test the changes: npm test');
console.log('2. Commit changes: git add -A && git commit -m "chore: bump version to ' + newVersion + '"');
console.log('3. Tag release: git tag v' + newVersion);
console.log('4. Push changes: git push && git push --tags');
console.log('5. Publish to npm: npm publish');