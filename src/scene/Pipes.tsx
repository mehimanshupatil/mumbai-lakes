import { useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { LAKES, type LakeKey } from '../config/lakes'
import { BHANDUP_JUNCTION, CITY_END, PIPE_ROUTES, pipeRadius } from '../config/pipes'
import { setHovered, setSelected, useSelection } from '../state/selection'
import { useHeightfield, type Heightfield } from './heightfield'
import { useDaylight } from './daylight'

const PIPE = '#9fb4bc'
const PIPE_ACTIVE = '#5fc6e4'
const WATER_DOT = '#8fe3ff'
const LANE_SPACING = 2.3
/** lanes squeeze back together to dock on the Bhandup pad */
const DOCK_SQUEEZE = 0.32

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

/** sample a lon/lat route into terrain-hugging scene points */
function samplePoints(hf: Heightfield, lonLat: Array<[number, number]>): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < lonLat.length - 1; i++) {
    const a = hf.project(lonLat[i][0], lonLat[i][1])
    const b = hf.project(lonLat[i + 1][0], lonLat[i + 1][1])
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const steps = Math.max(1, Math.ceil(len / 4))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t))
    }
  }
  const last = lonLat[lonLat.length - 1]
  const p = hf.project(last[0], last[1])
  pts.push(new THREE.Vector3(p.x, 0, p.z))
  return pts
}

function settleHeights(hf: Heightfield, pts: THREE.Vector3[]) {
  for (const p of pts) p.y = Math.max(hf.terrainHeight(p.x, p.z), 0) + 0.55
  return pts
}

interface PipeSpec {
  key: LakeKey
  curve: THREE.CatmullRomCurve3
  radius: number
  particles: number
}

/**
 * Trunk-lake pipes get parallel "lanes": each route is shifted sideways along
 * its length and docks side-by-side at the Bhandup manifold instead of
 * overlapping the neighbouring pipes.
 */
function usePipes(): PipeSpec[] {
  const hf = useHeightfield()
  return useMemo(() => {
    const jp = hf.project(BHANDUP_JUNCTION[0], BHANDUP_JUNCTION[1])
    const junction = new THREE.Vector3(jp.x, 0, jp.z)
    junction.y = Math.max(hf.terrainHeight(junction.x, junction.z), 0) + 0.55

    // dock axis: perpendicular to the junction→city direction
    const t1 = hf.project(CITY_END[0], CITY_END[1])
    const cityDir = new THREE.Vector2(t1.x - junction.x, t1.z - junction.z).normalize()
    const dock = new THREE.Vector2(-cityDir.y, cityDir.x)

    const raw = PIPE_ROUTES.map((r) => ({ r, pts: samplePoints(hf, r.points) }))

    // assign dock slots by which side of the manifold each pipe arrives from
    // (projection of the approach direction onto the dock axis) so no pipe
    // crosses its neighbours right at the pad
    const trunkRoutes = raw
      .filter(({ r }) => r.viaTrunk)
      .map((entry) => {
        const prev = entry.pts[entry.pts.length - 2]
        const ax = prev.x - junction.x
        const az = prev.z - junction.z
        const len = Math.hypot(ax, az) || 1
        return { ...entry, side: (ax / len) * dock.x + (az / len) * dock.y }
      })
      .sort((a, b) => a.side - b.side)

    const specs: PipeSpec[] = trunkRoutes.map(({ r, pts }, i) => {
      const first = pts[0]
      const routeLen = Math.hypot(junction.x - first.x, junction.z - first.z)
      // short routes (Tulsi) don't share the corridor — no sideways lane shift,
      // or the offset would drag them across their neighbours
      const laneScale = Math.min(1, Math.max(0, (routeLen - 12) / 50))
      const lane = (i - (trunkRoutes.length - 1) / 2) * LANE_SPACING * laneScale
      const overall = new THREE.Vector2(junction.x - first.x, junction.z - first.z).normalize()
      const perp = new THREE.Vector2(-overall.y, overall.x)
      const n = pts.length - 1
      pts.forEach((p, idx) => {
        const u = idx / n
        const ramp = smoothstep(0.12, 0.45, u) // leave the lake untouched
        const dockBlend = smoothstep(0.8, 1, u) // swing onto the dock axis
        const ox = perp.x * (1 - dockBlend) + dock.x * dockBlend
        const oz = perp.y * (1 - dockBlend) + dock.y * dockBlend
        p.x += ox * lane * ramp
        p.z += oz * lane * ramp
      })
      // exact dock position at the manifold (unscaled lane keeps dock slots distinct)
      const dockLane = (i - (trunkRoutes.length - 1) / 2) * LANE_SPACING
      const end = pts[pts.length - 1]
      end.x = junction.x + dock.x * dockLane * DOCK_SQUEEZE
      end.z = junction.z + dock.y * dockLane * DOCK_SQUEEZE
      settleHeights(hf, pts)
      const share = r.radiusShare ?? LAKES[r.key].supplyShare
      return {
        key: r.key,
        curve: new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1),
        radius: pipeRadius(share),
        particles: Math.ceil(3 + share * 36),
      }
    })

    // non-trunk routes: the UV → MV → Modak Sagar river-cascade links
    for (const { r, pts } of raw.filter(({ r }) => !r.viaTrunk)) {
      settleHeights(hf, pts)
      const share = r.radiusShare ?? LAKES[r.key].supplyShare
      specs.push({
        key: r.key,
        curve: new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1),
        radius: pipeRadius(share),
        particles: Math.ceil(3 + share * 36),
      })
    }

    return specs
  }, [hf])
}

