'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { useCircuitStore } from '../store/circuitStore'
import { ComponentType as CType } from '../../shared/types'

/* ------------------------------------------------------------------ */
/*  Building appearance per component type                             */
/* ------------------------------------------------------------------ */

const THEME: Record<CType, { color: number; emissive: number; height: number; label: string }> = {
  battery:   { color: 0x22c55e, emissive: 0x14532d, height: 2.4, label: 'Power Plant' },
  resistor:  { color: 0xf59e0b, emissive: 0x451a03, height: 1.4, label: 'Bottleneck' },
  led:       { color: 0xfacc15, emissive: 0x854d0e, height: 1.8, label: 'District' },
  capacitor: { color: 0x3b82f6, emissive: 0x1e3a5f, height: 1.6, label: 'Reservoir' },
  motor:     { color: 0xa78bfa, emissive: 0x2e1065, height: 2.0, label: 'Factory' },
  ground:    { color: 0x94a3b8, emissive: 0x1e293b, height: 0.6, label: 'Return Hub' },
  switch:    { color: 0xfb923c, emissive: 0x431407, height: 1.2, label: 'Gate' },
  wire:      { color: 0x6b7280, emissive: 0x1f2937, height: 0.4, label: 'Junction' },
}

/* ------------------------------------------------------------------ */
/*  Layout helpers                                                     */
/* ------------------------------------------------------------------ */

interface CityBuilding {
  id: string
  type: CType
  label: string
  cityLabel: string
  x: number
  z: number
  powered: boolean
  currentFlow: number
  fault?: string
}

