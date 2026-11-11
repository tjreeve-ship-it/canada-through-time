#!/usr/bin/env bash
# Build web-ready geography from Natural Earth (public domain).
# Projection: Statistics Canada Lambert Conformal Conic (EPSG:3347 parameters, NAD83).
set -euo pipefail
cd "$(dirname "$0")/.."
MS=node_modules/.bin/mapshaper
RAW=data/raw/naturalearth
OUT=web/data
mkdir -p "$OUT" data/processed
LCC='+proj=lcc +lat_1=49 +lat_2=77 +lat_0=63.390675 +lon_0=-91.86666666666666 +x_0=6200000 +y_0=3000000 +datum=NAD83 +units=m +no_defs'

# Provinces and territories (current boundaries), keyed by StatCan abbreviation
$MS -i $RAW/ne_10m_admin_1_states_provinces.geojson \
  -filter 'iso_a2 === "CA"' \
  -each 'abbr = postal, name_en = name === "Québec" ? "Quebec" : name' \
  -filter-fields abbr,name_en \
  -simplify 8% keep-shapes \
  -filter-islands min-area=40km2 \
  -proj "$LCC" \
  -each 'lx = this.innerX, ly = this.innerY' \
  -o precision=100 format=geojson $OUT/provinces.geojson

# Pre-July-1991 geography: StatCan only publishes NT and NU combined, so dissolve them.
$MS -i $OUT/provinces.geojson \
  -filter '"NT,NU".indexOf(abbr) > -1' \
  -dissolve copy-fields=abbr \
  -each 'abbr = "NT+NU", name_en = "Northwest Territories incl. Nunavut", lx = this.innerX, ly = this.innerY' \
  -o format=geojson $OUT/ntnu_combined.geojson

# Context: neighbouring countries, lakes, rivers
$MS -i $RAW/ne_50m_admin_0_countries.geojson \
  -filter 'ISO_A3 !== "CAN"' -clip bbox=-170,30,-30,85 -filter-fields NAME \
  -proj "$LCC" -o precision=100 format=geojson $OUT/context_countries.geojson
$MS -i $RAW/ne_50m_lakes.geojson -clip bbox=-145,40,-50,84 -filter-fields name \
  -proj "$LCC" -o precision=100 format=geojson $OUT/lakes.geojson
$MS -i $RAW/ne_50m_rivers_lake_centerlines.geojson -clip bbox=-145,40,-50,84 -filter-fields name \
  -proj "$LCC" -o precision=100 format=geojson $OUT/rivers.geojson
ls -la $OUT
