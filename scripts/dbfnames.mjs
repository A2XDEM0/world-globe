import fs from 'fs';
const [dbf,out]=process.argv.slice(2);const b=fs.readFileSync(dbf);
const n=b.readUInt32LE(4),hl=b.readUInt16LE(8),rl=b.readUInt16LE(10);
const fields=[];for(let o=32;b[o]!==0x0d;o+=32){fields.push({name:b.toString('latin1',o,o+11).replace(/\0.*$/,''),len:b[o+16]})}
let off=1;for(const f of fields){f.off=off;off+=f.len}
const F=k=>fields.find(f=>f.name===k);const id=F('shapeID'),nm=F('shapeName');
const dec=new TextDecoder('utf-8',{fatal:true});
const map={};let utf=0,lat=0;
for(let i=0;i<n;i++){const r=hl+i*rl;const raw=b.subarray(r+nm.off,r+nm.off+nm.len);let s;
 try{s=dec.decode(raw);utf++}catch(e){s=raw.toString('latin1');lat++}
 map[b.toString('latin1',r+id.off,r+id.off+id.len).trim()]=s.replace(/\0/g,'').trim()}
fs.writeFileSync(out,JSON.stringify(map));console.log('records',n,'utf8',utf,'latin1',lat,'sample',['Malësi','Ōtor','Bayam'].map(t=>Object.values(map).find(v=>v.startsWith(t))));
