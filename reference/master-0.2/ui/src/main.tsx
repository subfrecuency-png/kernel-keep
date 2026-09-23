import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
// PWA registration is opt-in: no service worker in file:// or native Tauri.
if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)&&new URLSearchParams(location.search).has('pwa')){
 navigator.serviceWorker.register('./sw.js').catch(error=>console.info('Offline installation unavailable:',error));
}
