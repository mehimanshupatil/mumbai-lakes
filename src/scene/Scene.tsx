import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Terrain, Sea } from './Terrain'
import { Lakes } from './Lakes'
import { Districts } from './Districts'
import { Rivers } from './Rivers'
import { Pipes } from './Pipes'
import { City } from './City'
import { Facilities } from './Facilities'
import { Rain } from './Rain'
import { CameraRig } from './CameraRig'
import { setSelected } from '../state/selection'
import { useHeightfield } from './heightfield'
import { CaptureBridge, flags } from './capture'

/** mounts only once the DEM has loaded (inside Suspense) → signals the app */
function Ready({ onReady }: { onReady: () => void }) {
  useHeightfield()
  useEffect(() => {
    flags.ready = true
    onReady()
  }, [onReady])
  return null
}

// deep-ocean backdrop — the map floats in water, no pale void at the edges
const SKY = '#14536e'

// portrait phones need a farther start position to fit the whole system
const PORTRAIT = typeof window !== 'undefined' && window.innerHeight > window.innerWidth

export function Scene({ onReady }: { onReady: () => void }) {
  return (
    <Canvas
      camera={{
        position: PORTRAIT ? [0, 260, 300] : [0, 190, 220],
        fov: 45,
        near: 1,
        far: 1200,
      }}
      dpr={[1, 2]}
      style={{ background: SKY }}
      onPointerMissed={() => setSelected(null)}
    >
      <fog attach="fog" args={[SKY, 340, 820]} />
      {/* golden-hour grade: warm sun + soft warm fill, kept bright */}
      <ambientLight intensity={0.62} color="#fff3e2" />
      <directionalLight position={[-110, 105, -50]} intensity={1.5} color="#ffdfb4" />
      <hemisphereLight args={['#c9dfe9', '#6e7350', 0.5]} />
      <Suspense fallback={null}>
        <Terrain />
        <Sea />
        <Lakes />
        <Districts />
        <Rivers />
        <Pipes />
        <City />
        <Facilities />
        <Rain />
        <Ready onReady={onReady} />
      </Suspense>
      <CaptureBridge />
      <CameraRig />
    </Canvas>
  )
}
