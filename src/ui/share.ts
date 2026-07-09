// Compose the WebGL canvas + a stat overlay into a PNG and hand it to the
// native share sheet (or download it on desktop). Needs the r3f Canvas to be
// created with preserveDrawingBuffer: true.

const SITE = 'mumbai-lakes.himanshupatil.dev'

export async function shareSnapshot(pctUseful: number, daysOfSupply: number, date: string) {
  const gl = document.querySelector('canvas')
  if (!gl) return

  const w = gl.width
  const h = gl.height
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')!
  ctx.drawImage(gl, 0, 0)

  // bottom gradient band + stats
  const band = Math.round(h * 0.2)
  const grad = ctx.createLinearGradient(0, h - band, 0, h)
  grad.addColorStop(0, 'rgba(12, 40, 54, 0)')
  grad.addColorStop(1, 'rgba(12, 40, 54, 0.88)')
  ctx.fillStyle = grad
  ctx.fillRect(0, h - band, w, band)

  const s = w / 1200 // scale typography with resolution
  const dateText = new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  ctx.fillStyle = '#fff'
  ctx.font = `800 ${Math.round(44 * s)}px system-ui, sans-serif`
  ctx.fillText(`Mumbai's lakes: ${pctUseful.toFixed(1)}% full`, Math.round(28 * s), h - Math.round(58 * s))
  ctx.font = `500 ${Math.round(22 * s)}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(
    `~${daysOfSupply} days of supply · BMC report ${dateText} · ${SITE}`,
    Math.round(28 * s),
    h - Math.round(22 * s),
  )

  const blob: Blob | null = await new Promise((res) => out.toBlob(res, 'image/png'))
  if (!blob) return
  const file = new File([blob], `mumbai-water-${date}.png`, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Mumbai Water Supply',
        text: `Mumbai's lakes are ${pctUseful.toFixed(1)}% full (~${daysOfSupply} days of supply) · https://${SITE}/`,
      })
      return
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  URL.revokeObjectURL(a.href)
}
