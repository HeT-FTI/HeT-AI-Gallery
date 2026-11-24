# Gallery project logos

Gallery logos use transparent PNG sources with `object-fit: contain`. New sources should be at least **512×512** so featured cards remain sharp on high-DPI displays. IE uses the original **2048×2048 RGBA** render of `ALL_title_card.svg`; historical 128px assets remain valid for other projects.

Source priority:

1. `docs/<name>/_static/OUT_logo.png`
2. `docs/<name>/_static/OUT_logo.svg`
3. `docs/<name>/_images/OUT_logo.png`
4. `docs/<name>/_images/OUT_logo_reshape.png`
5. `docs/<name>/_static/ALL_logo.*` (favicon fallback only)

`ALL_logo` is the favicon-sized asset, not the primary project logo.

Normalization command used for raster sources:

```bash
convert -background none <source> \
  -trim +repage \
  -resize 120x120 \
  -gravity center \
  -background none \
  -extent 128x128 \
  assets/logos/<name>.png
```

When replacing a logo, also bump `site.assetVersion` in `_config/gallery.json`; the renderer
appends it to local image URLs, otherwise browsers keep showing the old favicon from cache.

Current exceptions:

- `foc`: `docs/foc/_static/OUT_logo.png` (300×300) — replaces the old `ALL_logo.png` 64×64 source.
- `idsp`: `docs/idsp/_images/OUT_logo.png` (200×200) — real OUT logo; wide wordmark, so its rendered height is smaller inside the square tile.
- `objvoxel` / `nnpid`: a unique `ALL_logo` is still used because their `OUT_logo.svg` is a very large pixel-art SVG (12.7MB / 7.4MB) that is impractical to rasterize in this preview step.
- Projects with only a shared placeholder `OUT_logo.svg` / `ALL_logo.jpg` keep the existing fallback until their repositories provide a real `OUT_logo`.
