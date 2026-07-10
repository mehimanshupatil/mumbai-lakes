// Live IST-clock lighting, clamped for readability: the scene tracks real
// Mumbai time (morning-cool → noon → golden evening → dusk-blue night) but
// night never goes black — a cool moon key light keeps the map legible.
// ?t=<hour> (e.g. ?t=23 or ?t=6.5) overrides for testing and recordings.

import { useEffect, useState } from 'react'
import * as THREE from 'three'

export interface Daylight {
  hour: number
  /** 0 = full day … 1 = full night */
  night: number
  sunPos: [number, number, number]
  /** where the *sky* sun sits (goes below horizon at night) */
  skySunPos: [number, number, number]
  sunColor: string
  sunIntensity: number
  ambientColor: string
  ambientIntensity: number
  /** background + fog */
  skyColor: string
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function computeDaylight(hour: number): Daylight {
  // day window ~06:00–19:30; dayness fades at both ends
  const dayness = smooth(5.5, 7.2, hour) * (1 - smooth(18.2, 19.6, hour))
  const night = 1 - dayness

  const dayFrac = clamp01((hour - 6) / 13.5) // 0 sunrise … 1 sunset
  const elev = Math.sin(Math.PI * dayFrac) // 0..1..0

  // sun travels east → west (+x → −x), arcing through the southern sky (+z)
  const sunX = 130 - 260 * dayFrac
  const sunY = 25 + 135 * elev
  const sunZ = 55
  const moonPos: [number, number, number] = [-70, 110, -35]

  const mix = (a: number, b: number) => a * dayness + b * night
  const sunPos: [number, number, number] = [
    mix(sunX, moonPos[0]),
    mix(sunY, moonPos[1]),
    mix(sunZ, moonPos[2]),
  ]

  // warm at low sun, near-white at noon, cool moonlight at night
  const dayCol = new THREE.Color('#ffd9a8').lerp(new THREE.Color('#fff7ea'), elev)
  const sunColor = `#${dayCol.lerp(new THREE.Color('#a9c4e6'), night).getHexString()}`

  const ambient = new THREE.Color('#fff3e2').lerp(new THREE.Color('#7d94b5'), night)
  const sky = new THREE.Color('#1d6a8c')
    .lerp(new THREE.Color('#14536e'), 1 - elev * (1 - night)) // dimmer toward dawn/dusk
    .lerp(new THREE.Color('#081f30'), night)

  return {
    hour,
    night,
    sunPos,
    skySunPos: [sunX, 25 + 160 * Math.sin(Math.PI * ((hour - 6) / 13.5)), sunZ],
    sunColor,
    sunIntensity: 1.55 * elev * dayness + 0.55 * night,
    ambientColor: `#${ambient.getHexString()}`,
    ambientIntensity: 0.62 * dayness + 0.4 * night,
    skyColor: `#${sky.getHexString()}`,
  }
}

export function currentHour(): number {
  const t = new URLSearchParams(location.search).get('t')
  if (t !== null && !isNaN(parseFloat(t))) return ((parseFloat(t) % 24) + 24) % 24
  const now = new Date()
  return (now.getUTCHours() + now.getUTCMinutes() / 60 + 5.5) % 24 // IST
}

export function useDaylight(): Daylight {
  const [light, setLight] = useState(() => computeDaylight(currentHour()))
  useEffect(() => {
    const id = setInterval(() => setLight(computeDaylight(currentHour())), 60_000)
    return () => clearInterval(id)
  }, [])
  return light
}