function Pipe({ spec }: { spec: PipeSpec }) {
  const { selected, hovered } = useSelection()
  const active = selected === spec.key || hovered === spec.key

  const geometry = useMemo(
    () => new THREE.TubeGeometry(spec.curve, 72, spec.radius, 6, false),
    [spec],
  )
  // fat invisible tube so thin pipes are easy to hover/tap
  const hitGeometry = useMemo(
    () => new THREE.TubeGeometry(spec.curve, 48, Math.max(spec.radius * 2.2, 1.2), 5, false),
    [spec],
  )

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(spec.key)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHovered(null)
    document.body.style.cursor = ''
  }
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setSelected(spec.key)
  }

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={active ? PIPE_ACTIVE : PIPE}
          transparent
          opacity={0.75}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>
      <mesh
        geometry={hitGeometry}
        onPointerOver={over}
        onPointerOut={out}
        onClick={click}
        visible={false}
      />
    </group>
  )
}

/** bright dots travelling along every pipe, lake → city */
function FlowParticles({ specs }: { specs: PipeSpec[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const { night } = useDaylight()
  const items = useMemo(() => {
    const list: Array<{ curve: THREE.CatmullRomCurve3; offset: number; speed: number; size: number }> = []
    for (const s of specs) {
      for (let i = 0; i < s.particles; i++) {
        list.push({
          curve: s.curve,
          offset: i / s.particles,
          speed: 0.025 + (0.012 * ((i * 7919) % 13)) / 13,
          size: Math.min(0.42, s.radius * 0.55),
        })
      }
    }
    return list
  }, [specs])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    items.forEach((p, i) => {
      const u = (p.offset + t * p.speed) % 1
      p.curve.getPointAt(u, dummy.position)
      dummy.scale.setScalar(p.size)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      {/* brighter at night so the veins glow under bloom */}
      <meshBasicMaterial color={night > 0.5 ? '#d9f6ff' : WATER_DOT} transparent opacity={0.95} />
    </instancedMesh>
  )
}

export function Pipes() {
  const specs = usePipes()
  return (
    <>
      {specs.map((s) => (
        <Pipe key={s.key} spec={s} />
      ))}
      <FlowParticles specs={specs} />
    </>
  )
}
