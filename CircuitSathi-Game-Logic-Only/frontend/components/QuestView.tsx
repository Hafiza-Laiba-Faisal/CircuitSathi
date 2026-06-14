'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import type { CircuitGraph, SimulationState, FaultType, ComponentType } from '../../shared/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const WORLD_W = 1600
const WORLD_H = 800
const STORY_PAUSE_MS = 4000 // 4 second pause at each landmark

// ─── Types ────────────────────────────────────────────────────────────────────
type BiomeType = 'forest' | 'dungeon' | 'desert' | 'arctic' | 'lava' | 'void'

interface LandmarkData {
  id: string
  type: string
  label: string
  value?: number
  voltageDrop?: number // for resistors: estimated V drop (e.g. −2.5 V)
  x: number
  y: number
  powered: boolean
  currentFlow: number
  fault: FaultType | null
  isClosed?: boolean
}

interface SceneData {
  biome: BiomeType
  landmarks: LandmarkData[]
  heroSpeed: number
  isEmpty: boolean
  circuitContext: { vBat: number; rTotal: number; current: number }
  edges: { sourceId: string; targetId: string }[]
  paths: PathPt[][] // Multiple paths for multiple circuits
}

interface PathPt {
  x: number
  y: number
  landmarkId?: string
  isCapacitor?: boolean
  resistanceScale?: number
}

interface Particle {
  t: number
  speed: number
  color: number
}

// ─── Chat log entry (for the overlay) ─────────────────────────────────────────
interface ChatEntry {
  id: number
  text: string
  type: 'story' | 'fault' | 'system'
  timestamp: number
}

interface HeroState {
  id: number
  container: any
  frames: any[]
  frame: number
  path: PathPt[]
  pathIdx: number
  progress: number
  pauseMs: number
  visitedLandmarks: Set<string>
  currentStoryLandmark: string | null
  introShown: boolean
  speechBubble: any
}

interface PixiState {
  app: any
  world: any
  heroes: HeroState[]
  dayNightOverlay: any
  pathContainer: any
  landmarksContainer: any
  tilesContainer: any
  particlesContainer: any
  uiContainer: any
  currentScene: SceneData | null
  elapsed: number
  animTick: number
  particles: Particle[]
  skipRequested: boolean
  voltageDropPopup: { text: string; heroId: number; yOffset: number; ageMs: number } | null
  voltageDropPopupContainer: any
  biomeTextures: Record<string, any>
}

