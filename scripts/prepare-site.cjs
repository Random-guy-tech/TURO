// Produce a hosting-neutral public folder. Nothing is uploaded or published.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const publicFiles = [
  'index.html', 'ar/index.html', 'styles.css', 'content.js', 'script.js',
  'assets/social-preview.png',
  'assets/turo-logo.svg',
  'assets/turo-icon.svg', 'assets/turo-icon.png'
];
const args = [path.join(__dirname, 'build-pages.cjs')];
if (process.env.SITE_ORIGIN) args.push('--origin', process.env.SITE_ORIGIN);
execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, [path.join(__dirname, 'check-site.cjs')], { cwd: root, stdio: 'inherit' });
// Only clear the exact, non-linked build directory belonging to this project.
if (path.relative(root, path.resolve(output)) !== 'dist') throw new Error('Invalid build output directory.');
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink()) throw new Error('Refusing to replace a linked output directory.');
  if (path.dirname(fs.realpathSync(output)) !== fs.realpathSync(root)) throw new Error('Build output is outside the project.');
  fs.rmSync(output, { recursive: true });
}
fs.mkdirSync(output, { recursive: true });
for (const file of publicFiles) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
console.log(`Prepared ${publicFiles.length} public files in dist/. No audit notes, prompts or font sources are included.`);
