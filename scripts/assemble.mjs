// Puts the page together from src/ in two forms that share the same front-end code:
//   dist/index.html (and work/wrap.html for local tests): one file for the web; <script src="x.js"></script> tags naming a file in src/ are inlined.
//   desktop/app/: the Electron page, with d3, topojson and the fonts copied locally, and no inline script or style, so a strict CSP holds.
import fs from 'fs';import path from 'path';import {fileURLToPath} from 'url';
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const geo=fs.readFileSync(R+'/work/inline.json','utf8');
const src=fs.readFileSync(R+'/src/globe.html','utf8');
// libraries the page loads from vendor/: inlined for the web, copied for the desktop
const LOCAL_VENDOR={'earcut.min.js':['earcut/dist/earcut.min.js','earcut/LICENSE']};
const localScripts=[...src.matchAll(/<script src="([\w.-]+\.js)"><\/script>/g)].map(m=>m[1]).filter(f=>fs.existsSync(R+'/src/'+f));
const inline=s=>s.replace(/<script src="([\w.-]+\.js)"><\/script>/g,(m,f)=>localScripts.includes(f)?'<script>\n'+fs.readFileSync(R+'/src/'+f,'utf8')+'</script>':m)
  .replace(/<script src="vendor\/([\w.-]+\.js)"><\/script>/g,(m,f)=>'<script>\n'+fs.readFileSync(R+'/node_modules/'+LOCAL_VENDOR[f][0],'utf8').replace(/\/\/# sourceMappingURL=\S+/,'')+'\n</script>');
const page=inline(src).replace('__GEO__',()=>geo);
fs.writeFileSync(R+'/dist/index.html',page);
fs.writeFileSync(R+'/work/wrap.html','<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'+page+'</body></html>');
console.log('web page bytes',page.length);

/* ---- desktop ---- */
const D=R+'/desktop/app',NM=R+'/node_modules';
fs.rmSync(D,{recursive:true,force:true});fs.mkdirSync(D+'/vendor',{recursive:true});fs.mkdirSync(D+'/fonts/files',{recursive:true});
const VENDOR={'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js':['d3/dist/d3.min.js','d3.min.js','d3/LICENSE'],'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js':['topojson/dist/topojson.min.js','topojson.min.js','topojson/LICENSE.md']};
let h=src;
for(const [url,[from,to,lic]] of Object.entries(VENDOR)){
  if(!h.includes(url))throw new Error('CDN script not found in page: '+url);
  h=h.replace(`<script src="${url}"></script>`,`<script src="vendor/${to}"></script>`);
  fs.copyFileSync(NM+'/'+from,D+'/vendor/'+to);fs.copyFileSync(NM+'/'+lic,D+'/vendor/'+to.replace('.min.js','.LICENSE.txt'));
}
for(const f of localScripts)fs.copyFileSync(R+'/src/'+f,D+'/'+f);
for(const [f,[from,lic]] of Object.entries(LOCAL_VENDOR)){fs.copyFileSync(NM+'/'+from,D+'/vendor/'+f);fs.copyFileSync(NM+'/'+lic,D+'/vendor/'+f.replace('.min.js','.LICENSE.txt'));}
// fonts: the weights the web page asks Google Fonts for, from @fontsource (SIL OFL)
const FONTS={'ibm-plex-sans':[400,500,600],'ibm-plex-mono':[400],'inter':[500,600]};
let css='';
for(const [fam,ws] of Object.entries(FONTS)){
  for(const w of ws){
    css+=fs.readFileSync(`${NM}/@fontsource/${fam}/${w}.css`,'utf8').replace(/src: ([^;]+);/g,(m,s)=>{
      const f=/url\(\.\/files\/([\w.-]+\.woff2)\)/.exec(s)[1];fs.copyFileSync(`${NM}/@fontsource/${fam}/files/${f}`,`${D}/fonts/files/${f}`);
      return `src: url(files/${f}) format('woff2');`;
    })+'\n';
  }
  fs.copyFileSync(`${NM}/@fontsource/${fam}/LICENSE`,`${D}/fonts/${fam}.LICENSE.txt`);
}
fs.writeFileSync(D+'/fonts/fonts.css',css);
h=h.replace(/<link rel="preconnect"[^>]*>\n/g,'').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/,'<link rel="stylesheet" href="fonts/fonts.css">');
if(/googleapis|cdnjs|https?:\/\/[^"']*\.(js|css)/.test(h))throw new Error('page still points at the network');
// the <style> block and the main inline script move into files
h=h.replace(/<style>\n([\s\S]*?)<\/style>/,(m,s)=>{fs.writeFileSync(D+'/globe.css','body { margin: 0 }\nimg { max-width: 100% }\n'+s);return '<link rel="stylesheet" href="globe.css">';});
const scripts=[...h.matchAll(/<script>\n([\s\S]*?)<\/script>/g)];
if(scripts.length!==1)throw new Error('expected one inline script, found '+scripts.length);
fs.writeFileSync(D+'/globe.js',scripts[0][1]);
h=h.replace(scripts[0][0],'<script src="globe.js"></script>').replace('__GEO__',()=>geo);
const CSP="default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; base-uri 'none'; form-action 'none'";
const title=/<title>.*?<\/title>\n/.exec(h)[0];h=h.replace(title,'');
const headEnd=h.indexOf('<main');
fs.writeFileSync(D+'/index.html',`<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n${title}${h.slice(0,headEnd)}</head>\n<body>\n${h.slice(headEnd)}</body>\n</html>\n`);
console.log('desktop page',D);
