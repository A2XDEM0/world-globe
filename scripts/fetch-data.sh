#!/bin/bash
# Downloads the raw sources into raw/ (about 1.8 GB). Run once before prepare.sh.
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
# elevation for the hypsometric tints: ETOPO 2022, 30 arc-seconds, ice surface (NOAA NCEI, public domain), about 1.6 GB
mkdir -p etopo && curl -fsSL -o etopo/ETOPO_2022_v1_30s_N90W180_surface.tif https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/30s/30s_surface_elev_gtif/ETOPO_2022_v1_30s_N90W180_surface.tif
# rivers and lake centre lines, 1:10m (Natural Earth, public domain)
mkdir -p ne_10m_rivers_lake_centerlines_scale_rank && curl -fsSL -o rivers.zip $NE/physical/ne_10m_rivers_lake_centerlines_scale_rank.zip && unzip -qo rivers.zip -d ne_10m_rivers_lake_centerlines_scale_rank && rm rivers.zip
# shipping traffic density, AIS 2015–2021, 0.005° (IMF World Seaborne Trade Monitoring System via the World Bank, CC BY 4.0), about 535 MB
mkdir -p ships && curl -fsSL -o ships/shipdensity_global.zip https://datacatalogfiles.worldbank.org/ddh-published/0037580/5/DR0045406/shipdensity_global.zip && unzip -qo ships/shipdensity_global.zip -x "*.ovr" -d ships && rm ships/shipdensity_global.zip
# night lights: Black Marble 2016, grayscale, 15 arc-seconds in eight 90° tiles (NASA Earth Observatory, Suomi NPP VIIRS), about 175 MB
mkdir -p lights && for t in A1 A2 B1 B2 C1 C2 D1 D2; do curl -fsSL -o lights/BlackMarble_2016_${t}_geo_gray.tif https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_${t}_geo_gray.tif; done
