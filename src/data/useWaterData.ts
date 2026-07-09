import { useMemo } from 'react'
import historyJson from '../../data/history.json'
import type { DailyRecord, LakeReading, Totals } from '../types/data'
import { ALL_LAKES, TOTAL_DEMAND_MLD, type LakeConfig, type LakeKey } from '../config/lakes'

const history = historyJson as unknown as DailyRecord[]

/** history sorted ascending by date */
export function allRecords(): DailyRecord[] {
  return [...history].sort((a, b) => a.date.localeCompare(b.date))
}

export function latestRecord(): DailyRecord {
  const records = allRecords()
  return records[records.length - 1]
}

export interface LakeView {
  key: LakeKey
  config: LakeConfig
  /** today's reading; undefined if missing from the record */
  reading?: LakeReading
  /** fill fraction 0..1 driving the water plane (0.5 fallback when data missing) */
  fill: number
}

export interface WaterData {
  record: DailyRecord
  totals: Totals
  lakes: Record<LakeKey, LakeView>
  /** estimated days of supply left at ~total demand */
  daysOfSupply: number
  /** full history, sorted ascending by date */
  history: DailyRecord[]
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function useWaterData(): WaterData {
  return useMemo(() => {
    const records = allRecords()
    const record = records[records.length - 1]
    const lakes = Object.fromEntries(
      ALL_LAKES.map((config) => {
        const reading = record.lakes[config.key]
        if (!reading) {
          console.warn(`history.json ${record.date}: no reading for ${config.key}, showing 50%`)
        }
        const fill = reading ? clamp01(reading.pctUseful / 100) : 0.5
        return [config.key, { key: config.key, config, reading, fill }]
      }),
    ) as Record<LakeKey, LakeView>

    return {
      record,
      totals: record.totals,
      lakes,
      daysOfSupply: Math.round(record.totals.liveStorageML / TOTAL_DEMAND_MLD),
      history: records,
    }
  }, [])
}
