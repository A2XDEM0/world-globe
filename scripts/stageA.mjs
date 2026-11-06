import fs from 'fs';
const [P,W]=process.argv.slice(2);const load=n=>JSON.parse(fs.readFileSync(`${P}/${n}/out.json`));
const a0=load('ne_10m_admin_0_countries_chn');const a1=load('ne_10m_admin_1_states_provinces_lakes');
const inRing=(r,[x,y])=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [a,b]=r[i],[d,e]=r[j];if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)c=!c}return c};
const polys=g=>g?(g.type==='Polygon'?[g.coordinates]:g.coordinates):[];
const area=r=>{let s=0;for(let i=0,j=r.length-1;i<r.length;j=i++)s+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(s/2)};
const have=new Set(a0.features.map(f=>f.properties.ADM0_A3));
const missing={};for(const f of a1.features){const k=f.properties.adm0_a3;if(!have.has(k))(missing[k]=missing[k]||[]).push(f)}
const map={};
for(const k in missing){const votes={};for(const f of missing[k]){const biggest=polys(f.geometry).sort((a,b)=>area(b[0])-area(a[0]))[0];if(!biggest)continue;const r=biggest[0];let cx=0,cy=0;for(const p of r){cx+=p[0];cy+=p[1]}cx/=r.length;cy/=r.length;for(const u of a0.features){if(polys(u.geometry).some(p=>inRing(p[0],[cx,cy])&&!p.slice(1).some(h=>inRing(h,[cx,cy])))){votes[u.properties.ADM0_A3]=(votes[u.properties.ADM0_A3]||0)+1;break}}}
 map[k]=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0]?.[0]||null}
console.log('a1 units not in China view ->',JSON.stringify(map));
console.log('a0 CN props sample',['PGA','SCR','PFA','KAS','KOS'].map(k=>k+':'+have.has(k)).join(' '));
fs.writeFileSync(W+'/map.json',JSON.stringify(map));
const merged={HKG:'CHN',MAC:'CHN',SCR:'CHN',PGA:'CHN',GRL:'DNK'};
const OVER={CHN:['中国','China'],SPI:['南巴塔哥尼亚冰原'],IOA:['澳属印度洋领地'],KOR:['韩国'],PRK:['朝鲜']};
const names=a0.features.map(f=>f.properties).filter(p=>!merged[p.ADM0_A3]).map(p=>{const o=OVER[p.ADM0_A3]||[];return [p.ADM0_A3,o[0]||p.NAME_ZH||p.NAME,o[1]||p.NAME]});
fs.writeFileSync(W+'/names.json',JSON.stringify(names));console.log('names',names.length);
