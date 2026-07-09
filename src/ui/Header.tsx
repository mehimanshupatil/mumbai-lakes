import { useEffect, useRef, useState } from 'react'
import { useWaterData } from '../data/useWaterData'
import { STATUS_LABEL, cityStatus } from '../data/status'
import { setLabelsVisible, useSelection } from '../state/selection'
import { shareSnapshot } from './share'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Eases toward the target from wherever it currently is: the load intro runs
 * 0 → today over ~2.6s; subsequent target changes (time scrubbing) glide from
 * the displayed value in ~350ms instead of restarting at zero.
 */
function useCountUp(target: number) {
  const [value, setValue] = useState(0)
  const shown = useRef(0)
  const first = useRef(true)
  useEffect(() => {
    let raf = 0
    const from = shown.current
    const duration = first.current ? 2600 : 350
    first.current = false
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3))
      shown.current = v
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return value
}

export function Header() {
  const { totals, daysOfSupply, record } = useWaterData()
  const { labelsVisible } = useSelection()
  const lastYear = totals.previousYears.find((p) => p.year === new Date(record.date).getFullYear() - 1)
  const animatedPct = useCountUp(totals.pctUseful)
  const lastsTill = new Date(`${record.date}T00:00:00`)
  lastsTill.setDate(lastsTill.getDate() + daysOfSupply)
  const lastsTillText = lastsTill.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <header className="header">
      <div className="header-title">Mumbai Water Supply</div>
      <div className="header-stats">
        <span className="header-stock">{animatedPct.toFixed(1)}%</span>
        <span className={`status-pill status-${cityStatus(totals.pctUseful, daysOfSupply)}`}>
          {STATUS_LABEL[cityStatus(totals.pctUseful, daysOfSupply)]}
        </span>
        <span className="header-detail">
          of total stock · ~{daysOfSupply} days of supply
          {lastYear ? ` · ${lastYear.pctUseful.toFixed(1)}% this day last year` : ''}
        </span>
      </div>
      <div className="header-lasts">
        Without rain, stock lasts till <strong>~{lastsTillText}</strong>
      </div>
      <div className="header-date">BMC lake report · {formatDate(record.date)}</div>
      <div className="header-hint">Tap a lake, pipe or the city for details</div>
      <div className="header-actions">
        <label className="header-toggle">
          <input
            type="checkbox"
            checked={labelsVisible}
            onChange={(e) => setLabelsVisible(e.target.checked)}
          />
          Show labels
        </label>
        <button
          className="header-share"
          onClick={() => shareSnapshot(totals.pctUseful, daysOfSupply, record.date)}
        >
          ↗ Share
        </button>
      </div>
    </header>
  )
}