function layoutCity(
  components: { id: string; type: CType; label?: string; position: { x: number; y: number } }[],
  states: { componentId: string; powered: boolean; currentFlow: number; fault?: string }[] | undefined,
): CityBuilding[] {
  if (components.length === 0) return []

  const xs = components.map(c => c.position.x)
  const ys = components.map(c => c.position.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rX = Math.max(maxX - minX, 1)
  const rY = Math.max(maxY - minY, 1)
  const spread = Math.max(components.length * 2.5, 10)

  return components.map(c => {
    const cs = states?.find(s => s.componentId === c.id)
    const nx = ((c.position.x - minX) / rX - 0.5) * spread
    const nz = ((c.position.y - minY) / rY - 0.5) * (spread * 0.6)
    return {
      id: c.id,
      type: c.type,
      label: c.label ?? c.type,
      cityLabel: THEME[c.type]?.label ?? 'Building',
      x: nx,
      z: rY < 5 ? (Math.random() - 0.5) * 4 : nz,
      powered: cs?.powered ?? false,
      currentFlow: cs?.currentFlow ?? 0,
      fault: cs?.fault,
    }
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CityView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    animId: number
    buildings: Map<string, THREE.Mesh>
    roofs: Map<string, THREE.Mesh>
    roads: THREE.Line[]
    particles: THREE.Points | null
    labelSprites: THREE.Sprite[]
    clock: THREE.Clock
  } | null>(null)

  const { circuitGraph, simulationState, selectedComponentId, setSelectedComponentId } = useCircuitStore()

  const buildings = useMemo(
    () => layoutCity(circuitGraph.components, simulationState?.componentStates),
    [circuitGraph.components, simulationState?.componentStates],
  )

  const edges = circuitGraph.edges

  /* ---------- Initialise Three.js scene ---------- */
  const initScene = useCallback(() => {
    if (!containerRef.current || sceneRef.current) return
    const container = containerRef.current
    const w = container.clientWidth
    const h = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0e1a)
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.025)

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
    camera.position.set(0, 14, 18)
    camera.lookAt(0, 0, 0)

    // Lights
    const ambient = new THREE.AmbientLight(0x334466, 0.6)
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0x8899bb, 0.8)
    dirLight.position.set(8, 15, 10)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.set(1024, 1024)
    scene.add(dirLight)

    const hemi = new THREE.HemisphereLight(0x1a1a3e, 0x0a0a1e, 0.4)
    scene.add(hemi)

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(60, 60)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    ground.receiveShadow = true
    scene.add(ground)

    // Grid
    const grid = new THREE.GridHelper(60, 60, 0x1e293b, 0x1e293b)
    grid.position.y = 0
    scene.add(grid)

    sceneRef.current = {
      renderer, scene, camera,
      animId: 0,
      buildings: new Map(),
      roofs: new Map(),
      roads: [],
      particles: null,
      labelSprites: [],
      clock: new THREE.Clock(),
    }

    // Handle resize
    const onResize = () => {
      const w2 = container.clientWidth
      const h2 = container.clientHeight
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    // Animate
    const animate = () => {
      const s = sceneRef.current
      if (!s) return
      s.animId = requestAnimationFrame(animate)
      const t = s.clock.getElapsedTime()

      // Slow orbit
      s.camera.position.x = Math.sin(t * 0.08) * 18
      s.camera.position.z = Math.cos(t * 0.08) * 18
      s.camera.position.y = 12 + Math.sin(t * 0.12) * 2
      s.camera.lookAt(0, 0, 0)

      // Animate buildings
      s.buildings.forEach((mesh) => {
        const mat = mesh.material as THREE.MeshStandardMaterial
        const data = mesh.userData as CityBuilding
        if (data.fault) {
          mat.emissiveIntensity = 0.5 + Math.sin(t * 6) * 0.5
        } else if (data.powered) {
          mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + mesh.position.x) * 0.15
        }
      })

      // Animate roof glow
      s.roofs.forEach((roof) => {
        const mat = roof.material as THREE.MeshStandardMaterial
        const data = roof.userData as CityBuilding
        if (data.powered) {
          mat.emissiveIntensity = 0.6 + Math.sin(t * 3 + roof.position.x) * 0.3
        }
      })

      // Animate particles (traffic)
      if (s.particles) {
        const pos = s.particles.geometry.attributes.position as THREE.BufferAttribute
        const vel = s.particles.geometry.getAttribute('velocity') as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
          let x = pos.getX(i) + vel.getX(i) * 0.02
          let z = pos.getZ(i) + vel.getZ(i) * 0.02
          // Wrap around
          if (Math.abs(x) > 20) x = -x * 0.5
          if (Math.abs(z) > 20) z = -z * 0.5
          pos.setX(i, x)
          pos.setZ(i, z)
        }
        pos.needsUpdate = true
      }

      s.renderer.render(s.scene, s.camera)
    }
    animate()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(sceneRef.current?.animId ?? 0)
      renderer.dispose()
      container.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const cleanup = initScene()
    return cleanup
  }, [initScene])

  /* ---------- Rebuild city when data changes ---------- */
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return

    // Clear old buildings, roads, labels, particles
    s.buildings.forEach(mesh => s.scene.remove(mesh))
    s.roofs.forEach(mesh => s.scene.remove(mesh))
    for (const line of s.roads) s.scene.remove(line)
    for (const spr of s.labelSprites) s.scene.remove(spr)
    if (s.particles) s.scene.remove(s.particles)
    s.buildings.clear()
    s.roofs.clear()
    s.roads = []
    s.labelSprites = []
    s.particles = null

    if (buildings.length === 0) return

    const bldgMap = new Map<string, { x: number; z: number; h: number }>()

    // Create buildings
    for (const b of buildings) {
      const theme = THEME[b.type] ?? THEME.wire
      const h = theme.height * (b.powered ? 1 : 0.5)
      const w = b.type === 'battery' ? 1.6 : b.type === 'ground' ? 1.8 : 1.2

      const geo = new THREE.BoxGeometry(w, h, w)
      const mat = new THREE.MeshStandardMaterial({
        color: b.powered ? theme.color : 0x374151,
        emissive: b.fault ? 0xef4444 : b.powered ? theme.emissive : 0x000000,
        emissiveIntensity: b.powered ? 0.4 : 0,
        roughness: 0.6,
        metalness: 0.2,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(b.x, h / 2, b.z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = b
      s.scene.add(mesh)
      s.buildings.set(b.id, mesh)
      bldgMap.set(b.id, { x: b.x, z: b.z, h })

      // Roof glow
      if (b.powered && b.type !== 'ground' && b.type !== 'wire') {
        const roofGeo = new THREE.BoxGeometry(w * 0.6, 0.15, w * 0.6)
        const roofMat = new THREE.MeshStandardMaterial({
          color: b.fault ? 0xef4444 : theme.color,
          emissive: b.fault ? 0xef4444 : theme.color,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 0.9,
        })
        const roof = new THREE.Mesh(roofGeo, roofMat)
        roof.position.set(b.x, h + 0.1, b.z)
        roof.userData = b
        s.scene.add(roof)
        s.roofs.set(b.id, roof)
      }

      // Point light for powered buildings
      if (b.powered) {
        const pointLight = new THREE.PointLight(
          b.fault ? 0xef4444 : theme.color,
          b.currentFlow * 1.5,
          6,
        )
        pointLight.position.set(b.x, h + 0.5, b.z)
        s.scene.add(pointLight)
      }

      // Windows (small bright boxes on the building face)
      if (b.powered && h > 1 && b.type !== 'ground') {
        const windowRows = Math.floor(h / 0.6)
        for (let row = 0; row < windowRows; row++) {
          for (let col = 0; col < 2; col++) {
            const wGeo = new THREE.BoxGeometry(0.15, 0.15, 0.02)
            const wMat = new THREE.MeshStandardMaterial({
              color: b.fault ? 0xff6666 : 0xffffcc,
              emissive: b.fault ? 0xff4444 : 0xffee88,
              emissiveIntensity: 0.8 + Math.random() * 0.4,
            })
            const win = new THREE.Mesh(wGeo, wMat)
            const offsetX = (col - 0.5) * 0.4
            win.position.set(
              b.x + offsetX,
              0.4 + row * 0.55,
              b.z + w / 2 + 0.01,
            )
            s.scene.add(win)
          }
        }
      }

      // Label sprite
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'transparent'
      ctx.clearRect(0, 0, 256, 64)
      ctx.font = 'bold 22px monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = b.powered ? `#${theme.color.toString(16).padStart(6, '0')}` : '#6b7280'
      ctx.fillText(b.cityLabel, 128, 24)
      ctx.font = '16px monospace'
      ctx.fillStyle = '#9ca3af'
      ctx.fillText(b.label, 128, 48)

      const tex = new THREE.CanvasTexture(canvas)
      const sprMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 })
      const sprite = new THREE.Sprite(sprMat)
      sprite.position.set(b.x, h + 0.8, b.z)
      sprite.scale.set(3, 0.75, 1)
      s.scene.add(sprite)
      s.labelSprites.push(sprite)
    }

    // Roads
    for (const edge of edges) {
      const a = bldgMap.get(edge.sourceId)
      const b = bldgMap.get(edge.targetId)
      if (!a || !b) continue

      const csA = simulationState?.componentStates.find(cs => cs.componentId === edge.sourceId)
      const csB = simulationState?.componentStates.find(cs => cs.componentId === edge.targetId)
      const powered = (csA?.powered ?? false) && (csB?.powered ?? false)
      const fault = !!(csA?.fault || csB?.fault)
      const flow = Math.min(csA?.currentFlow ?? 0, csB?.currentFlow ?? 0)

      // Road surface
      const roadGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, 0.02, a.z),
        new THREE.Vector3(b.x, 0.02, b.z),
      ])
      const roadMat = new THREE.LineBasicMaterial({
        color: fault ? 0xef4444 : powered ? 0x06b6d4 : 0x1e293b,
        linewidth: 2,
      })
      const roadLine = new THREE.Line(roadGeo, roadMat)
      s.scene.add(roadLine)
      s.roads.push(roadLine)

      // Road bed (wider)
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.sqrt(dx * dx + dz * dz)
      const roadBedGeo = new THREE.BoxGeometry(len, 0.05, 0.4)
      const roadBedMat = new THREE.MeshStandardMaterial({
        color: powered ? 0x1e293b : 0x111827,
        roughness: 0.95,
      })
      const roadBed = new THREE.Mesh(roadBedGeo, roadBedMat)
      roadBed.position.set((a.x + b.x) / 2, 0.025, (a.z + b.z) / 2)
      roadBed.rotation.y = Math.atan2(dz, dx)
      roadBed.receiveShadow = true
      s.scene.add(roadBed)
    }

    // Traffic particles along roads
    const particlePositions: number[] = []
    const particleVelocities: number[] = []
    const particleColors: number[] = []

    for (const edge of edges) {
      const a = bldgMap.get(edge.sourceId)
      const b = bldgMap.get(edge.targetId)
      if (!a || !b) continue

      const csA = simulationState?.componentStates.find(cs => cs.componentId === edge.sourceId)
      const csB = simulationState?.componentStates.find(cs => cs.componentId === edge.targetId)
      const powered = (csA?.powered ?? false) && (csB?.powered ?? false)
      const fault = !!(csA?.fault || csB?.fault)
      const flow = Math.min(csA?.currentFlow ?? 0, csB?.currentFlow ?? 0)

      if (!powered || flow <= 0) continue

      const count = Math.ceil(flow * 8)
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.sqrt(dx * dx + dz * dz)
      const vx = (dx / len) * flow * 2
      const vz = (dz / len) * flow * 2

      for (let i = 0; i < count; i++) {
        const t = Math.random()
        particlePositions.push(a.x + dx * t, 0.15, a.z + dz * t)
        particleVelocities.push(vx, 0, vz)
        if (fault) particleColors.push(1, 0.2, 0.2)
        else particleColors.push(0.024, 0.714, 0.831)
      }
    }

    if (particlePositions.length > 0) {
      const pGeo = new THREE.BufferGeometry()
      pGeo.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3))
      pGeo.setAttribute('velocity', new THREE.Float32BufferAttribute(particleVelocities, 3))
      pGeo.setAttribute('color', new THREE.Float32BufferAttribute(particleColors, 3))

      const pMat = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      const points = new THREE.Points(pGeo, pMat)
      s.scene.add(points)
      s.particles = points
    }
  }, [buildings, edges, simulationState?.componentStates])

  // Empty state
  if (circuitGraph.components.length === 0) {
    return (
      <div
        ref={containerRef}
        className="h-full w-full flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #1a1a2e 100%)' }}
      >
        <div className="text-center text-gray-500">
          <div className="text-5xl mb-3 opacity-20">&#x1F3D9;</div>
          <p className="text-sm font-medium">City awaiting circuit data</p>
          <p className="text-xs mt-1 text-gray-600">Build or upload a schematic to generate the city</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full" style={{ background: '#0a0e1a' }} />
  )
}
