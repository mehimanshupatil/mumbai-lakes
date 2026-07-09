import { useMemo } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { setSelected } from '../state/selection'
import { useHeightfield } from './heightfield'

/** grid cells per geometry quad (2 = half the DEM resolution, ~71k verts) */
const STRIDE = 2

// Elevation (metres) → color ramp
const SAND = new THREE.Color('#d4c08a')
const GRASS = new THREE.Color('#69a05a')
const FOREST = new THREE.Color('#41703a')
const ROCK = new THREE.Color('#8d8065')
const SEABED = new THREE.Color('#7ba7a0')

function colorAt(metres: number, out: THREE.Color) {
  if (metres < 0) {
    out.copy(SEABED)
  } else if (metres < 3) {
    out.copy(SAND)
  } else if (metres < 14) {
    out.lerpColors(SAND, GRASS, (metres - 3) / 11)
  } else if (metres < 120) {
    out.lerpColors(GRASS, FOREST, (metres - 14) / 106)
  } else if (metres < 900) {
    out.lerpColors(FOREST, ROCK, (metres - 120) / 780)
  } else {
    out.copy(ROCK)
  }
}

export function Terrain() {
  const hf = useHeightfield()

  const geometry = useMemo(() => {
    const nx = Math.floor(448 / STRIDE)
    const nz = Math.floor(640 / STRIDE)
    const geo = new THREE.PlaneGeometry(hf.sceneW, hf.sceneH, nx - 1, nz - 1)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = hf.terrainHeight(x, z)
      pos.setY(i, h)
      colorAt(hf.groundMetres(x, z), c)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    return geo
  }, [hf])

  // deselect on terrain click, but not after a drag
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta < 6) setSelected(null)
  }

  return (
    <mesh geometry={geometry} onClick={click}>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} />
    </mesh>
  )
}

export function Sea() {
  const hf = useHeightfield()
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[hf.sceneW * 6, hf.sceneH * 6]} />
      <meshStandardMaterial color="#1e6a89" roughness={0.35} metalness={0.05} />
    </mesh>
  )
}
