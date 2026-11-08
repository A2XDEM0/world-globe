#!/bin/bash
# Downloads the raw sources into raw/ (about 690 MB). Run once before prepare.sh.
set -e
R=$(cd "$(dirname "$0")/.." && pwd); P=$R/raw; mkdir -p $P; cd $P
NE=https://naciscdn.org/naturalearth/10m
for n in cultural/ne_10m_admin_0_countries_chn cultural/ne_10m_admin_1_states_provinces_lakes cultural/ne_10m_admin_0_boundary_lines_maritime_indicator_chn physical/ne_10m_lakes cultural/ne_10m_populated_places_simple; do
  b=$(basename $n); mkdir -p $b; curl -fsSL -o $b.zip $NE/$n.zip; unzip -qo $b.zip -d $b; rm $b.zip
done
mkdir -p cgaz && curl -fsSL -o cgaz/adm2.zip https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM2.zip && unzip -qo cgaz/adm2.zip -d cgaz && rm cgaz/adm2.zip
# East Germany 1951-1990 (OpenHistoricalMap relation 2692241, CC0)
mkdir -p ohm && curl -fsS -H 'User-Agent: world-globe/1.0' --data-urlencode 'data=[out:json][timeout:120];relation(2692241);out geom;' -o ohm/gdr.json https://overpass-api.openhistoricalmap.org/api/interpreter
# reference for the position of the tenth dash only
mkdir -p refd && curl -fsSL -o refd/cn.json https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
# elevation for the hypsometric tints: ETOPO 2022, 60 arc-seconds, ice surface (NOAA NCEI, public domain), about 466 MB
mkdir -p etopo && curl -fsSL -o etopo/ETOPO_2022_v1_60s_N90W180_surface.tif https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif
