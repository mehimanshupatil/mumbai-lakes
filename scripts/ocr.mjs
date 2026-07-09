// OCR a BMC daily lake-level report image into data/history.json (OpenAI vision).
//
// Usage:
//   OPENAI_API_KEY=... node scripts/ocr.mjs data/inbox/report.png   # single image
//   OPENAI_API_KEY=... node scripts/ocr.mjs data/inbox              # every image in a folder (batch)
//   node scripts/ocr.mjs --dry-run                                  # re-validate history.json, no API
//
// Model override: OPENAI_MODEL (default gpt-4o)
//
// On success: appends the record (sorted by date), moves the image to
// data/archive/<date>.<ext>. On any validation failure: exits non-zero and
// leaves the image where it is.

import { readFile, writeFile, readdir, rename, mkdir } from 'node:fs/promises'
import { extname, join, basename } from 'node:path'
import { statSync } from 'node:fs'

const HISTORY = 'data/history.json'
const ARCHIVE = 'data/archive'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

// static per-lake truth for validation (mirrors src/config/lakes.ts)
const LAKES = {
  upper_vaitarna: { fslUsefulML: 227047, fslM: 603.51, ldlM: 595.44 },
  modak_sagar: { fslUsefulML: 128925, fslM: 163.15, ldlM: 143.26 },
  tansa: { fslUsefulML: 145080, fslM: 128.63, ldlM: 118.87 },
  middle_vaitarna: { fslUsefulML: 193530, fslM: 285.0, ldlM: 220.0 },
  bhatsa: { fslUsefulML: 717037, fslM: 142.07, ldlM: 104.9 },
  vehar: { fslUsefulML: 27698, fslM: 80.12, ldlM: 73.92 },
  tulsi: { fslUsefulML: 8046, fslM: 139.17, ldlM: 131.07 },
}
const LAKE_KEYS = Object.keys(LAKES)

const RECORD_SCHEMA = {
  type: 'object',
  required: ['date', 'reportTime', 'totals', 'lakes', 'remarks'],
  properties: {
    date: { type: 'string', description: 'Report date as YYYY-MM-DD (the table header says e.g. "09-07-2026" = 2026-07-09)' },
    reportTime: { type: 'string', description: 'Report time, e.g. "06:00"' },
    totals: {
      type: 'object',
      required: ['liveStorageML', 'pctUseful', 'previousYears'],
      properties: {
        liveStorageML: { type: 'number' },
        pctUseful: { type: 'number' },
        previousYears: {
          type: 'array',
          items: {
            type: 'object',
            required: ['year', 'liveStorageML', 'pctUseful'],
            properties: {
              year: { type: 'number' },
              liveStorageML: { type: 'number' },
              pctUseful: { type: 'number' },
            },
          },
        },
      },
    },
    lakes: {
      type: 'object',
      required: LAKE_KEYS,
      properties: Object.fromEntries(
        LAKE_KEYS.map((k) => [
          k,
          {
            type: 'object',
            required: ['levelM', 'rise24hM', 'liveStorageML', 'pctUseful', 'rainTodayMm', 'rainSeasonMm', 'previousYears'],
            properties: {
              levelM: { type: 'number' },
              rise24hM: { type: 'number' },
              liveStorageML: { type: 'number' },
              pctUseful: { type: 'number' },
              rainTodayMm: { type: 'number' },
              rainSeasonMm: { type: 'number' },
              previousYears: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['year', 'levelM', 'liveStorageML', 'pctUseful'],
                  properties: {
                    year: { type: 'number' },
                    levelM: { type: 'number' },
                    liveStorageML: { type: 'number' },
                    pctUseful: { type: 'number' },
                  },
                },
              },
            },
          },
        ]),
      ),
    },
    remarks: { type: 'array', items: { type: 'string' } },
  },
}

const PROMPT = `This is the Hydraulic Engineer's Department daily "Report of Lake Levels" table for Mumbai's seven supply lakes.

Extract EVERY number exactly as printed into the record_lake_report tool.

Mapping notes:
- Lake rows appear as UPPER VAITARNA, MODAK SAGAR, TANSA, MIDDLE VAITARNA, BHATSA, VEHAR, TULSI → keys upper_vaitarna, modak_sagar, tansa, middle_vaitarna, bhatsa, vehar, tulsi.
- Each lake has 3 year-rows: the current year row fills the main fields; the two older rows go into previousYears (levelM = "LEVEL IN MTR" column, liveStorageML = "USEFUL CONTENT (LIVE STORAGE) IN ML", pctUseful = "% USEFUL CONTENT OF LIVE STORAGE").
- rise24hM = "LAST 24 HRS RISE/FALL IN MTR" (negative if a fall is indicated).
- rainTodayMm = "TODAY'S RAIN FALL", rainSeasonMm = "TOTAL RAIN FALL".
- totals = the bottom TOTAL block (current year + two previous years). Ignore the intermediate "TOTAL OF UPPER VAITARNA + ..." block.
- remarks = every numbered remark line below the table, verbatim.
- date: the header "Report of Lake Levels at HH:MM AM on DD-MM-YYYY" → date YYYY-MM-DD, reportTime HH:MM.`

export function validateRecord(rec, history) {
  const errs = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.date) || isNaN(Date.parse(rec.date)))
    errs.push(`bad date: ${rec.date}`)
  if (history.some((h) => h.date === rec.date)) errs.push(`date ${rec.date} already in history`)

  let sum = 0
  for (const key of LAKE_KEYS) {
    const l = rec.lakes[key]
    if (!l) {
      errs.push(`missing lake ${key}`)
      continue
    }
    sum += l.liveStorageML
    const cfg = LAKES[key]
    const pctCalc = (l.liveStorageML / cfg.fslUsefulML) * 100
    if (Math.abs(pctCalc - l.pctUseful) > 0.5)
      errs.push(`${key}: printed ${l.pctUseful}% but storage/capacity = ${pctCalc.toFixed(2)}%`)
    if (l.levelM < cfg.ldlM - 2 || l.levelM > cfg.fslM + 2)
      errs.push(`${key}: level ${l.levelM} outside [LDL-2, FSL+2] = [${cfg.ldlM - 2}, ${cfg.fslM + 2}]`)
  }
  if (Math.abs(sum - rec.totals.liveStorageML) > rec.totals.liveStorageML * 0.01)
    errs.push(`lake sum ${sum} != total ${rec.totals.liveStorageML} (±1%)`)
  return errs
}

/** OpenAI strict structured outputs need additionalProperties:false and every
 * property listed in required, recursively. */
function strictify(schema) {
  const s = { ...schema }
  if (s.type === 'object' && s.properties) {
    s.additionalProperties = false
    s.required = Object.keys(s.properties)
    s.properties = Object.fromEntries(
      Object.entries(s.properties).map(([k, v]) => [k, strictify(v)]),
    )
  }
  if (s.type === 'array' && s.items) s.items = strictify(s.items)
  return s
}

async function callOpenAI(imagePath) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY not set')
  const ext = extname(imagePath).toLowerCase()
  const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg'
  const image = (await readFile(imagePath)).toString('base64')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 24576,
      // gpt-5-style models spend from the same budget on reasoning; keep it low
      ...(MODEL.startsWith('gpt-5') ? { reasoning_effort: 'low' } : {}),
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'lake_report', strict: true, schema: strictify(RECORD_SCHEMA) },
      },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              // detail:high — the table is dense; auto downscaling causes digit errors
              image_url: { url: `data:${mediaType};base64,${image}`, detail: 'high' },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const msg = data.choices?.[0]?.message
  if (msg?.refusal) throw new Error(`model refused: ${msg.refusal}`)
  if (!msg?.content) throw new Error('empty response')
  return JSON.parse(msg.content)
}

async function loadHistory() {
  return JSON.parse(await readFile(HISTORY, 'utf8'))
}

const OCR_ATTEMPTS = 3
const TOTAL_CAPACITY = Object.values(LAKES).reduce((a, l) => a + l.fslUsefulML, 0)

/** field-wise median of several extracted records — random digit errors
 * rarely hit the same field twice, so consensus kills them */
function medianMerge(recs) {
  const median = (vals) => {
    const s = [...vals].sort((a, b) => a - b)
    return s[Math.floor(s.length / 2)]
  }
  const merge = (objs) => {
    if (typeof objs[0] === 'number') return median(objs)
    if (Array.isArray(objs[0])) {
      const len = median(objs.map((o) => o.length))
      const src = objs.find((o) => o.length === len) ?? objs[0]
      return src.map((_, i) => merge(objs.filter((o) => i < o.length).map((o) => o[i])))
    }
    if (objs[0] && typeof objs[0] === 'object') {
      return Object.fromEntries(Object.keys(objs[0]).map((k) => [k, merge(objs.map((o) => o?.[k]))]))
    }
    return objs[0]
  }
  return merge(recs)
}

