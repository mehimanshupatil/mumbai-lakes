// Regenerate public/og.jpg with the latest numbers so link previews always
// show today's stock. Draws over public/og-base.jpg (static map screenshot).
//
// Usage: node scripts/render-og.mjs
// Wired into .github/workflows/ingest.yml after a successful OCR.

import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile, writeFile } from 'node:fs/promises'

const W = 1200
const H = 630
const TOTAL_CAPACITY = 1447363
const DEMAND_MLD = 4173

const STATUS = (pct, days) =>
  pct < 20 || days < 60
    ? { label: 'CRITICAL', color: '#e05252' }
    : pct < 40 || days < 120
      ? { label: 'LOW', color: '#eab03e' }
      : { label: 'HEALTHY', color: '#58b878' }

const history = JSON.parse(await readFile('data/history.json', 'utf8'))
const latest = history[history.length - 1]
const pct = latest.totals.pctUseful
const days = Math.round(latest.totals.liveStorageML / DEMAND_MLD)
const status = STATUS(pct, days)
const dateText = new Date(`${latest.date}T00:00:00`).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const canvas = createCanvas(W, H)
const ctx = canvas.getContext('2d')

const base = await loadImage('public/og-base.jpg')
// cover-fit the base image
const scale = Math.max(W / base.width, H / base.height)
const bw = base.width * scale
const bh = base.height * scale
ctx.drawImage(base, (W - bw) / 2, (H - bh) / 2, bw, bh)

// bottom band
const band = 210
const grad = ctx.createLinearGradient(0, H - band - 60, 0, H)
grad.addColorStop(0, 'rgba(10, 36, 50, 0)')
grad.addColorStop(0.35, 'rgba(10, 36, 50, 0.75)')
grad.addColorStop(1, 'rgba(10, 36, 50, 0.95)')
ctx.fillStyle = grad
ctx.fillRect(0, H - band - 60, W, band + 60)

// headline
ctx.fillStyle = '#ffffff'
ctx.font = 'bold 84px DejaVu Sans, Helvetica, Arial, sans-serif'
ctx.fillText(`${pct.toFixed(1)}%`, 48, H - 96)
const pctWidth = ctx.measureText(`${pct.toFixed(1)}%`).width

// status chip
ctx.fillStyle = status.color
const chipX = 48 + pctWidth + 26
const chipY = H - 152
ctx.beginPath()
ctx.roundRect(chipX, chipY, 44 + status.label.length * 17, 52, 12)
ctx.fill()
ctx.fillStyle = '#ffffff'
ctx.font = 'bold 30px DejaVu Sans, Helvetica, Arial, sans-serif'
ctx.fillText(status.label, chipX + 22, chipY + 37)

ctx.fillStyle = 'rgba(255,255,255,0.92)'
ctx.font = '600 34px DejaVu Sans, Helvetica, Arial, sans-serif'
ctx.fillText(`Mumbai's lakes · ~${days} days of supply`, 48, H - 44)

ctx.fillStyle = 'rgba(255,255,255,0.7)'
ctx.font = '23px DejaVu Sans, Helvetica, Arial, sans-serif'
ctx.textAlign = 'right'
ctx.fillText(`BMC report ${dateText} · mumbai-lakes.himanshupatil.dev`, W - 40, H - 14)
ctx.textAlign = 'left'

await writeFile('public/og.jpg', await canvas.encode('jpeg', 84))
console.log(`og.jpg: ${pct.toFixed(1)}% ${status.label} · ${days} days · ${latest.date}`)
