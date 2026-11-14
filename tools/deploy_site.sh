#!/usr/bin/env bash
# Publish site/ to GitHub Pages (the gh-pages branch). Build first: python tools/build_site.py
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; TMP="$(mktemp -d)"
git clone -q --depth 1 -b gh-pages "$(git -C "$ROOT" remote get-url origin)" "$TMP"
find "$TMP" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -r "$ROOT/site/." "$TMP/"
cd "$TMP" && git add -A && git commit -qm "Publish site (built from $(git -C "$ROOT" rev-parse --short HEAD))" && git push -q origin gh-pages
echo "published; GitHub Pages updates in about a minute"
