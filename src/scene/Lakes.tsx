import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ALL_LAKES, CITY_LATLON, type LakeKey } from '../config/lakes'
import { useWaterData } from '../data/useWaterData'
import { lakeStatus } from '../data/status'
import { setHovered, setSelected, useSelection } from '../state/selection'
import { useHeightfield } from './heightfield'
import { WaterMaterial } from './WaterMaterial'

const WATER = '#3fa8c9'
const WATER_ACTIVE = '#6fd0ea'

// label anchor nudges [x, extraY] for the crowded SGNP cluster
const LABEL_POS: Partial<Record<LakeKey, [number, number]>> = {
  tulsi: [-2, 3.6],
  vehar: [-3, 1.4],
}

function Lake({ lakeKey }: { lakeKey: LakeKey }) {
  const hf = useHeightfield()
  const { lakes } = useWaterData()
  const { selected, hovered } = useSelection()
  const lake = lakes[lakeKey]
  const basin = hf.basinByKey[lakeKey]
  const ref = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const spillRef = useRef<THREE.InstancedMesh>(null)
  // displayed fill eases toward the target — covers both the load intro
  // (0 → today) and time-scrubbing between records
  const anim = useRef(0)
  const active = selected === lakeKey || hovered === lakeKey
  const overflowing = (lake.reading?.pctUseful ?? 0) >= 99.9

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    anim.current += (lake.fill - anim.current) * Math.min(1, delta * 2.4)
    if (ref.current) {
      ref.current.position.y =
        hf.waterY(lakeKey, anim.current) + Math.sin(t * 1.2 + basin.cx) * 0.03
    }
    if (ringRef.current) {
      // overflow shimmer: slow opacity pulse at the rim
      const m = ringRef.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(t * 2.2 + basin.cz))
      ringRef.current.visible = overflowing && anim.current > lake.fill - 0.03
    }
    if (spillRef.current) {
      // waterfall particles tumbling over the rim toward the city side
      for (let i = 0; i < SPILL_COUNT; i++) {
        const seed = (i * 733) % 97
        const fall = ((t * (2.6 + (seed % 5) * 0.35) + seed) % 4.2)
        spillDummy.position.set(
          spillDir.x * (basin.r * 0.92 + fall * 0.55) + ((seed % 7) - 3) * 0.14,
          basin.waterMaxY + 0.3 - fall,
          spillDir.y * (basin.r * 0.92 + fall * 0.55) + ((seed % 5) - 2) * 0.14,
        )
        spillDummy.scale.set(1, 1 + fall * 0.4, 1)
        spillDummy.updateMatrix()
        spillRef.current.setMatrixAt(i, spillDummy.matrix)
      }
      spillRef.current.instanceMatrix.needsUpdate = true
    }
  })

  // spill direction: over the rim toward the city (downstream-ish)
  const cityP = hf.project(CITY_LATLON.lon, CITY_LATLON.lat)
  const spillDir = new THREE.Vector2(cityP.x - basin.cx, cityP.z - basin.cz).normalize()

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(lakeKey)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHovered(null)
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelected(lakeKey)
  }

  return (
    <group position={[basin.cx, 0, basin.cz]}>
      <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, basin.waterMinY, 0]}>
        <circleGeometry args={[basin.r * 0.72, 40]} />
        <WaterMaterial color={active ? WATER_ACTIVE : WATER} opacity={0.94} />
      </mesh>
      {overflowing && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, basin.waterMaxY + 0.06, 0]}>
          <ringGeometry args={[basin.r * 0.72, basin.r * 0.84, 40]} />
          <meshBasicMaterial color="#bff0ff" transparent opacity={0.4} />
        </mesh>
      )}
      {overflowing && (
        <instancedMesh ref={spillRef} args={[undefined, undefined, SPILL_COUNT]} frustumCulled={false}>
          <boxGeometry args={[0.09, 0.5, 0.09]} />
          <meshBasicMaterial color="#d6f2ff" transparent opacity={0.75} />
        </instancedMesh>
      )}
      {/* fat invisible hit target so small lakes are easy to tap */}
      <mesh
        position={[0, basin.rimY, 0]}
        onPointerOver={over}
        onPointerOut={out}
        onClick={click}
        visible={false}
      >
        <cylinderGeometry args={[basin.r * 1.15, basin.r * 1.15, 3, 16]} />
      </mesh>
      <Html
        position={[LABEL_POS[lakeKey]?.[0] ?? 0, basin.rimY + (LABEL_POS[lakeKey]?.[1] ?? 2), 0]}
        center
        distanceFactor={140}
        zIndexRange={[40, 0]}
      >
        <button
          className={`lake-label${active ? ' lake-label--active' : ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            setSelected(lakeKey)
          }}
          onPointerEnter={() => setHovered(lakeKey)}
          onPointerLeave={() => setHovered(null)}
        >
          {lake.reading && <span className={`status-dot status-${lakeStatus(lake.reading.pctUseful)}`} />}
          {lake.config.displayName}
          {lake.reading ? ` · ${Math.round(lake.reading.pctUseful)}%` : ''}
        </button>
      </Html>
    </group>
  )
}

const SPILL_COUNT = 36
const spillDummy = new THREE.Object3D()

export function Lakes() {
  return (
    <>
      {ALL_LAKES.map((lake) => (
        <Lake key={lake.key} lakeKey={lake.key} />
      ))}
    </>
  )
}