// ─── Physics stories ──────────────────────────────────────────────────────────
function getPhysicsStory(
  type: string, label: string, value?: number,
  fault?: FaultType | null, powered?: boolean,
  voltageDrop?: number,
  circuitContext?: { vBat: number; rTotal: number; current: number },
): string {
  if (fault === 'short_circuit') return `⚠️ SHORT CIRCUIT at ${label}!\nAll current rushes through with no resistance.\nDangerous overload! I = V / 0 → ∞\nR must never be zero — fuse will blow!`
  if (fault === 'open_circuit') return `🔌 OPEN CIRCUIT at ${label}!\nThe path is broken here.\nNo current can flow through this gap.\nR = ∞, I = V/∞ = 0A`
  if (fault === 'missing_resistor') return `⚠️ MISSING RESISTOR!\n${label} needs current protection.\nWithout R: I = V/0 → ∞ → burnout!\nAdd a resistor in series!`

  switch (type) {
    case 'battery': {
      const v = value != null ? Number(value).toFixed(1) : '?'
      const iLine = circuitContext && circuitContext.rTotal > 0
        ? `\nI = ε/R = ${v}V / ${circuitContext.rTotal}Ω = ${(circuitContext.current * 1000).toFixed(1)}mA`
        : ''
      return `⚡ POWER STATION — ${label}\nVoltage: ε = ${v}V (EMF)\nGenerating the city's energy pressure.\nKirchhoff: ΣV around loop = 0${iLine}`
    }
    case 'resistor': {
      const r = value != null ? (value >= 1000 ? `${(value / 1000).toFixed(1)}kΩ` : `${Number(value).toFixed(0)}Ω`) : '?Ω'
      const vDrop = voltageDrop != null ? `V_drop = ${Number(voltageDrop).toFixed(2)}V` : ''
      const pDiss = circuitContext && circuitContext.current > 0 && value != null
        ? `P = I²R = ${(circuitContext.current * 1000).toFixed(1)}mA² × ${value}Ω = ${(circuitContext.current * circuitContext.current * value * 1000).toFixed(2)}mW`
        : ''
      return `🛑 TRAFFIC LIGHT (RESISTOR) — ${label} (${r})\nV = I × R (Ohm's Law)\n${vDrop}${vDrop && pDiss ? '\n' : ''}${pDiss}\nRegulates the city's traffic (current) flow.`
    }
    case 'led':
      return powered
        ? `💡 STREETLIGHT (LED) — ${label} GLOWING!\nForward voltage V_f ≈ 2.0–3.5V\nLighting up the city streets!\nE = h × f = hc/λ`
        : `💡 STREETLIGHT (LED) — ${label} is dark.\nNeeds energy flow to light the street.\nV_f ≈ 2.0V minimum, check your path!`
    case 'capacitor': {
      const c = value != null ? `${value}µF` : '?µF'
      return `🔋 WATER TANK (CAPACITOR) — ${label} (${c})\nStores charge: Q = C × V\nEmergency city reserves!\nI = C × dV/dt`
    }
    case 'switch':
      return value === 1
        ? `🚪 CITY GATE (SWITCH) — ${label} OPEN (CLOSED CIRCUIT)\nConducting: R_on ≈ 0Ω\nPath is open for business!`
        : `🚪 CITY GATE (SWITCH) — ${label} CLOSED (OPEN CIRCUIT)\nBlocking: R_off = ∞Ω\nCity gates are locked.`
    case 'ground':
      return `⏚ WASTE RECYCLE (GROUND) — ${label}\nReference potential: V = 0V\nAll energy returns here safely.\nΣI_in = ΣI_out`
    case 'motor':
      return powered
        ? `⚙️ FACTORY (MOTOR) — ${label} RUNNING!\nP_mech = η × V × I\nCity industry is booming!\nElectrical energy → mechanical work`
        : `⚙️ FACTORY (MOTOR) — ${label} idle.\nNeeds energy flow to start production.\nτ = K_t × I — check your path!`
    default:
      return `📍 JUNCTION — ${label}\nA crossroad in our city grid.`
  }
}

// ─── Biome palettes ───────────────────────────────────────────────────────────
const BIOME: Record<BiomeType, {
  bg: number; tile1: number; tile2: number; pathColor: number
}> = {
  forest:  { bg: 0x0a3a1a, tile1: 0x0c4420, tile2: 0x082e14, pathColor: 0x1a6b30 },
  dungeon: { bg: 0x060814, tile1: 0x0a0d22, tile2: 0x04060c, pathColor: 0x1e2a5a },
  desert:  { bg: 0x3d2a0a, tile1: 0x4a3a12, tile2: 0x2e1f08, pathColor: 0x6b4c1a },
  arctic:  { bg: 0x0a2a3a, tile1: 0x0e3a4d, tile2: 0x061e2a, pathColor: 0x3388aa },
  lava:    { bg: 0x1a0804, tile1: 0x2a0e08, tile2: 0x0e0402, pathColor: 0x882200 },
  void:    { bg: 0x0a0515, tile1: 0x150b2a, tile2: 0x05030a, pathColor: 0x4a2a6b },
}

