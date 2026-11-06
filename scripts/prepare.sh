#!/bin/bash
# Derives the small inputs build.sh needs from raw/. Run after fetch-data.sh.
set -e
R=$(cd "$(dirname "$0")/.." && pwd); P=$R/raw; W=$R/work; MS=$R/node_modules/mapshaper/bin/mapshaper
mkdir -p $W
m(){ node --max-old-space-size=9000 $MS "$@" 2>&1 | grep -vE "^\[o\]|Allocating" || true; }
for n in ne_10m_admin_0_countries_chn ne_10m_admin_1_states_provinces_lakes ne_10m_admin_0_boundary_lines_maritime_indicator_chn; do
  m $P/$n/$n.shp -o $P/$n/out.json format=geojson
done
# Donbas and Crimea, cut from Ukraine and given to Russia
m $P/ne_10m_admin_1_states_provinces_lakes/ne_10m_admin_1_states_provinces_lakes.shp -filter "['UA-14','UA-09','UA-43','UA-40'].indexOf(iso_3166_2)>=0" -dissolve -o $W/donbas.shp
# lakes that form country borders become holes
m $P/ne_10m_lakes/ne_10m_lakes.shp -filter "admin=='admin-0'" -filter-fields name -o $W/lakes0.shp
node $R/scripts/ohm.mjs $P $W
node -e "const fs=require('fs');const o=JSON.parse(fs.readFileSync('$W/gdr-line.json'));fs.writeFileSync('$W/gdr.json',JSON.stringify({type:'MultiLineString',coordinates:[o.border,...o.westBerlin]}))"
# district names have mixed encodings in the source; decode each record on its own
node $R/scripts/dbfnames.mjs $P/cgaz/geoBoundariesCGAZ_ADM2.dbf $W/adm2names.json
