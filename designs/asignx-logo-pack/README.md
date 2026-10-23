# ASignX AX Logo Pack

Selected direction: option 2, the interwoven AX monogram.

## Start here

- `exports/horizontal/color/asignx-horizontal-color.svg`: primary website logo.
- `exports/stacked/color/asignx-stacked-color.svg`: centered or square compositions.
- `exports/symbol/color/asignx-symbol-color.svg`: standalone AX symbol.
- `exports/wordmark/color/asignx-wordmark-color.svg`: lettering only.
- `previews/logo-pack-overview.png`: visual comparison sheet.
- `app-icons/`: browser, PWA, Apple touch, Windows, and macOS icon assets.

## Layouts and colors

Four layouts: horizontal, stacked, symbol, and wordmark.

Each has six treatments:

| Folder | Treatment | Background |
| --- | --- | --- |
| color | Cobalt/yellow symbol, navy lettering | Light |
| reverse | Cobalt/yellow symbol, white lettering | Dark |
| navy | Single navy color | Light |
| cobalt | Single cobalt color | Light |
| black | Single black color | Light |
| white | Single white color | Dark |

The symbol in `color` and `reverse` is intentionally the same. The wordmark in `color` and `navy` is also intentionally the same.

## File formats

| Format | Use |
| --- | --- |
| SVG | Scalable web artwork and editing in vector design tools |
| PDF | Scalable outlined artwork for documents and print workflows |
| EPS | Vector artwork for legacy design and production workflows |
| PNG | Transparent images for websites, slides, and documents |
| WebP | Lossless transparent web images |
| JPG | Flattened images on a suitable light or navy background |
| TIFF | High-resolution, LZW-compressed raster artwork with 300 ppi metadata |
| ICO | Windows/browser favicon, containing 16, 32, 48, 64, 128, and 256 px versions |
| ICNS | macOS icon container, containing 128, 256, 512, and 1024 px versions |

PNG widths: 512, 1024, 2048, and 4096 px for horizontal, stacked, and wordmark layouts; 256, 512, 1024, and 2048 px for the standalone symbol. Dimensions include clear space. WebP and JPG exports are 2048 px wide; TIFF exports are 4096 px wide.

SVG, PDF, EPS, PNG, WebP, and TIFF logo exports have no background rectangle. White variants may appear blank when opened against a white viewer background. JPG files are deliberately flattened: white for normal treatments and navy for white/reverse treatments.

## App and browser assets

Light, dark, and cobalt-background icons are supplied at 16, 32, 48, 64, 128, 180, 192, 256, 512, and 1024 px. The full-bleed square backgrounds have no baked-in corner radius, so the operating system can apply its own mask. Additional 192 and 512 px maskable icons use a larger safe area.

- `apple-touch-icon.png`: 180 px light icon.
- `favicon-light.ico`, `favicon-dark.ico`, `favicon-blue.ico`: multi-size icons.
- `app-icon-light.icns`, `app-icon-dark.icns`, `app-icon-blue.icns`: macOS containers.
- `site.webmanifest`: sample PWA manifest. Adjust icon URLs and the start URL for your deployment.

## Brand colors

- Cobalt: `#2962F5`
- Yellow: `#FFE66D`
- Navy: `#18294C`
- White: `#FFFFFF`
- Black: `#000000`

Preserve the supplied proportions and clear space. Use the horizontal color logo on light backgrounds and the reverse logo on dark backgrounds. Use single-color versions for processes that cannot reproduce multiple colors. At very small sizes, prefer the symbol over the full wordmark.

## Source and production notes

The selected raster concept was prepared as a transparent master using the built-in image generation tool. All layouts are derived from one vector trace to keep the emblem and lettering consistent. Editable contours and outlined letterforms are included; no font installation is required. The trace closely follows the chosen concept, with normalized brand colors and minor contour differences from the raster reference.

`source/GENERATION.md` records the exact image-generation prompt. `source/vector-paths.json` stores the canonical contour data. `source/generated-transparent-master.png` preserves the generated image.

These are RGB/sRGB design exchange assets, not a printer-specific CMYK or spot-color proof. Ask the print provider to convert using the target press/material profile. No native Adobe Illustrator or Photoshop project is claimed; SVG/PDF/EPS are the editable exchange formats.

The website has not been changed as part of this export task.