/** printed %-of-capacity is redundant with storage; use it to repair a
 * misread storage figure (capacity is static truth) */
function heal(rec) {
  const notes = []
  for (const key of LAKE_KEYS) {
    const l = rec.lakes[key]
    if (!l) continue
    const cfg = LAKES[key]
    const expected = (l.pctUseful / 100) * cfg.fslUsefulML
    if (Math.abs(l.liveStorageML - expected) > Math.max(60, cfg.fslUsefulML * 0.006)) {
      notes.push(`${key}: storage ${l.liveStorageML} → ${Math.round(expected)} (from ${l.pctUseful}%)`)
      l.liveStorageML = Math.round(expected)
    }
  }
  const sum = LAKE_KEYS.reduce((a, k) => a + (rec.lakes[k]?.liveStorageML ?? 0), 0)
  const expectedTotal = (rec.totals.pctUseful / 100) * TOTAL_CAPACITY
  if (
    Math.abs(sum - rec.totals.liveStorageML) > rec.totals.liveStorageML * 0.01 &&
    Math.abs(sum - expectedTotal) <= expectedTotal * 0.01
  ) {
    notes.push(`totals: ${rec.totals.liveStorageML} → ${sum} (lake sum, matches printed ${rec.totals.pctUseful}%)`)
    rec.totals.liveStorageML = sum
  }
  return notes
}

async function processImage(imagePath, history) {
  console.log(`OCR: ${imagePath}`)
  const attempts = []
  let rec = null
  for (let attempt = 1; attempt <= OCR_ATTEMPTS; attempt++) {
    const r = await callOpenAI(imagePath)
    attempts.push(r)
    if (!validateRecord(r, history).length) {
      rec = r
      break
    }
    console.error(`  attempt ${attempt}/${OCR_ATTEMPTS} did not validate on its own`)
  }
  if (!rec && attempts.length > 1) {
    const merged = medianMerge(attempts)
    if (!validateRecord(merged, history).length) {
      console.log('  consensus of attempts validates ✓')
      rec = merged
    } else {
      const notes = heal(merged)
      if (!validateRecord(merged, history).length) {
        notes.forEach((n) => console.log(`  healed: ${n}`))
        console.log('  consensus + healing validates ✓')
        rec = merged
      }
    }
  }
  if (!rec) {
    const errs = validateRecord(medianMerge(attempts), history)
    console.error(`VALIDATION FAILED for ${imagePath}:`)
    errs.forEach((e) => console.error(`  - ${e}`))
    console.error(JSON.stringify(medianMerge(attempts), null, 1))
    return false
  }
  history.push(rec)
  history.sort((a, b) => a.date.localeCompare(b.date))
  await writeFile(HISTORY, JSON.stringify(history, null, 2) + '\n')
  await mkdir(ARCHIVE, { recursive: true })
  await rename(imagePath, join(ARCHIVE, `${rec.date}${extname(imagePath).toLowerCase()}`))
  console.log(`OK: ${rec.date} appended (total ${rec.totals.pctUseful}%), image archived`)
  return true
}

const arg = process.argv[2]
if (!arg) {
  console.error('usage: node scripts/ocr.mjs <image|folder> | --dry-run')
  process.exit(2)
}

if (arg === '--dry-run') {
  // re-validate every record in history against the static config
  const history = await loadHistory()
  let bad = 0
  for (const rec of history) {
    const errs = validateRecord(rec, history.filter((h) => h !== rec))
    if (errs.length) {
      bad++
      console.error(`${rec.date}:`)
      errs.forEach((e) => console.error(`  - ${e}`))
    }
  }
  console.log(`dry-run: ${history.length} records, ${bad} with problems`)
  process.exit(bad ? 1 : 0)
}

const isDir = statSync(arg).isDirectory()
const images = isDir
  ? (await readdir(arg))
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .map((f) => join(arg, f))
  : [arg]

if (!images.length) {
  console.log('no images to process')
  process.exit(0)
}

const history = await loadHistory()
let failures = 0
for (const img of images) {
  try {
    if (!(await processImage(img, history))) failures++
  } catch (e) {
    console.error(`ERROR on ${basename(img)}: ${e.message}`)
    failures++
  }
}
console.log(`done: ${images.length - failures}/${images.length} succeeded`)
process.exit(failures ? 1 : 0)
