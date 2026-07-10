import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { MapControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { flags } from './capture'

// ref type derived from drei so we don't import three-stdlib directly
// (a transitive dep that pnpm's strict node_modules doesn't expose)
type MapControlsImpl = ComponentRef<typeof MapControls>

// Map-like camera: pan + zoom, ~45° tilt with a little play, limited rotation.
// Target clamped so the user can't pan the scene away.
const PAN_LIMIT_X = 140
const PAN_LIMIT_Z = 200

const PORTRAIT = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
const DEFAULT_POS = PORTRAIT ? [0, 260, 300] : [0, 190, 220]

// Intro flythrough: over Upper Vaitarna, down the Vaitarna cascade, along the
// mains corridor to Bhandup, pull out to the default map view.
const INTRO_S = 7
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)

function introSkipped(): boolean {
  const q = new URLSearchParams(location.search)
  if (q.get('intro') === '1') return false
  if (q.get('intro') === '0') return true
  if (q.has('date')) return true // deep link straight to a day, no cinema
  if (sessionStorage.getItem('introPlayed')) return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  return false
}

export function CameraRig() {
  const controls = useRef<MapControlsImpl>(null)
  const [introDone, setIntroDone] = useState(introSkipped)
  const progress = useRef(0)

  const { camPath, lookPath } = useMemo(() => {
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const camPath = new THREE.CatmullRomCurve3(
      [
        v(96, 64, -152),
        v(72, 26, -112),
        v(52, 19, -78),
        v(30, 20, -48),
        v(-2, 24, 16),
        v(-32, 28, 80),
        v(DEFAULT_POS[0], DEFAULT_POS[1], DEFAULT_POS[2]),
      ],
      false,
      'catmullrom',
      0.35,
    )
    const lookPath = new THREE.CatmullRomCurve3(
      [
        v(71, 2, -101), // Upper Vaitarna
        v(58, 2, -70), // Middle Vaitarna
        v(37, 2, -56), // Modak Sagar
        v(10, 3, -18),
        v(-34, 1, 97), // Bhandup
        v(-46, 1, 116), // city
        v(0, 0, 0),
      ],
      false,
      'catmullrom',
      0.35,
    )
    return { camPath, lookPath }
  }, [])

  // any interaction skips the intro
  useEffect(() => {
    if (introDone) return
    const skip = () => setIntroDone(true)
    window.addEventListener('pointerdown', skip, { once: true })
    window.addEventListener('wheel', skip, { once: true })
    window.addEventListener('keydown', skip, { once: true })
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('wheel', skip)
      window.removeEventListener('keydown', skip)
    }
  }, [introDone])

  useEffect(() => {
    if (introDone) sessionStorage.setItem('introPlayed', '1')
  }, [introDone])

  // clean cinematic: hide chips/header/scrubber while the intro plays
  useEffect(() => {
    if (introDone) return
    const app = document.querySelector('.app')
    app?.classList.add('intro-active')
    return () => app?.classList.remove('intro-active')
  }, [introDone])

  useFrame(({ camera }, delta) => {
    if (!introDone) {
      if (!flags.ready) return // hold until the terrain is in
      progress.current = Math.min(1, progress.current + delta / INTRO_S)
      const p = easeInOut(progress.current)
      camera.position.copy(camPath.getPoint(p))
      camera.lookAt(lookPath.getPoint(p))
      if (progress.current >= 1) setIntroDone(true)
      return
    }

    const c = controls.current
    if (!c) return
    const t = c.target
    const cx = Math.max(-PAN_LIMIT_X, Math.min(PAN_LIMIT_X, t.x))
    const cz = Math.max(-PAN_LIMIT_Z, Math.min(PAN_LIMIT_Z, t.z))
    if (cx !== t.x || cz !== t.z) {
      c.object.position.x += cx - t.x
      c.object.position.z += cz - t.z
      t.x = cx
      t.z = cz
    }
    if (t.y !== 0) {
      c.object.position.y -= t.y
      t.y = 0
    }
  })

  if (!introDone) return null // controls mount only after the intro lands

  return (
    <MapControls
      makeDefault
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
      minDistance={45}
      maxDistance={420}
      minPolarAngle={0.55}
      maxPolarAngle={0.95}
      minAzimuthAngle={-Math.PI / 6}
      maxAzimuthAngle={Math.PI / 6}
    />
  )
}
