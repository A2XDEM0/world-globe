// Local preview: http://127.0.0.1:8765/wrap.html (the page wrapped like the Artifact viewer does).
import http from 'http';import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const types={'.html':'text/html;charset=utf-8','.json':'application/json'};
http.createServer((q,s)=>{const u=decodeURIComponent(q.url.split('?')[0]);const p=u==='/wrap.html'?R+'/work/wrap.html':path.join(R,'dist',u);fs.readFile(p,(e,b)=>{if(e){s.writeHead(404);s.end();return}s.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});s.end(b)})}).listen(8765,'127.0.0.1');
console.log('http://127.0.0.1:8765/wrap.html');