// ─── Component → RPG colours ──────────────────────────────────────────────────
const LANDMARK_COL: Record<string, { primary: number; secondary: number; glow: number }> = {
  // Neon-leaning palette: keep base shapes but stronger glow colors for simulation
  battery:   { primary: 0xffd166, secondary: 0xffb347, glow: 0xfff59e },
  resistor:  { primary: 0xff7a59, secondary: 0xff5a33, glow: 0xff8c66 },
  capacitor: { primary: 0x6b8cff, secondary: 0x3f6bff, glow: 0x66a3ff },
  led:       { primary: 0xff9a3c, secondary: 0xff6b12, glow: 0xffcc66 },
  switch:    { primary: 0x99a3ff, secondary: 0x6f7bff, glow: 0xbfc8ff },
  ground:    { primary: 0xa76bff, secondary: 0x7a39ff, glow: 0xca9dff },
  motor:     { primary: 0xff6b8a, secondary: 0xff3d6b, glow: 0xff9db3 },
  wire:      { primary: 0xa8ffd1, secondary: 0x6bffb3, glow: 0x8dffd0 },
}

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function seededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ─── Scene derivation ─────────────────────────────────────────────────────────
function deriveScene(graph: CircuitGraph, sim: SimulationState | null): SceneData {
  const comps = graph.components
  const emptyCtx = { vBat: 0, rTotal: 1, current: 0 }
  if (comps.length === 0) {
    return { biome: 'forest', landmarks: [], heroSpeed: 150, isEmpty: true, circuitContext: emptyCtx, edges: [], paths: [] }
  }

  const faultTypes = sim?.faults.map(f => f.fault) ?? []
  let biome: BiomeType = 'forest'
  if (faultTypes.includes('short_circuit')) biome = 'lava'
  else if (faultTypes.includes('open_circuit')) biome = 'void'
  else if (comps.some(c => c.type === 'resistor' && (c.value ?? 0) > 1000)) biome = 'desert'
  else {
    const avg = (sim?.componentStates ?? [])
      .reduce((s, cs) => s + cs.currentFlow, 0) / Math.max(1, sim?.componentStates.length ?? 1)
    if (avg < 0.15) biome = 'arctic'
  }

  // ── Map canvas positions → world space (preserves layout) ──────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of comps) {
    minX = Math.min(minX, c.position.x); minY = Math.min(minY, c.position.y)
    maxX = Math.max(maxX, c.position.x); maxY = Math.max(maxY, c.position.y)
  }
  const MARGIN_X = 180, MARGIN_Y = 160
  const USABLE_W = WORLD_W - MARGIN_X * 2  // 1240
  const USABLE_H = WORLD_H - MARGIN_Y * 2  // 480
  const rangeX = Math.max(maxX - minX, 1)
  const rangeY = Math.max(maxY - minY, 1)
  const scale = Math.min(USABLE_W / rangeX, USABLE_H / rangeY)
  const scaledW = rangeX * scale
  const scaledH = rangeY * scale
  const worldOffsetX = MARGIN_X + (USABLE_W - scaledW) / 2
  const worldOffsetY = MARGIN_Y + (USABLE_H - scaledH) / 2

  // ── Multiple Loop Detection ───────────────────────────────────────────────
  const adj = new Map<string, string[]>()
  comps.forEach(c => adj.set(c.id, []))
  graph.edges.forEach(e => {
    if (adj.has(e.sourceId) && adj.has(e.targetId)) {
      adj.get(e.sourceId)!.push(e.targetId)
      adj.get(e.targetId)!.push(e.sourceId)
    }
  })

  const visitedComponents = new Set<string>()
  const groups: string[][] = []
  comps.forEach(c => {
    if (!visitedComponents.has(c.id)) {
      const group: string[] = []
      const q = [c.id]
      visitedComponents.add(c.id)
      while (q.length > 0) {
        const cur = q.shift()!
        group.push(cur)
        adj.get(cur)?.forEach(nb => {
          if (!visitedComponents.has(nb)) {
            visitedComponents.add(nb)
            q.push(nb)
          }
        })
      }
      groups.push(group)
    }
  })

  // For each group, determine if it's a closed circuit suitable for a hero
  const paths: PathPt[][] = []
  groups.forEach(groupSpecs => {
    const groupComps = comps.filter(c => groupSpecs.includes(c.id))
    const groupEdges = graph.edges.filter(e => groupSpecs.includes(e.sourceId) && groupSpecs.includes(e.targetId))
    
    // Check if this group has battery and ground
    const hasBattery = groupComps.some(c => c.type === 'battery')
    const hasGround = groupComps.some(c => c.type === 'ground')
    
    // Only spawn a path if it's a potential circuit
    if (hasBattery || hasGround || groupComps.length > 3) {
      const groupLandmarks = groupComps.map(c => {
        const x = worldOffsetX + (c.position.x - minX) * scale
        const y = worldOffsetY + (c.position.y - minY) * scale
        const cs = sim?.componentStates.find(s => s.componentId === c.id)
        return { 
          id: c.id, x, y, type: c.type, powered: cs?.powered ?? false,
          value: c.value, label: c.label || c.type, 
          currentFlow: cs?.currentFlow ?? 0, fault: null 
        }
      })
      const path = buildHeroPath(groupLandmarks as any, groupEdges as any)
      if (path.length > 1) paths.push(path)
    }
  })

  // Global context (simplified for multi-loop)
  const circuitContext = { vBat: 9, rTotal: 100, current: 0.09 }

  // Dedupe components by id (guard against accidental duplicates)
  const seen = new Set<string>()
  const landmarks: LandmarkData[] = []
  for (const comp of comps) {
    if (seen.has(comp.id)) continue
    seen.add(comp.id)
    const x = worldOffsetX + (comp.position.x - minX) * scale
    const y = worldOffsetY + (comp.position.y - minY) * scale
    const cs = sim?.componentStates.find(s => s.componentId === comp.id)
    landmarks.push({
      id: comp.id, type: comp.type, label: comp.label ?? comp.type,
      value: comp.value, x, y,
      powered: cs?.powered ?? false,
      currentFlow: cs?.currentFlow ?? 0,
      fault: null,
    })
  }

  const heroSpeed = 150
  const sceneEdges = graph.edges.map(e => ({ sourceId: e.sourceId, targetId: e.targetId }))
  return { biome, landmarks, heroSpeed, isEmpty: false, circuitContext, edges: sceneEdges, paths }
}

