import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { CITY_LATLON } from '../config/lakes'
import { setHovered, setSelected, useSelection } from '../state/selection'
import { useHeightfield } from './heightfield'
import { useDaylight } from './daylight'

const BUILDINGS = 46
const CITY_BASE = '#cdc3b2'
const CITY_ACTIVE = '#e8ddc6'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** low-poly box-cluster skyline along the peninsula axis */
export function City() {
  const hf = useHeightfield()
  const { selected, hovered } = useSelection()
  const { night } = useDaylight()
  const active = selected === 'city' || hovered === 'city'

  const { geometry, center } = useMemo(() => {
    const rand = mulberry32(2024)
    const c = hf.project(CITY_LATLON.lon, CITY_LATLON.lat)
    const boxes: THREE.BufferGeometry[] = []
    const axis = (-24 * Math.PI) / 180 // peninsula tilts NNE
    const cos = Math.cos(axis)
    const sin = Math.sin(axis)
    for (let i = 0; i < BUILDINGS; i++) {
      // scatter in a long ellipse, denser + taller toward the southern tip
      const along = (rand() - 0.35) * 22
      const across = (rand() - 0.5) * 7 * (1 - Math.abs(along) / 30)
      const x = c.x + across * cos - along * sin
      const z = c.z + across * sin + along * cos
      const ground = hf.groundHeight(x, z)
      if (ground < 0.1) continue // skip boxes that would stand in the sea
      const south = Math.max(0, 1 - (along + 8) / 26)
      const h = 0.5 + rand() * 1.4 + south * 1.6
      const w = 0.55 + rand() * 0.7
      const box = new THREE.BoxGeometry(w, h, w)
      box.translate(x, ground + h / 2, z)
      boxes.push(box)
    }
    // merge manually: BufferGeometryUtils not imported; concat via group instead
    return { geometry: boxes, center: c }
  }, [hf])

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered('city')
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHovered(null)
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelected('city')
  }

  return (
    <group onPointerOver={over} onPointerOut={out} onClick={click}>
      {geometry.map((g, i) => (
        <mesh key={i} geometry={g}>
          {/* windows wake up at night — per-building random warmth */}
          <meshStandardMaterial
            color={active ? CITY_ACTIVE : CITY_BASE}
            roughness={0.85}
            emissive="#ffb04a"
            emissiveIntensity={night * (0.15 + ((i * 2654435761) % 100) / 120)}
          />
        </mesh>
      ))}
      {/* generous invisible tap target over the city */}
      <mesh position={[center.x, 1, center.z]} visible={false}>
        <cylinderGeometry args={[10, 10, 4, 12]} />
      </mesh>
    </group>
  )
}
