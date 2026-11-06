import fs from 'fs';
const [P,W]=process.argv.slice(2);
const r=JSON.parse(fs.readFileSync(P+'/ohm/gdr.json')).elements[0];
const key=p=>p[0].toFixed(7)+','+p[1].toFixed(7);
function rings(role){
  const ways=r.members.filter(m=>m.type==='way'&&m.role===role).map(m=>m.geometry.map(g=>[g.lon,g.lat]));
  const out=[];const left=ways.slice();
  while(left.length){let ring=left.shift().slice();let grown=true;
    while(key(ring[0])!==key(ring[ring.length-1])&&grown){grown=false;
      for(let i=0;i<left.length;i++){const w=left[i],end=key(ring[ring.length-1]);
        if(key(w[0])===end){ring=ring.concat(w.slice(1));left.splice(i,1);grown=true;break}
        if(key(w[w.length-1])===end){ring=ring.concat(w.slice().reverse().slice(1));left.splice(i,1);grown=true;break}}}
    out.push({ring,closed:key(ring[0])===key(ring[ring.length-1])})}
  return out}
const outer=rings('outer'),inner=rings('inner');
console.log('outer rings',outer.map(o=>o.ring.length+(o.closed?'':'(open)')),'inner rings',inner.map(o=>o.ring.length+(o.closed?'':'(open)')));
const main=outer.sort((a,b)=>b.ring.length-a.ring.length)[0].ring.slice(0,-1);
const near=t=>{let bi=0,bd=1e9;main.forEach((p,i)=>{const d=(p[0]-t[0])**2+(p[1]-t[1])**2;if(d<bd){bd=d;bi=i}});return [bi,Math.sqrt(bd)]};
const [a,da]=near([10.88,53.96]),[b,db]=near([12.10,50.32]);console.log('anchors',a,da.toFixed(3),b,db.toFixed(3));
const arc=(i,j)=>{const o=[];for(let k=i;;k=(k+1)%main.length){o.push(main[k]);if(k===j)break}return o};
const A1=arc(a,b),A2=arc(b,a);const mean=x=>x.reduce((s,p)=>s+p[0],0)/x.length;
const border=mean(A1)<mean(A2)?A1:A2;
const bb=l=>{let q=[99,99,-99,-99];for(const p of l)q=[Math.min(q[0],p[0]),Math.min(q[1],p[1]),Math.max(q[2],p[0]),Math.max(q[3],p[1])];return q.map(v=>v.toFixed(2)).join(',')};
console.log('inner-German border pts',border.length,'bbox',bb(border));
const wb=inner.filter(o=>o.closed).map(o=>o.ring);console.log('west berlin rings',wb.map(x=>x.length+' '+bb(x)));
const round=l=>l.map(p=>[+p[0].toFixed(5),+p[1].toFixed(5)]);
fs.writeFileSync(W+'/gdr-line.json',JSON.stringify({border:round(border),westBerlin:wb.map(round)}));
// West Berlin polygon for splitting Berlin (shapefile-style clockwise outer rings)
const area=r=>{let s=0;for(let i=0,j=r.length-1;i<r.length;j=i++)s+=(r[j][0]-r[i][0])*(r[j][1]+r[i][1]);return s};
const cw=r=>area(r)>0?r:r.slice().reverse();
fs.writeFileSync(W+'/westberlin.json',JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'West Berlin'},geometry:{type:'MultiPolygon',coordinates:wb.map(x=>[cw(x)])}}]}));
// the whole GDR as one polygon with West Berlin as a hole, so German regions can be lined up with the border (scripts/gdr-align.mjs)
fs.writeFileSync(W+'/gdr-area.json',JSON.stringify({type:'Polygon',coordinates:[main.concat([main[0]]),...wb]}));