// ─── Path: follows actual circuit edges, mirroring the canvas layout ──────────
function buildHeroPath(landmarks: LandmarkData[], edges: { sourceId: string; targetId: string }[]): PathPt[] {
  if (landmarks.length === 0) return [{ x: WORLD_W / 2, y: WORLD_H / 2 }]
  if (landmarks.length === 1) {
    const lm = landmarks[0]
    return [{ x: lm.x, y: lm.y, landmarkId: lm.id }, { x: lm.x, y: lm.y }]
  }

  const lmMap = new Map(landmarks.map(l => [l.id, l]))

  // Build undirected adjacency from circuit edges
  const adj = new Map<string, string[]>()
  for (const lm of landmarks) adj.set(lm.id, [])
  for (const e of edges) {
    if (lmMap.has(e.sourceId) && lmMap.has(e.targetId)) {
      adj.get(e.sourceId)!.push(e.targetId)
      adj.get(e.targetId)!.push(e.sourceId)
    }
  }

  // DFS from battery (or most-connected node) to get traversal order
  const startId = (landmarks.find(l => l.type === 'battery')
    ?? landmarks.reduce((best, lm) => (adj.get(lm.id)?.length ?? 0) > (adj.get(best.id)?.length ?? 0) ? lm : best)
  ).id

  const visited = new Set<string>()
  const orderedIds: string[] = []
  const dfs = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    orderedIds.push(id)
    for (const nid of adj.get(id) ?? []) {
      if (!visited.has(nid)) dfs(nid)
    }
  }
  dfs(startId)
  // Append any disconnected landmarks
  for (const lm of landmarks) { if (!visited.has(lm.id)) orderedIds.push(lm.id) }

  const orderedLms = orderedIds.map(id => lmMap.get(id)!).filter(Boolean)

  // Build path with orthogonal waypoints between components
  const pts: PathPt[] = []
  for (let i = 0; i < orderedLms.length; i++) {
    const lm = orderedLms[i]
    const meta: Partial<PathPt> = {
      landmarkId: lm.id,
      isCapacitor: lm.type === 'capacitor',
      resistanceScale: lm.type === 'resistor' ? Math.max(0.3, 1 / (1 + (lm.value ?? 100) / 500)) : 1,
    }
    if (i > 0) {
      const prev = orderedLms[i - 1]
      // Orthogonal turn if needed (matches ReactFlow wire routing: horizontal → vertical)
      if (Math.abs(lm.x - prev.x) > 30 && Math.abs(lm.y - prev.y) > 30) {
        pts.push({ x: lm.x, y: prev.y })
      }
    }
    pts.push({ x: lm.x, y: lm.y, ...meta })
  }

  // Close the loop back to start
  const first = orderedLms[0], last = orderedLms[orderedLms.length - 1]
  if (Math.abs(last.x - first.x) > 20 || Math.abs(last.y - first.y) > 20) {
    if (Math.abs(last.x - first.x) > 30 && Math.abs(last.y - first.y) > 30) {
      pts.push({ x: first.x, y: last.y })
    }
    pts.push({ x: first.x, y: first.y })
  }

  return pts
}

