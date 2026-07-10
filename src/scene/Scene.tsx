import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { Terrain, Sea } from './Terrain'
import { Lakes } from './Lakes'
import { Districts } from './Districts'
import { Rivers } from './Rivers'
import { Pipes } from './Pipes'
import { City } from './City'
import { Facilities } from './Facilities'
import { Rain } from './Rain'
import { Clouds } from './Clouds'
import { CameraRig } from './CameraRig'
import { setSelected } from '../state/selection'
import { useHeightfield } from './heightfield'
import { CaptureBridge, flags } from './capture'
import { useDaylight } from './daylight'

/** mounts only once the DEM has loaded (inside Suspense) → signals the app */
function Ready({ onReady }: { onReady: () => void }) {
  useHeightfield()
  useEffect(() => {
    flags.ready = true
    onReady()
  }, [onReady])
  return null
}

// portrait phones need a farther start position to fit the whole system
const PORTRAIT = typeof window !== 'undefined' && window.innerHeight > window.innerWidth

// bloom/vignette only on precise-pointer devices — phones keep the raw
// renderer and their frame rate (issue 11 decision 4)
const FINE_POINTER =
  typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

/** lights + sky driven by the live IST clock (see daylight.ts; ?t= override) */
function Daylight() {
  const d = useDaylight()
  return (
    <>
      <color attach="background" args={[d.skyColor]} />
      <fog attach="fog" args={[d.skyColor, 340, 820]} />
      <ambientLight intensity={d.ambientIntensity} color={d.ambientColor} />
      <directionalLight position={d.sunPos} intensity={d.sunIntensity} color={d.sunColor} />
      <hemisphereLight args={[d.ambientColor, '#5c6350', 0.35 + 0.15 * (1 - d.night)]} />
      {d.night < 0.6 && (
        <Sky
          distance={4000}
          sunPosition={d.skySunPos}
          turbidity={6}
          rayleigh={1.6}
          mieCoefficient={0.004}
          mieDirectionalG={0.85}
        />
      )}
      {d.night > 0.35 && <Stars radius={900} depth={60} count={2200} factor={5} fade speed={0.6} />}
    </>
  )
}

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
      onPointerMissed={() => setSelected(null)}
    >
      <Daylight />
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
        <Clouds />
        <Ready onReady={onReady} />
      </Suspense>
      {FINE_POINTER && (
        <EffectComposer>
          <Bloom intensity={0.55} luminanceThreshold={0.72} mipmapBlur />
          <Vignette offset={0.22} darkness={0.5} />
        </EffectComposer>
      )}
      <CaptureBridge />
      <CameraRig />
    </Canvas>
  )
}
