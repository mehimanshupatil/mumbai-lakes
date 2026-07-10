// Bridge so the share button can force a fresh WebGL render right before
// reading the canvas — avoids preserveDrawingBuffer, which causes background
// flicker on mobile GPUs.

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'

export const capture: {
  gl: THREE.WebGLRenderer | null
  scene: THREE.Scene | null
  camera: THREE.Camera | null
} = { gl: null, scene: null, camera: null }

/** set once the DEM has loaded — gates the intro flythrough */
export const flags = { ready: false }

export function CaptureBridge() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    capture.gl = gl
    capture.scene = scene
    capture.camera = camera
  }, [gl, scene, camera])
  return null
}
