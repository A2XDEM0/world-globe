// Usage: node test/denmark.mjs <project root>, with `npm run serve` running. Screenshot goes to work/.
import puppeteer from 'puppeteer-core';
const S=process.argv[2];const sleep=ms=>new Promise(k=>setTimeout(k,ms));
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const p=await b.newPage();await p.setViewport({width:1440,height:900});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('http://127.0.0.1:8765/wrap.html',{waitUntil:'load'});await p.waitForFunction('DATA.hi',{timeout:12000});
await p.evaluate(()=>openCountry('DNK'));await sleep(1500);
const r=await p.evaluate(()=>({texts:[...$('flat').querySelectorAll('text')].map(n=>n.textContent).join(' ')}));
await p.screenshot({path:S+'/work/dnk2.png',clip:{x:16,y:118,width:1064,height:640}});
for(const id of ['FRA','USA','NOR']){await p.evaluate(i=>openCountry(i),id);await sleep(900);r[id]=await p.evaluate(()=>$('flat-name').textContent+':'+[...$('flat').querySelectorAll('rect')].length)}
console.log(JSON.stringify({r,errs}));await b.close();
