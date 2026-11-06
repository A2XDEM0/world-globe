import fs from 'fs';import path from 'path';import {feature} from 'topojson-client';import {geoArea,geoContains} from 'd3-geo';
const [P,W,G]=process.argv.slice(2);
const strip=f=>{const t=JSON.parse(fs.readFileSync(f));for(const k in t.objects)for(const g of t.objects[k].geometries)delete g.properties;return t};
const hi=strip(G+'/data/countries-10m.json');fs.writeFileSync(G+'/data/countries-10m.json',JSON.stringify(hi));const lo=strip(W+'/lo.json');
const names=JSON.parse(fs.readFileSync(W+'/names.json'));const ids=new Set(names.map(n=>n[0]));
const hf=feature(hi,hi.objects.countries).features;const lf=feature(lo,lo.objects.countries).features;
console.log('hi features',hf.length,'lo',lf.length,'noId',hf.filter(f=>!f.id).length,'notNamed',hf.filter(f=>!ids.has(f.id)).map(f=>f.id),'namedNoGeom',names.filter(n=>!hf.some(f=>f.id===n[0])).map(n=>n[0]));
console.log('big area (bad winding)',hf.filter(f=>geoArea(f)>6.3).map(f=>f.id),lf.filter(f=>geoArea(f)>6.3).map(f=>f.id));
const pts={taiwan:[121,23.7],arunachal:[94,28],hk:[114.2,22.4],macau:[113.56,22.16],kosovo:[21,42.6],donetsk:[37.8,48],luhansk:[39.3,48.6],kyiv:[30.5,50.4],crimea:[34.2,45.2],superior:[-87.5,47.6],superior_can:[-86,47.9],michigan:[-87,43.5],huron:[-82.5,44.8],erie:[-81,42.2],ontario:[-77.8,43.6],mich_land:[-85,43],moscow:[37.6,55.7],delhi:[77.2,28.6],belgrade:[20.5,44.8]};
for(const k in pts)console.log(' ',k,'hi',hf.filter(f=>geoContains(f,pts[k])).map(f=>f.id).join('+')||'-','lo',lf.filter(f=>geoContains(f,pts[k])).map(f=>f.id).join('+')||'-');
const list=[];let bytes=0;for(const f of fs.readdirSync(W+'/split')){if(!f.endsWith('.json'))continue;const t=JSON.parse(fs.readFileSync(W+'/split/'+f));const k=Object.keys(t.objects)[0];const a3=path.basename(f,'.json');const o=t.objects[k];if(o.geometries.length<2)continue;for(const g of o.geometries){g.id=g.properties.k;delete g.properties.a;delete g.properties.k}t.objects={r:o};const s=JSON.stringify(t);fs.writeFileSync(G+'/data/admin1/'+a3+'.json',s);list.push(a3);bytes+=s.length}
const chk=a3=>{const t=JSON.parse(fs.readFileSync(G+'/data/admin1/'+a3+'.json'));return t.objects.r.geometries.map(g=>g.properties.z||g.properties.n)};
console.log('CHN regions',chk('CHN').join(' '));console.log('SRB has Kosovo',chk('SRB').includes('科索沃'),'RUS has Donbas',chk('RUS').filter(s=>/顿涅茨克|卢甘斯克|克里米亚/.test(s)),'UKR',chk('UKR').filter(s=>/顿涅茨克|卢甘斯克|克里米亚|塞瓦/.test(s)),'IND Arunachal',chk('IND').filter(s=>/阿鲁纳/.test(s)));
const d=JSON.parse(fs.readFileSync(P+'/refd/cn.json')).features.find(f=>f.properties.adcode==='100000_JD');
const part=d.geometry.coordinates[0][0];const top=part.reduce((a,b)=>b[1]>a[1]?b:a),bot=part.reduce((a,b)=>b[1]<a[1]?b:a);console.log('tenth ends',top,bot);
const m=JSON.parse(fs.readFileSync(P+'/ne_10m_admin_0_boundary_lines_maritime_indicator_chn/out.json'));
const dashes=m.features.map(f=>f.geometry.coordinates.map(p=>[+p[0].toFixed(3),+p[1].toFixed(3)]));dashes.push([[+top[0].toFixed(2),+top[1].toFixed(2)],[+bot[0].toFixed(2),+bot[1].toFixed(2)]]);
const gj=JSON.parse(fs.readFileSync(W+'/gdr.json'));const gdr=[];for(const f of gj.features||gj.geometries||[gj]){const c=f.geometry||f;for(const l of (c.type==='LineString'?[c.coordinates]:c.coordinates))gdr.push(l.map(p=>[+p[0].toFixed(4),+p[1].toFixed(4)]))}
const NAMES2=JSON.parse(fs.readFileSync(W+'/adm2names.json'));const list2=[];let bytes2=0;for(const f of fs.readdirSync(W+'/a2split')){if(!f.endsWith('.json'))continue;const t=JSON.parse(fs.readFileSync(W+'/a2split/'+f));const k=Object.keys(t.objects)[0];const a3=path.basename(f,'.json');const o=t.objects[k];if(o.geometries.length<2)continue;for(const g of o.geometries){const base=String(g.properties.k).replace(/-[WE]$/,'');g.properties={s:g.properties.k,n:/-[WE]$/.test(g.properties.k)?g.properties.n:(NAMES2[base]??g.properties.n)}}
// fixed district codes: country code plus a number, in name order, so the same dataset always gives the same code
// units added later (Amt Neuhaus, '-AN') are numbered after the rest, so existing codes do not move
const late=g=>/-AN$/.test(g.properties.s)?1:0;
o.geometries.sort((x,y)=>late(x)-late(y)||x.properties.n.localeCompare(y.properties.n,'en')||(x.properties.s<y.properties.s?-1:1));
const width=Math.max(4,String(o.geometries.length).length);o.geometries.forEach((g,i)=>{g.id=a3+'-'+String(i+1).padStart(width,'0')});t.objects={r:o};const s=JSON.stringify(t);fs.writeFileSync(G+'/data/admin2/'+a3+'.json',s);list2.push(a3);bytes2+=s.length}
console.log('admin2 files',list2.length,'bytes',bytes2);
fs.writeFileSync(W+'/inline.json',JSON.stringify({topo:lo,names,admin:list,admin2:list2,dashes,gdr}));
console.log({admin:list.length,bytes,inline:fs.statSync(W+'/inline.json').size,dashes:dashes.length,hiBytes:fs.statSync(G+'/data/countries-10m.json').size});
