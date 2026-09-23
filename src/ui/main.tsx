import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { engine } from '../client/engine.ts';

// Test/debug hooks (used by the automated browser test; harmless otherwise).
(window as any).__kk = engine.hooks();
(window as any).__kkBoot = { newMatch: (d: 'easy' | 'normal', seed?: number) => engine.newMatch(d, seed), showTitle: () => engine.quitToTitle(), engine };

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Optional PWA: only when served over http(s) with ?pwa. Never from file:// or a native wrapper.
if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol) && new URLSearchParams(location.search).has('pwa')) {
  const link = document.createElement('link'); link.rel = 'manifest'; link.href = 'manifest.webmanifest'; document.head.appendChild(link);
  navigator.serviceWorker.register('./sw.js').catch(err => console.info('Offline install unavailable:', err));
}
