import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const base=resolve('dist');const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');const file=resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(file!==base&&!file.startsWith(base+sep)){res.writeHead(403);res.end();return;}
 if(!(await stat(file)).isFile())throw new Error('not file');
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('Not found');}});
server.listen(4173,'127.0.0.1',()=>console.log('Kernel Keep UI lab: http://127.0.0.1:4173 — add /?pwa to enable offline caching.'));
