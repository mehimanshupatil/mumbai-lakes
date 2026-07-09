// Tiny dependency-free SVG sparkline. X is calendar-scaled, so missing days
// appear as gaps (line breaks), not interpolated lies.

export interface SparkPoint {
  date: string // YYYY-MM-DD
  value: number
}

const dayNum = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000)

export function Sparkline({
  points,
  width = 272,
  height = 44,
  max = 100,
}: {
  points: SparkPoint[]
  width?: number
  height?: number
  max?: number
}) {
  if (points.length < 2) return null

  const d0 = dayNum(points[0].date)
  const d1 = dayNum(points[points.length - 1].date)
  const span = Math.max(1, d1 - d0)
  const px = (p: SparkPoint) => 2 + ((dayNum(p.date) - d0) / span) * (width - 8)
  const py = (p: SparkPoint) => height - 3 - (Math.min(max, p.value) / max) * (height - 8)

  // split into runs at day-gaps > 1 so gaps render as breaks
  const runs: SparkPoint[][] = [[points[0]]]
  for (let i = 1; i < points.length; i++) {
    if (dayNum(points[i].date) - dayNum(points[i - 1].date) > 1) runs.push([])
    runs[runs.length - 1].push(points[i])
  }

  const last = points[points.length - 1]

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {runs.map((run, i) =>
        run.length > 1 ? (
          <polyline
            key={i}
            points={run.map((p) => `${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="#2a89ad"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : (
          <circle key={i} cx={px(run[0])} cy={py(run[0])} r="1.6" fill="#2a89ad" />
        ),
      )}
      <circle cx={px(last)} cy={py(last)} r="2.6" fill="#16739c" />
    </svg>
  )
}