// ─── Tilemap (Image-based thematic biomes) ──────────────────────────────────
async function drawTiles(PIXI: any, state: PixiState, biome: BiomeType): Promise<void> {
  const container = state.tilesContainer
  container.removeChildren()
  
  const texture = state.biomeTextures[biome]
  if (!texture) {
    // Fallback if texture not loaded
    const pal = BIOME[biome]
    const g = new PIXI.Graphics()
    g.rect(0, 0, WORLD_W, WORLD_H).fill(pal.bg)
    container.addChild(g)
    return
  }

  const tilingSprite = new PIXI.TilingSprite({
    texture: texture,
    width: WORLD_W,
    height: WORLD_H,
  })
  
  // ⚡ Dim the background to make the character and glowing paths pop out
  tilingSprite.tint = 0x999999 
  
  // 📏 Adjust scale so the image feels like a detailed floor texture
  tilingSprite.tileScale.set(0.65) 
  container.addChild(tilingSprite)
}

// ─── Path line (orthogonal circuit traces) ────────────────────────────────────
function drawPathLine(PIXI: any, container: any, pts: PathPt[], biome: BiomeType): void {
  container.removeChildren()
  if (pts.length < 2) return
  const pal = BIOME[biome]
  const g = new PIXI.Graphics()

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    // 💡 Thicker dark base for high contrast against background
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0x000000, width: 28, alpha: 0.3 })
    // Main colored trace
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: pal.pathColor, width: 22, alpha: 0.9 })
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.floor(dist / 18)
    for (let s = 0; s < steps; s += 2) {
      const t0 = s / steps, t1 = (s + 1) / steps
      // Bright glowing electron flow (more visible on backgrounds)
      g.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0)
        .lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1)
        .stroke({ color: 0xffea00, width: 6, alpha: 1.0 })
    }
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    if (!p.landmarkId) g.circle(p.x, p.y, 5).fill({ color: 0xffd700, alpha: 0.6 })
  }
  container.addChild(g)
}

// ─── Value formatter (schematic style: one decimal for V/Ω like "6.0 V", "2.0 Ω") ─
function fmtValue(type: string, value: number): string {
  if (type === 'resistor') return value >= 1000 ? `${(value / 1000).toFixed(1)}kΩ` : `${Number(value).toFixed(1)}Ω`
  if (type === 'capacitor') return value < 0.001 ? `${(value * 1e6).toFixed(0)}μF` : `${value}F`
  if (type === 'battery') return `${Number(value).toFixed(1)}V`
  return `${value}`
}

