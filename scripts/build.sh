#!/bin/bash
# Builds dist/data from raw/ and work/. Run after prepare.sh, then node scripts/assemble.mjs.
set -e
R=$(cd "$(dirname "$0")/.." && pwd); P=$R/raw; W=$R/work; G=$R/dist; MS=$R/node_modules/mapshaper/bin/mapshaper; WB=$W/westberlin.json
export WG_WORK=$W
m(){ node --max-old-space-size=9000 $MS "$@" 2>&1 | grep -vE "^\[o\]|Allocating|Retained|join\]|Warning|Sample of|^  |To set|To list|^$" || true; }
A0=$P/ne_10m_admin_0_countries_chn/ne_10m_admin_0_countries_chn.shp; A1=$P/ne_10m_admin_1_states_provinces_lakes/ne_10m_admin_1_states_provinces_lakes.shp
rm -rf $G $W/split $W/a2split; mkdir -p $G/data/admin1 $G/data/admin2 $W/split $W/a2split
node $R/scripts/stageA.mjs $P $W | grep names
# the Diaoyu Islands (钓鱼岛及其附属岛屿): Natural Earth's first level files them under Okinawa; they go to China, as part of Taiwan
m $A1 -filter "iso_3166_2=='JP-47'" -explode -filter "this.centroidX>123.3&&this.centroidX<124.8&&this.centroidY>25.5&&this.centroidY<26.2" -each "a='CHN'" -filter-fields a -o $W/diaoyu.shp
m -i $A0 $W/donbas.shp $W/diaoyu.shp combine-files -require $R/scripts/m.cjs alias=M -target 1 name=world -each "a=M.a0(ADM0_A3)" -filter-fields a -erase target=world source=donbas -target donbas -each "a='RUS'" -merge-layers target=world,donbas,diaoyu force name=m -dissolve2 a -erase $W/lakes0.shp -o $W/a0.shp
m $W/a0.shp name=countries -o $G/data/countries-10m.json format=topojson id-field=a quantization=100000
m $W/a0.shp name=countries -simplify dp 14% keep-shapes -o $W/lo.json format=topojson id-field=a quantization=30000
m $A1 -require $R/scripts/m.cjs alias=M -each "var r=M.fix(this.properties);a=r.a;k=r.k;n=r.n;z=r.z;c=r.c" -filter-fields a,k,n,z,c -dissolve k copy-fields=a,n,z,c -o $W/a1.shp
m $W/a1.shp -filter "k=='JP-47'||k=='CN-TW'" -explode -each "if(k=='JP-47'&&this.centroidX>123.3&&this.centroidX<124.8&&this.centroidY>25.5&&this.centroidY<26.2){a='CHN';k='CN-TW';n='Taiwan';z='台湾省';c='TW'}" -dissolve k copy-fields=a,n,z,c -o $W/a1dy.shp
m $W/a1.shp -filter "k!='JP-47'&&k!='CN-TW'" -o $W/a1r.shp
m -i $W/a1r.shp $W/a1dy.shp combine-files -merge-layers force name=a1 -o $W/a1m.shp
m $W/a1m.shp -filter "k=='DE-BE'" -clip $WB -each "k='DE-BE-W',n='West Berlin',z='西柏林',c='BW'" -o $W/beW.shp
m $W/a1m.shp -filter "k=='DE-BE'" -erase $WB -each "k='DE-BE-E',n='East Berlin',z='东柏林',c='BO'" -o $W/beE.shp
m $W/a1m.shp -filter "k!='DE-BE'" -o $W/a1x.shp
m -i $W/a1x.shp $W/beW.shp $W/beE.shp combine-files -merge-layers force name=a1b -o $W/a1b.shp
m -i $P/cgaz/geoBoundariesCGAZ_ADM2.shp name=adm2 -require $R/scripts/m.cjs alias=M -simplify interval=250 keep-shapes -join $W/lo.json fields=a largest-overlap -each "a=M.adm2(a,shapeGroup),k=shapeID,n=shapeName" -filter "a!=''" -filter-fields a,k,n -o $W/adm2.shp
m $W/adm2.shp -filter "a=='DEU'&&k=='9070358B20892132820961'" -clip $WB -each "k=k+'-W',n='West Berlin'" -o $W/b2W.shp
m $W/adm2.shp -filter "a=='DEU'&&k=='9070358B20892132820961'" -erase $WB -each "k=k+'-E',n='East Berlin'" -o $W/b2E.shp
m $W/adm2.shp -filter "!(a=='DEU'&&k=='9070358B20892132820961')" -o $W/adm2x.shp
m -i $W/adm2x.shp $W/b2W.shp $W/b2E.shp combine-files -merge-layers force name=adm2b -o $W/adm2b.shp
# German regions meet exactly on the 1951–1990 border, and Amt Neuhaus becomes its own region (scripts/gdr-align.mjs)
m $W/a1b.shp -filter "a=='DEU'" -o $W/deu1.json format=geojson
m $W/adm2b.shp -filter "a=='DEU'" -o $W/deu2.json format=geojson
node $R/scripts/gdr-align.mjs $W
m $W/a1b.shp -filter "a!='DEU'" -o $W/a1n.shp
m -i $W/deu1a.json snap-interval=0.00001 -o $W/deu1s.json format=geojson
m -i $W/a1n.shp $W/deu1s.json combine-files -merge-layers force name=a1c -o $W/a1c.shp
m $W/adm2b.shp -filter "a!='DEU'" -o $W/adm2n.shp
m -i $W/deu2a.json snap-interval=0.00001 -o $W/deu2s.json format=geojson
m -i $W/adm2n.shp $W/deu2s.json combine-files -merge-layers force name=adm2c -o $W/adm2c.shp
m $W/a1c.shp -split a -o singles $W/split/ format=topojson quantization=50000
m $W/a1c.shp -filter-fields a -innerlines where='A.a==B.a' -o $W/l.shp
m $W/l.shp name=lines -simplify interval=2000 -o $G/data/admin1-hi.json format=topojson quantization=60000
m $W/l.shp name=lines -simplify interval=20000 -o $G/data/admin1-lo.json format=topojson quantization=20000
m $W/adm2c.shp -filter-fields a,k,n -split a -o singles $W/a2split/ format=topojson quantization=100000
node $R/scripts/stageC.mjs $P $W $G 2>&1 | grep -E "features|winding|admin|greenland|denmark" | cut -c1-200
node "$R/scripts/flags.mjs"
# elevation bands for the hypsometric tints (ETOPO 2022, one arc-minute)
node "$R/scripts/hypso.mjs" "$P/etopo" "$G/data/hypso"
node "$R/scripts/assemble.mjs"
