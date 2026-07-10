import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useDaylight } from './daylight'

// Shared ripple shader for sea + lakes: scrolling analytic ripples perturb the
// normal; fresnel tints toward the sky, a specular glint tracks the sun/moon.
// Manual distance fog matched to the scene fog (340–820).

const VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uColor;
  uniform float uNight;
  uniform float uOpacity;
  uniform vec3 uFogColor;
  varying vec3 vWorldPos;

  void main() {
    vec2 p = vWorldPos.xz;
    float dist = length(cameraPosition - vWorldPos);
    // diagonal wave sets (no axis-aligned banding), fading with distance
    float amp = 0.09 / (1.0 + dist * 0.012);
    float w1 = sin(dot(p, vec2(0.42, 0.31)) + uTime * 1.15);
    float w2 = sin(dot(p, vec2(-0.27, 0.47)) - uTime * 0.85);
    float w3 = sin(dot(p, vec2(0.83, -0.64)) * 1.7 + uTime * 2.1);
    float nx = (w1 * 0.55 + w3 * 0.3) * amp;
    float nz = (w2 * 0.55 + w3 * 0.3) * amp;
    vec3 n = normalize(vec3(nx, 1.0, nz));

    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.4);

    vec3 sun = normalize(uSunDir);
    vec3 h = normalize(sun + viewDir);
    float spec = pow(max(dot(n, h), 0.0), 120.0);

    vec3 skyTint = mix(vec3(0.55, 0.74, 0.85), vec3(0.07, 0.13, 0.23), uNight);
    vec3 glint = mix(vec3(1.0, 0.95, 0.82), vec3(0.72, 0.82, 1.0), uNight);
    float fresAmt = fres * (0.55 - uNight * 0.25);
    vec3 base = uColor * (1.0 - uNight * 0.72); // moonlit water is dark
    vec3 col = mix(base, skyTint, fresAmt) + spec * glint * 0.85;

    float fogF = smoothstep(340.0, 820.0, dist);
    col = mix(col, uFogColor, fogF);

    gl_FragColor = vec4(col, uOpacity);
  }
`

export function WaterMaterial({ color, opacity = 1 }: { color: string; opacity?: number }) {
  const d = useDaylight()
  const ref = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uColor: { value: new THREE.Color(color) },
      uNight: { value: 0 },
      uOpacity: { value: opacity },
      uFogColor: { value: new THREE.Color('#14536e') },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useFrame(({ clock }) => {
    const u = ref.current?.uniforms
    if (!u) return
    u.uTime.value = clock.elapsedTime
    u.uSunDir.value.set(d.sunPos[0], d.sunPos[1], d.sunPos[2]).normalize()
    u.uNight.value = d.night
    u.uColor.value.set(color)
    u.uOpacity.value = opacity
    u.uFogColor.value.set(d.skyColor)
  })

  return (
    <shaderMaterial
      ref={ref}
      vertexShader={VERT}
      fragmentShader={FRAG}
      uniforms={uniforms}
      transparent={opacity < 1}
    />
  )
}