// ─── Landmark graphics (PHYSICS SCHEMATIC SYMBOLS) ────────────────────────────
function drawLandmark(PIXI: any, lm: LandmarkData): any {
  const c = new PIXI.Container()
  c.x = lm.x
  c.y = lm.y
  c.label = lm.id
  const col = LANDMARK_COL[lm.type] ?? LANDMARK_COL.wire
  const lit = lm.powered
  // Unpowered stroke: softer dark gray so neon stands out when lit
  const strokeCol = lit ? col.glow : 0x444444
  const SW = 3  // stroke width

  // Background halo to make neon pop
  if (lit) {
    const halo = new PIXI.Graphics()
    halo.beginFill(col.glow, 0.14)
    halo.drawCircle(0, 0, 52)
    halo.endFill()
    halo.blendMode = PIXI.BLEND_MODES.ADD
    c.addChild(halo)
  }

  const g = new PIXI.Graphics()

  switch (lm.type) {
    case 'battery': {
      // Standard battery symbol: long/short plates
      g.moveTo(-40, 0).lineTo(-14, 0).stroke({ color: strokeCol, width: SW })
      // Long plate (positive)
      g.moveTo(-14, -22).lineTo(-14, 22).stroke({ color: strokeCol, width: SW + 2 })
      // Short plate (negative)
      g.moveTo(-4, -12).lineTo(-4, 12).stroke({ color: strokeCol, width: SW })
      // Long plate 2
      g.moveTo(6, -22).lineTo(6, 22).stroke({ color: strokeCol, width: SW + 2 })
      // Short plate 2
      g.moveTo(16, -12).lineTo(16, 12).stroke({ color: strokeCol, width: SW })
      // Right lead
      g.moveTo(16, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      break
    }
    case 'resistor': {
      // IEC rectangle style
      g.moveTo(-40, 0).lineTo(-22, 0).stroke({ color: strokeCol, width: SW })
      g.rect(-22, -12, 44, 24).stroke({ color: strokeCol, width: SW })
      if (lit) g.rect(-22, -12, 44, 24).fill({ color: col.glow, alpha: 0.08 })
      g.moveTo(22, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      break
    }
    case 'capacitor': {
      // Two parallel plates
      g.moveTo(-40, 0).lineTo(-6, 0).stroke({ color: strokeCol, width: SW })
      g.moveTo(-6, -22).lineTo(-6, 22).stroke({ color: strokeCol, width: SW + 2 })
      g.moveTo(6, -22).lineTo(6, 22).stroke({ color: strokeCol, width: SW + 2 })
      g.moveTo(6, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      if (lit) {
        g.rect(-6, -22, 12, 44).fill({ color: col.glow, alpha: 0.1 })
      }
      break
    }
    case 'led': {
      // Diode triangle + bar + light arrows
      g.moveTo(-40, 0).lineTo(-16, 0).stroke({ color: strokeCol, width: SW })
      // Triangle (anode)
      g.poly([-16, -16, -16, 16, 10, 0]).fill({ color: lit ? 0xff8800 : 0x333333, alpha: lit ? 0.5 : 0.3 })
      g.poly([-16, -16, -16, 16, 10, 0]).stroke({ color: strokeCol, width: SW })
      // Bar (cathode)
      g.moveTo(10, -16).lineTo(10, 16).stroke({ color: strokeCol, width: SW + 1 })
      g.moveTo(10, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      // Light arrows (pointing up-right)
      if (lit) {
        g.moveTo(14, -18).lineTo(22, -26).stroke({ color: 0xffdd00, width: 2 })
        g.poly([20, -28, 24, -24, 18, -24]).fill(0xffdd00)
        g.moveTo(20, -12).lineTo(28, -20).stroke({ color: 0xffdd00, width: 2 })
        g.poly([26, -22, 30, -18, 24, -18]).fill(0xffdd00)
      }
      break
    }
    case 'switch': {
      // Two dots with a lever
      g.moveTo(-40, 0).lineTo(-16, 0).stroke({ color: strokeCol, width: SW })
      g.circle(-16, 0, 4).fill(strokeCol)
      g.circle(16, 0, 4).fill(strokeCol)
      if (lm.isClosed) {
        // Closed — flat line
        g.moveTo(-16, 0).lineTo(16, 0).stroke({ color: strokeCol, width: SW })
      } else {
        // Open — angled lever
        g.moveTo(-16, 0).lineTo(14, -16).stroke({ color: strokeCol, width: SW })
      }
      g.moveTo(16, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      break
    }
    case 'ground': {
      // Three horizontal bars of decreasing width
      g.moveTo(0, -30).lineTo(0, -6).stroke({ color: strokeCol, width: SW })
      g.moveTo(-24, -6).lineTo(24, -6).stroke({ color: strokeCol, width: SW + 2 })
      g.moveTo(-16, 4).lineTo(16, 4).stroke({ color: strokeCol, width: SW })
      g.moveTo(-8, 14).lineTo(8, 14).stroke({ color: strokeCol, width: SW })
      g.moveTo(-2, 22).lineTo(2, 22).stroke({ color: strokeCol, width: SW - 1 })
      break
    }
    case 'motor': {
      // Circle with M
      g.moveTo(-40, 0).lineTo(-20, 0).stroke({ color: strokeCol, width: SW })
      g.circle(0, 0, 20).stroke({ color: strokeCol, width: SW })
      if (lit) g.circle(0, 0, 20).fill({ color: col.glow, alpha: 0.1 })
      g.moveTo(20, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      break
    }
    default: {
      // Junction dot
      g.circle(0, 0, 6).fill(strokeCol)
      g.moveTo(-40, 0).lineTo(-6, 0).stroke({ color: strokeCol, width: SW })
      g.moveTo(6, 0).lineTo(40, 0).stroke({ color: strokeCol, width: SW })
      break
    }
  }

  if (lm.fault === 'short_circuit') {
    g.circle(0, 0, 44).stroke({ color: 0xff0000, width: 3 })
  }

  c.addChild(g)

  // "M" text for motor (drawn separately since Graphics can't do text)
  if (lm.type === 'motor') {
    const mText = new PIXI.Text({
      text: 'M',
      style: { fontFamily: 'monospace', fontSize: 18, fill: strokeCol, fontWeight: 'bold' },
    })
    mText.anchor.set(0.5)
    mText.y = 1
    c.addChild(mText)
  }

  // "+" and "−" labels for battery
  if (lm.type === 'battery') {
    const plus = new PIXI.Text({ text: '+', style: { fontFamily: 'monospace', fontSize: 12, fill: strokeCol } })
    plus.anchor.set(0.5)
    plus.x = -14; plus.y = -30
    c.addChild(plus)
    const minus = new PIXI.Text({ text: '−', style: { fontFamily: 'monospace', fontSize: 12, fill: strokeCol } })
    minus.anchor.set(0.5)
    minus.x = 16; minus.y = -30
    c.addChild(minus)
  }

  // Label below
  const labelText = new PIXI.Text({
    text: lm.label.slice(0, 14).toUpperCase(),
    style: { fontFamily: 'monospace', fontSize: 10, fill: 0xbbbbbb, align: 'center' },
  })
  labelText.anchor.set(0.5, 0)
  labelText.y = 32
  c.addChild(labelText)

  // Value below label
  if (lm.value !== undefined && lm.value !== null) {
    const valText = new PIXI.Text({
      text: fmtValue(lm.type, lm.value),
      style: { fontFamily: 'monospace', fontSize: 10, fill: lit ? col.glow : 0x888888, align: 'center', fontWeight: 'bold' },
    })
    valText.anchor.set(0.5, 0)
    valText.y = 44
    c.addChild(valText)
  }

  return c
}

function drawLandmarksLayer(PIXI: any, container: any, landmarks: LandmarkData[]): void {
  container.removeChildren()
  for (const lm of landmarks) container.addChild(drawLandmark(PIXI, lm))
}

export { }
