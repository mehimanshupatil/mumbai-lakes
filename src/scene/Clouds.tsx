import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useDaylight } from './daylight'

// Soft billboard clouds drifting slowly over the Ghats.
const COUNT = 8
const DRIFT = 1.1 // units/sec eastward

function cloudTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  // a few overlapping soft blobs
  const blobs: Array<[number, number, number, number]> = [
    [64, 70, 42, 0.85],
    [40, 76, 28, 0.7],
    [90, 78, 26, 0.7],
    [58, 58, 24, 0.6],
    [80, 62, 20, 0.5],
  ]
  for (const [x, y, r, a] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Clouds() {
  const { night } = useDaylight()
  const group = useRef<THREE.Group>(null)
  const texture = useMemo(cloudTexture, [])

  const clouds = useMemo(() => {
    const rand = mulberry32(4242)
    return Array.from({ length: COUNT }, () => ({
      x: -150 + rand() * 300,
      y: 46 + rand() * 22,
      z: -150 + rand() * 190,
      w: 42 + rand() * 34,
      speed: 0.7 + rand() * 0.6,
      o: 0.35 + rand() * 0.25,
    }))
  }, [])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    g.children.forEach((child, i) => {
      const c = clouds[i]
      child.position.x += DRIFT * c.speed * delta
      if (child.position.x > 170) child.position.x = -170
      const m = (child as THREE.Sprite).material as THREE.SpriteMaterial
      m.opacity = c.o * (1 - night * 0.55)
    })
  })

  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.w, c.w * 0.42, 1]}>
          <spriteMaterial map={texture} transparent depthWrite={false} opacity={c.o} />
        </sprite>
      ))}
    </group>
  )
}
