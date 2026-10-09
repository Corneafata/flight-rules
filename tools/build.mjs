// Bundles the ES modules into one self-contained HTML file that opens by double-click (no server),
// for classrooms with poor internet. Output:
//   dist/index.html    full document (GitHub Pages, offline use)
//   dist/artifact.html body-only variant used for the hosted claude.ai demo page
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['src/data/longNight.js', 'src/sim/constants.js', 'src/sim/rules.js', 'src/sim/engine.js', 'src/sim/debrief.js', 'src/share.js', 'src/app.js'];

const strip = (code) =>
  code
    .replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^export\s+(const|function|let|class|async function)\s/gm, '$1 ');

const js = ORDER.map((f) => `// ---- ${f} ----\n${strip(readFileSync(join(root, f), 'utf8'))}`).join('\n');
const bundle = `(() => {\n'use strict';\n${js}\n})();`;
if (/\bexport\b\s*\{|^\s*import\s/m.test(bundle)) throw new Error('Unbundled import/export left behind');

const html = readFileSync(join(root, 'src/index.html'), 'utf8');
const tag = '<script type="module" src="./app.js"></script>';
if (!html.includes(tag)) throw new Error('script tag not found in src/index.html');
const full = html.replace(tag, () => `<script>\n${bundle}\n</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), full);
writeFileSync(join(root, 'index.html'), full); // GitHub Pages serves the repo root
writeFileSync(join(root, 'dist/bundle.js'), bundle);

// Artifact variant: the host supplies doctype/html/head/body, so keep only title, links, style and body content.
const head = full.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = full.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync(join(root, 'dist/artifact.html'), `${head.trim()}\n${body.trim()}\n`);
console.log(`built dist/index.html (${(full.length / 1024).toFixed(0)} KB)`);
