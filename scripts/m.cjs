const W=process.env.WG_WORK;
const map=require(W+'/map.json');
exports.fix=p=>{const iso=p.iso_3166_2||'',a3=p.adm0_a3;let a=map[a3]||a3,k=iso&&!iso.includes('~')?iso:a3+'|'+p.name+'|'+(p.adm1_code||''),n=p.name_en||p.name,z=p.name_zh||'',c=p.postal||'';
 if(a3==='TWN'){a='CHN';k='CN-TW';n='Taiwan';z='台湾省';c='TW'}
 else if(a3==='HKG'){a='CHN';k='CN-HK';n='Hong Kong';z='香港特别行政区';c='HK'}
 else if(a3==='MAC'){a='CHN';k='CN-MO';n='Macau';z='澳门特别行政区';c='MO'}
 else if(a3==='PGA'||a3==='SCR'){a='CHN';k='CN-SCS';n='South China Sea Islands';z='南海诸岛';c=''}
 else if(a3==='GRL'){a='DNK'}
 else if(a3==='FRO'){a='DNK';k='FO';n='Faroe Islands';z='法罗群岛';c='FO'}
 else if(a3==='KOS'){a='SRB';k='RS-KOS';n='Kosovo';z='科索沃';c='KO'}
 else if(iso==='IN-AR'||iso==='CN-XZ'){a='CHN';k='CN-XZ';n='Xizang';z='西藏自治区';c='XZ'}
 else if(['UA-14','UA-09','UA-43','UA-40'].includes(iso)){a='RUS'}
 else if(iso.startsWith('UA-')){a='UKR'}
 return {a,k,n,z,c};};
exports.a0=x=>({HKG:'CHN',MAC:'CHN',SCR:'CHN',PGA:'CHN',GRL:'DNK',FRO:'DNK'}[x]||x);
const names=require(W+'/names.json');const codes=new Set(names.map(n=>n[0]));
const OVERLAP=new Set(['UKR','IND','USA','FIN','AUS','CYP','TWN','XKX']);
exports.adm2=(a,g)=>{if(a&&(OVERLAP.has(g)||!codes.has(g)))return a;if(codes.has(g))return g;if(a)return a;const m={TWN:'CHN',HKG:'CHN',MAC:'CHN',XKX:'SRB',KOS:'SRB'}[g]||g;return codes.has(m)?m:''};
