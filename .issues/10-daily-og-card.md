# 10 — Daily OG card refresh

> **Status: ✅ Done (2026-07-10). scripts/render-og.mjs (@napi-rs/canvas) draws % + status chip + days over public/og-base.jpg (UI-free scene shot); wired into ingest.yml, og.jpg committed with each report. Stable URL — scraper cache lag accepted.** Static og.jpg ships today; this makes it self-updating.

## Goal

The link-preview image always shows today's number: after each successful
ingest, regenerate `public/og.jpg` with the current stock %, date and status
color, so WhatsApp/Twitter previews stay current without anyone touching them.

## Notes

- Simplest robust approach: a Node script (`scripts/render-og.mjs`) that draws
  the card with `@napi-rs/canvas` (no headless browser): brand background,
  big "48.6%" + status color, "Mumbai's lakes · ~169 days of supply · 9 Jul
  2026", small map thumbnail (use the committed static screenshot as the
  backdrop layer).
- Wire into `ingest.yml` after the OCR step: regenerate, `git add public/og.jpg`
  in the same commit.
- Cache busting: og:image URL with `?v=<date>` query — needs the meta tag to be
  templated at build time (Vite define) or use a stable URL and accept
  scrapers' cache lag (~7 days on WhatsApp). Decide during implementation.

## Acceptance

- After an ingest commit, `public/og.jpg` shows that day's % and date.
- Card renders correctly at 1200×630 in the Twitter/FB card validators.
