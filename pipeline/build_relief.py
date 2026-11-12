"""Shaded relief overlay for the explorer map (physical-geography context only; carries no statistic).

Source: Natural Earth "Shaded Relief Basic", 1:50m, v2.0.0 (SR_50M.tif, 10,800 x 5,400 px, 2 arc-minutes,
        about 3.7 km per pixel at the equator). Public domain. Natural Earth derived it from downsampled
        SRTM Plus elevation data; small islands were embossed by its authors.
Process: for every 3 km cell of a StatCan Lambert (EPSG:3347) grid over Canada, look up the source pixel
        (bilinear), keep cells inside the province polygons used by the map, and write a transparent PNG:
        black where the relief is darker than flat ground, white where lighter, alpha = strength.
        Nothing is invented or exaggerated beyond a linear contrast stretch around the flat-ground grey.
        The 3 km grid is only a convenient cell size close to the source's own (2 arc-minutes: about 3.7 km north-south,
        1.3-2.4 km east-west across Canada). Resampling adds no detail beyond the source.
Output: web/data/relief/relief_canada_3km.png + relief.json (bounds in km, provenance).
"""
import json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data/raw/naturalearth/SR_50M.tif"
OUT = ROOT / "web/data/relief"
CELL = 3000.0                                  # metres
X0, X1, Y0, Y1 = 3660000, 9040000, 630000, 5270000   # province extent + margin (EPSG:3347 metres)

def main():
    src = np.asarray(Image.open(SRC).convert("L"), dtype=np.float32)
    H, W = src.shape
    nx, ny = int((X1 - X0) / CELL), int((Y1 - Y0) / CELL)
    xs = X0 + (np.arange(nx) + 0.5) * CELL
    ys = Y1 - (np.arange(ny) + 0.5) * CELL
    gx, gy = np.meshgrid(xs, ys)
    lon, lat = Transformer.from_crs(3347, 4326, always_xy=True).transform(gx, gy)
    px = (lon + 180.0) / 360.0 * W - 0.5
    py = (90.0 - lat) / 180.0 * H - 0.5
    x0 = np.clip(np.floor(px).astype(int), 0, W - 2); y0 = np.clip(np.floor(py).astype(int), 0, H - 2)
    fx, fy = np.clip(px - x0, 0, 1), np.clip(py - y0, 0, 1)
    g = (src[y0, x0] * (1 - fx) * (1 - fy) + src[y0, x0 + 1] * fx * (1 - fy) + src[y0 + 1, x0] * (1 - fx) * fy + src[y0 + 1, x0 + 1] * fx * fy)
    # land mask from the map's own province polygons
    mask = Image.new("L", (nx, ny), 0); d = ImageDraw.Draw(mask)
    for f in json.loads((ROOT / "web/data/provinces.geojson").read_text())["features"]:
        polys = [f["geometry"]["coordinates"]] if f["geometry"]["type"] == "Polygon" else f["geometry"]["coordinates"]
        for poly in polys:
            d.polygon([((x - X0) / CELL, (Y1 - y) / CELL) for x, y in poly[0]], fill=255)
            for hole in poly[1:]: d.polygon([((x - X0) / CELL, (Y1 - y) / CELL) for x, y in hole], fill=0)
    m = np.asarray(mask) > 0
    flat = float(np.median(g[m]))               # grey of flat ground in the source
    dev = (g - flat) / 255.0
    alpha = np.clip(np.abs(dev) * 2.6, 0, 1) * m
    rgba = np.zeros((ny, nx, 4), dtype=np.uint8)
    rgba[..., :3] = np.where(dev[..., None] > 0, 255, 0)
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(OUT / "relief_canada_3km.png", optimize=True)
    meta = {"source_id": "naturalearth_sr50m", "bounds_km": [X0 / 1e3, Y0 / 1e3, X1 / 1e3, Y1 / 1e3], "cell_km": CELL / 1e3, "size": [nx, ny], "flat_grey": round(flat, 1),
            "raw_sha256": hashlib.sha256(SRC.read_bytes()).hexdigest(),
            "note": "Generalised shaded relief for physical-geography context. It does not represent the selected statistic. The 3 km grid adds no detail beyond the 2 arc-minute source."}
    (OUT / "relief.json").write_text(json.dumps(meta, indent=1))
    print(nx, ny, "flat grey", round(flat, 1), "land cells", int(m.sum()), (OUT / "relief_canada_3km.png").stat().st_size // 1024, "KB")

if __name__ == "__main__":
    main()
