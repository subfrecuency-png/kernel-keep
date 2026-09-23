// Bundles the React UI + simulation into ONE self-contained offline HTML file (dist/kernel-keep.html).
// Art is inlined as data: URIs. Also writes the optional PWA files next to it (only used when served).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const res = await build({
  entryPoints: ['src/ui/main.tsx'], bundle: true, format: 'iife', target: 'es2020', minify: true,
  jsx: 'automatic', write: false, sourcemap: false, legalComments: 'none', logLevel: 'warning',
  loader: { '.webp': 'dataurl', '.svg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/ui/styles.css', 'utf8');
const icon = 'data:image/svg+xml;base64,' + readFileSync('assets/icons/icon.svg').toString('base64');
const html = readFileSync('src/client/index.html', 'utf8')
  .replace('/*__CSS__*/', () => css).replace('/*__ICON__*/', () => icon).replace('/*__BUNDLE__*/', () => js);
mkdirSync('dist/assets', { recursive: true });
writeFileSync('dist/kernel-keep.html', html);
writeFileSync('dist/index.html', html);

// Optional PWA (served over http(s) with ?pwa only). Cache name is a content hash, so updates never mix versions,
// and there is no skipWaiting: a new version never replaces a running match.
const digest = createHash('sha256').update(html).digest('hex').slice(0, 12);
copyFileSync('assets/icons/icon-192.png', 'dist/assets/icon-192.png');
copyFileSync('assets/icons/icon-512.png', 'dist/assets/icon-512.png');
writeFileSync('dist/manifest.webmanifest', JSON.stringify({
  id: './', name: 'Kernel Keep', short_name: 'Kernel Keep', description: 'Offline single-player fortress RTS prototype. Hash Credits are fictional.',
  start_url: './index.html?pwa', scope: './', display: 'standalone', background_color: '#07121c', theme_color: '#07121c',
  icons: [{ src: 'assets/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icon-512.png', sizes: '512x512', type: 'image/png' }],
}, null, 1));
writeFileSync('dist/sw.js', `const CACHE='kernel-keep-${digest}';
const ASSETS=['./','./index.html','./kernel-keep.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('kernel-keep-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(h=>h||fetch(e.request)));});
`);
console.log(`dist/kernel-keep.html  ${(html.length / 1024).toFixed(1)} KiB  (cache ${digest})`);
