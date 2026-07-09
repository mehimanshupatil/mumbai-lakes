# Mumbai Water Supply — live 3D map

Stylized 3D visualization of the seven lakes that supply Mumbai's water, on real
terrain, updated daily from BMC's lake-level report.

**Live:** https://mumbai-lakes.himanshupatil.dev/

- Real elevation (AWS Terrain Tiles), real district boundaries (geoBoundaries),
  real river courses and reservoir locations (OpenStreetMap)
- Water levels, rainfall, 3-year comparisons from BMC's daily 6 AM report
- Supply network per BMC documents: Upper → Middle Vaitarna → Modak Sagar by
  river, then mains from Modak Sagar / Tansa / Bhatsa / Tulsi / Vihar to the
  Bhandup Complex, fanning out to the city's distribution zones

## The daily 30-second ritual

BMC's Hydraulic Engineer's Department posts the report as an image (no API).

1. Save the report image from the BMC tweet.
2. Upload it to `data/inbox/` — the GitHub mobile app works: Add file → Upload.
3. Done. The **Ingest** Action OCRs it (OpenAI API), cross-checks every number
   (lake sums vs printed total, % vs storage÷capacity, levels vs FSL/LDL,
   duplicate dates), appends to `data/history.json`, archives the image, and
   the site redeploys.

If validation fails you get a failed-Action email and the image stays in the
inbox. Fallback: edit `data/history.json` by hand (schema in `PRD.md`) and
delete the image.

## One-time setup

1. **Repo secret** — Settings → Secrets and variables → Actions → New repository
   secret: name `OPENAI_API_KEY`, value = your OpenAI API key.
2. **Pages** — Settings → Pages → Source: **GitHub Actions**.

## Development

```sh
npm install
npm run dev      # http://localhost:5173/
npm run build    # typecheck + production build
```

### Data scripts (outputs are committed; re-run only to regenerate)

```sh
node scripts/fetch-terrain.mjs    # DEM → public/terrain/heights.bin (+meta)
node scripts/fetch-districts.mjs  # district boundaries → src/assets/districts.json
node scripts/fetch-rivers.mjs     # river courses → src/assets/rivers.json
node scripts/ocr.mjs <img|dir>    # ingest report image(s) locally
node scripts/ocr.mjs --dry-run    # re-validate all of history.json, no API
```

## Sources

- Daily numbers: BMC Hydraulic Engineer's Department lake-level report
- Supply shares/history: BMC "contribution per 100 litre" chart, Mumbai City
  Development Plan 2005–2025 §13.1 (`data/water supply mumbai bmc.pdf`,
  curated in `data/notes-bmc-cdp.md`), Arghyam network diagram (`data/map/`)
- Elevation: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) ·
  Boundaries: [geoBoundaries](https://www.geoboundaries.org) ·
  Rivers/reservoirs: © OpenStreetMap contributors

Approximate visualization — not an official BMC product.
