const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const logoSource = path.resolve(__dirname, '..', 'logo.png');
const logoTarget = path.join(distDir, 'logo.png');
const vidopiDir = path.join(distDir, 'nodes', 'Vidopi');
const vidopiLogoTarget = path.join(vidopiDir, 'logo.png');

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run the TypeScript build before postbuild.');
  process.exit(1);
}

if (!fs.existsSync(logoSource)) {
  console.error('logo.png not found at project root.');
  process.exit(1);
}

fs.copyFileSync(logoSource, logoTarget);

fs.mkdirSync(vidopiDir, { recursive: true });
fs.copyFileSync(logoSource, vidopiLogoTarget);

const esModuleLine =
  'Object.defineProperty(exports, "__esModule", { value: true });';

const walkAndClean = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkAndClean(entryPath);
      continue;
    }

    if (!entry.name.endsWith('.js')) {
      continue;
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    if (!content.includes(esModuleLine)) {
      continue;
    }

    const updated = content.replace(`${esModuleLine}\n`, '');
    fs.writeFileSync(entryPath, updated, 'utf8');
  }
};

walkAndClean(distDir);

