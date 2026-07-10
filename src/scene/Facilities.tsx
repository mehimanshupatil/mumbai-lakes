import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { BHANDUP_JUNCTION, FACILITIES, SOUTH_BEND, ZONES } from '../config/pipes'
import { useHeightfield, type Heightfield } from './heightfield'
import { useDaylight } from './daylight'

const ZONE_DOT = '#4a6d7c'
const DIST_LINE = '#6d8994'

function at(hf: Heightfield, lonLat: [number, number], lift = 0): THREE.Vector3 {
  const p = hf.project(lonLat[0], lonLat[1])
  return new THREE.Vector3(p.x, Math.max(hf.terrainHeight(p.x, p.z), 0) + lift, p.z)
}

/** Html label that fades out when the camera is far — declutters the map */
function FadeLabel({
  worldPos,
  threshold,
  distanceFactor,
  className,
  children,
}: {
  worldPos: THREE.Vector3
  threshold: number
  distanceFactor: number
  className: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFrame(({ camera }) => {
    if (!ref.current) return
    const o = camera.position.distanceTo(worldPos) < threshold ? '1' : '0'
    if (ref.current.style.opacity !== o) ref.current.style.opacity = o
  })
  return (
    <Html
      position={worldPos}
      center
      distanceFactor={distanceFactor}
      zIndexRange={[40, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div ref={ref} className={className} style={{ transition: 'opacity 0.35s' }}>
        {children}
      </div>
    </Html>
  )
}

/** Treatment plants and distribution-zone fan-out (per data/map/water-path.jpg) */
export function Facilities() {
  const hf = useHeightfield()
  const { night } = useDaylight()

  const { plants, zones, lines } = useMemo(() => {
    const plants = FACILITIES.map((f) => ({ ...f, pos: at(hf, f.lonLat) }))
    const zones = ZONES.map((z) => ({ ...z, pos: at(hf, z.lonLat, 0.35) }))
    const bhandup = at(hf, BHANDUP_JUNCTION, 0.5)
    const bend = at(hf, SOUTH_BEND, 0.6)
    const lines = ZONES.map((z, i) => {
      const zp = zones[i].pos
      // west/south zones route via a bend south of Vihar — a straight Bhandup
      // feed would draw a line across Tulsi/Vihar lakes
      const viaBend = z.lonLat[0] < 72.88
      const pts = viaBend ? [bhandup, bend, zp] : [bhandup, zp]
      if (!viaBend) {
        const mid = bhandup.clone().lerp(zp, 0.5)
        mid.y = Math.max(mid.y, Math.max(hf.terrainHeight(mid.x, mid.z), 0) + 0.5)
        pts.splice(1, 0, mid)
      }
      return { name: z.name, points: pts }
    })
    return { plants, zones, lines }
  }, [hf])

  return (
    <>
      {lines.map((l) => (
        <Line
          key={l.name}
          points={l.points}
          color={DIST_LINE}
          transparent
          opacity={0.45}
          lineWidth={1.2}
        />
      ))}
      {zones.map((z) => (
        <group key={z.name}>
          <mesh position={z.pos}>
            <sphereGeometry args={[0.45, 10, 10]} />
            <meshStandardMaterial
              color={ZONE_DOT}
              emissive="#7fd4ff"
              emissiveIntensity={night * 0.7}
            />
          </mesh>
          <FadeLabel
            worldPos={z.pos.clone().setY(z.pos.y + 0.8)}
            threshold={165}
            distanceFactor={90}
            className="zone-label"
          >
            {z.name}
          </FadeLabel>
        </group>
      ))}


      {plants.map((f) => (
        <group key={f.name}>
          <mesh position={[f.pos.x, f.pos.y + 0.5, f.pos.z]}>
            {/* Bhandup is the manifold all trunk pipes dock into — wide pad */}
            {f.name === 'Bhandup Complex' ? (
              <cylinderGeometry args={[2.2, 2.4, 0.9, 10]} />
            ) : (
              <cylinderGeometry args={[0.7, 0.85, 0.9, 8]} />
            )}
            <meshStandardMaterial color="#7d99a6" roughness={0.6} metalness={0.25} />
          </mesh>
          <FadeLabel
            worldPos={
              f.name === 'Bhandup Complex'
                ? f.pos.clone().add(new THREE.Vector3(6.5, 2.6, 3))
                : f.pos.clone().setY(f.pos.y + 2)
            }
            threshold={210}
            distanceFactor={100}
            className="facility-label"
          >
            ⚙ {f.name}
          </FadeLabel>
        </group>
      ))}
    </>
  )
}
