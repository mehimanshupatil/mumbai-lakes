import { LAKES, TOTAL_DEMAND_MLD, type LakeKey } from '../config/lakes'
import { useWaterData } from '../data/useWaterData'
import { STATUS_LABEL, cityStatus, lakeStatus } from '../data/status'
import { setSelected, useSelection } from '../state/selection'
import { Sparkline } from './Sparkline'

// remark strings in the BMC report use assorted spellings per lake
const REMARK_TERMS: Record<LakeKey, string[]> = {
  upper_vaitarna: ['upper vaitarna', 'upper vaitarana'],
  modak_sagar: ['modak'],
  tansa: ['tansa'],
  middle_vaitarna: ['middle vaitarna', 'middle vaitarana'],
  bhatsa: ['bhatsa'],
  vehar: ['vehar', 'vihar'],
  tulsi: ['tulsi'],
}

const ml = (v: number) => `${v.toLocaleString('en-IN')} ML`

function CityPanel() {
  const { record, totals, daysOfSupply, history } = useWaterData()
  const capacity = 1447363
  const trend = history.map((h) => ({ date: h.date, value: h.totals.pctUseful }))

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Mumbai</div>
          <div className="panel-sub">supplied by 7 lakes · demand ~{TOTAL_DEMAND_MLD.toLocaleString('en-IN')} MLD</div>
        </div>
        <button className="panel-close" onClick={() => setSelected(null)} aria-label="Close">
          ×
        </button>
      </div>

      <div className="panel-fill">
        <div className="panel-fill-bar">
          <div
            className={`panel-fill-value fill-${cityStatus(totals.pctUseful, daysOfSupply)}`}
            style={{ width: `${Math.min(100, totals.pctUseful)}%` }}
          />
        </div>
        <div className="panel-fill-label">
          {totals.pctUseful.toFixed(2)}% of total stock
          <span className={`status-pill status-${cityStatus(totals.pctUseful, daysOfSupply)}`}>
            {STATUS_LABEL[cityStatus(totals.pctUseful, daysOfSupply)]}
          </span>
        </div>
      </div>

      <dl className="panel-grid">
        <div>
          <dt>Total live storage</dt>
          <dd>{ml(totals.liveStorageML)}</dd>
        </div>
        <div>
          <dt>Total capacity</dt>
          <dd>{ml(capacity)}</dd>
        </div>
        <div>
          <dt>Days of supply</dt>
          <dd>~{daysOfSupply} days</dd>
        </div>
        <div>
          <dt>Report</dt>
          <dd>
            {record.date} <small>{record.reportTime} IST</small>
          </dd>
        </div>
      </dl>

      {trend.length > 1 && (
        <div className="panel-trend">
          <div className="panel-years-title">This season</div>
          <Sparkline points={trend} />
        </div>
      )}

      {totals.previousYears.length > 0 && (
        <div className="panel-years">
          <div className="panel-years-title">Same date, previous years</div>
          {totals.previousYears.map((p) => (
            <div key={p.year} className="panel-year-row">
              <span>{p.year}</span>
              <div className="panel-year-bar">
                <div style={{ width: `${Math.min(100, p.pctUseful)}%` }} />
              </div>
              <span>{p.pctUseful.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}

      {record.remarks.length > 0 && (
        <ul className="panel-remarks">
          {record.remarks.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}

      <p className="panel-about">
        Treated water flows to 28 service reservoirs feeding 110 supply zones through ~4,000 km of
        mains — most zones get water only 2–6 hours a day.
      </p>
    </aside>
  )
}

export function InfoPanel() {
  const { selected } = useSelection()
  const { record, lakes, history } = useWaterData()
  if (!selected) return null
  if (selected === 'city') return <CityPanel />

  const lake = lakes[selected]
  const config = LAKES[selected]
  const r = lake.reading
  const trend = history
    .filter((h) => h.lakes[selected])
    .map((h) => ({ date: h.date, value: h.lakes[selected]!.pctUseful }))
  const remarks = record.remarks.filter((s) =>
    REMARK_TERMS[selected].some((t) => s.toLowerCase().includes(t)),
  )
  const overflowing = remarks.some((s) => s.toLowerCase().includes('overflow'))

  return (
    <aside className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">
            {config.displayName}
            {overflowing && <span className="badge-overflow">Overflowing</span>}
          </div>
          <div className="panel-sub">
            {Math.round(config.supplyShare * 1000) / 10}% of Mumbai's supply · {config.supplyMLD}{' '}
            MLD · {config.distanceKm} km away
            <br />
            {selected === 'upper_vaitarna' || selected === 'middle_vaitarna'
              ? 'flows via the Vaitarna river to Modak Sagar, then to Bhandup'
              : 'via Bhandup Complex WTP'}
          </div>
        </div>
        <button className="panel-close" onClick={() => setSelected(null)} aria-label="Close">
          ×
        </button>
      </div>

      {r ? (
        <>
          <div className="panel-fill">
            <div className="panel-fill-bar">
              <div
                className={`panel-fill-value fill-${lakeStatus(r.pctUseful)}`}
                style={{ width: `${Math.min(100, r.pctUseful)}%` }}
              />
            </div>
            <div className="panel-fill-label">
              {r.pctUseful.toFixed(2)}% full
              <span className={`status-pill status-${lakeStatus(r.pctUseful)}`}>
                {STATUS_LABEL[lakeStatus(r.pctUseful)]}
              </span>
            </div>
          </div>

          <dl className="panel-grid">
            <div>
              <dt>Live storage</dt>
              <dd>{ml(r.liveStorageML)}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>{ml(config.fslUsefulML)}</dd>
            </div>
            <div>
              <dt>Level</dt>
              <dd>
                {r.levelM.toFixed(2)} m
                <small>
                  {' '}
                  (FSL {config.fslM} · LDL {config.ldlM} {config.datum})
                </small>
              </dd>
            </div>
            <div>
              <dt>Rise (24h)</dt>
              <dd>{r.rise24hM > 0 ? `▲ ${r.rise24hM.toFixed(2)} m` : `${r.rise24hM.toFixed(2)} m`}</dd>
            </div>
            <div>
              <dt>Rain today</dt>
              <dd>{r.rainTodayMm.toFixed(0)} mm</dd>
            </div>
            <div>
              <dt>Rain this season</dt>
              <dd>{r.rainSeasonMm.toFixed(0)} mm</dd>
            </div>
          </dl>

          {trend.length > 1 && (
            <div className="panel-trend">
              <div className="panel-years-title">This season</div>
              <Sparkline points={trend} />
            </div>
          )}

          {r.previousYears.length > 0 && (
            <div className="panel-years">
              <div className="panel-years-title">Same date, previous years</div>
              {r.previousYears.map((p) => (
                <div key={p.year} className="panel-year-row">
                  <span>{p.year}</span>
                  <div className="panel-year-bar">
                    <div style={{ width: `${Math.min(100, p.pctUseful)}%` }} />
                  </div>
                  <span>{p.pctUseful.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="panel-missing">No reading in today's report.</p>
      )}

      {remarks.length > 0 && (
        <ul className="panel-remarks">
          {remarks.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}

      <p className="panel-about">{config.about}</p>
    </aside>
  )
}
