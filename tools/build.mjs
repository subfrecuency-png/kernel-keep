// Bundles the client into a single self-contained offline HTML file: dist/kernel-keep.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/client/main.ts'], bundle: true, format: 'iife', target: 'es2020', minify: true,
  write: false, sourcemap: false, legalComments: 'none', logLevel: 'warning',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('src/client/index.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/kernel-keep.html', html);
console.log(`dist/kernel-keep.html  ${(html.length / 1024).toFixed(1)} KiB`);
