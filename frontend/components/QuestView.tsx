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
  isClosedCircuit: boolean
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

interface PixiState {
  app: any
  world: any
  heroContainer: any
  heroFrames: any[]
  heroFrameIdx: number
  heroFrameTimer: number
  speechBubbleContainer: any
  dayNightOverlay: any
  pathContainer: any
  landmarksContainer: any
  tilesContainer: any
  particlesContainer: any
  uiContainer: any
  currentScene: SceneData | null
  heroPath: PathPt[]
  heroPathIdx: number
  heroProgress: number
  heroPauseMs: number
  elapsed: number
  animTick: number
  particles: Particle[]
  visitedLandmarks: Set<string>
  currentStoryLandmark: string | null
  skipRequested: boolean
  voltageDropPopup: { text: string; yOffset: number; ageMs: number } | null
  voltageDropPopupContainer: any
  heroIntroShown: boolean
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
      return `⚡ POWER SOURCE — ${label}\nVoltage: ε = ${v}V (EMF)\nPushes electrons like water pressure.\nKirchhoff: ΣV around loop = 0${iLine}`
    }
    case 'resistor': {
      const r = value != null ? (value >= 1000 ? `${(value / 1000).toFixed(1)}kΩ` : `${Number(value).toFixed(0)}Ω`) : '?Ω'
      const vDrop = voltageDrop != null ? `V_drop = ${Number(voltageDrop).toFixed(2)}V` : ''
      const pDiss = circuitContext && circuitContext.current > 0 && value != null
        ? `P = I²R = ${(circuitContext.current * 1000).toFixed(1)}mA² × ${value}Ω = ${(circuitContext.current * circuitContext.current * value * 1000).toFixed(2)}mW`
        : ''
      return `🔥 RESISTOR — ${label} (${r})\nV = I × R (Ohm's Law)\n${vDrop}${vDrop && pDiss ? '\n' : ''}${pDiss}\nConverts electrical energy → heat.`
    }
    case 'led':
      return powered
        ? `💡 LED — ${label} GLOWING!\nForward voltage V_f ≈ 2.0–3.5V\nCurrent → photon emission\nE = h × f = hc/λ\nTypical: λ_red≈625nm, λ_green≈530nm`
        : `💡 LED — ${label} is dark.\nNeeds forward bias to emit light.\nV_f ≈ 2.0V minimum, check your path!\nNo current → no photons → no light.`
    case 'capacitor': {
      const c = value != null ? `${value}µF` : '?µF'
      return `🔋 CAPACITOR — ${label} (${c})\nStores charge: Q = C × V\nStored energy: E = ½CV²\nActs as: short at high freq,\nopen at DC (steady state).\nI = C × dV/dt`
    }
    case 'switch':
      return value === 1
        ? `🚪 SWITCH — ${label} CLOSED\nConducting: R_on ≈ 0Ω\nCurrent flows freely.\nDouble-click to open!`
        : `🚪 SWITCH — ${label} OPEN\nBlocking: R_off = ∞Ω\nI = V/∞ = 0A — no current.\nDouble-click to close!`
    case 'ground':
      return `⏚ GROUND — ${label}\nReference potential: V = 0V\nKirchhoff's Current Law:\nΣI_in = ΣI_out at every node.\nAll current returns here.`
    case 'motor':
      return powered
        ? `⚙️ MOTOR — ${label} SPINNING!\nP_mech = η × V × I\nTorque: τ = K_t × I\nBack-EMF: V_back = K_e × ω\nElectrical energy → mechanical work`
        : `⚙️ MOTOR — ${label} idle.\nNeeds current to produce torque.\nτ = K_t × I — check your path!`
    default:
      return `📍 JUNCTION — ${label}\nNode in circuit topology.\nKirchhoff: ΣI = 0 at each node.`
  }
}

// ─── Biome palettes ───────────────────────────────────────────────────────────
const BIOME: Record<BiomeType, {
  bg: number; tile1: number; tile2: number; pathColor: number
}> = {
  forest:  { bg: 0x123d18, tile1: 0x1a4d22, tile2: 0x0e3010, pathColor: 0x6b4c30 },
  dungeon: { bg: 0x0c0b20, tile1: 0x16143a, tile2: 0x0a0918, pathColor: 0x2a2255 },
  desert:  { bg: 0x3a2410, tile1: 0x4a3018, tile2: 0x2e1c0c, pathColor: 0x8c7040 },
  arctic:  { bg: 0x0e1e30, tile1: 0x182a42, tile2: 0x0a1624, pathColor: 0x6090a8 },
  lava:    { bg: 0x1a0404, tile1: 0x280a0a, tile2: 0x0e0202, pathColor: 0xcc3300 },
  void:    { bg: 0x040408, tile1: 0x0a0c1c, tile2: 0x020204, pathColor: 0x2a1255 },
}

// ─── Component → RPG colours ──────────────────────────────────────────────────
const LANDMARK_COL: Record<string, { primary: number; secondary: number; glow: number }> = {
  battery:   { primary: 0xffd700, secondary: 0xb8860b, glow: 0xffaa00 },
  resistor:  { primary: 0x4a3020, secondary: 0x6a4030, glow: 0x8b5a30 },
  capacitor: { primary: 0x2a2280, secondary: 0x1a1850, glow: 0x4040cc },
  led:       { primary: 0xff6600, secondary: 0xcc3300, glow: 0xffcc44 },
  switch:    { primary: 0x808080, secondary: 0x505050, glow: 0xaaaacc },
  ground:    { primary: 0x6b21a8, secondary: 0x3b1178, glow: 0xaa55ff },
  motor:     { primary: 0xcc2200, secondary: 0x881500, glow: 0xff4400 },
  wire:      { primary: 0x888888, secondary: 0x555555, glow: 0xaaaaaa },
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
    return { biome: 'forest', landmarks: [], heroSpeed: 150, isEmpty: true, circuitContext: emptyCtx, edges: [], isClosedCircuit: false }
  }

  const faultTypes = sim?.faults.map(f => f.fault) ?? []
  let biome: BiomeType = 'forest'
  if (faultTypes.includes('short_circuit')) biome = 'lava'
  else if (faultTypes.includes('open_circuit')) biome = 'void'
  else if (comps.some(c => c.type === 'capacitor')) biome = 'dungeon'
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
  const toWorldX = (cx: number) => worldOffsetX + (cx - minX) * scale
  const toWorldY = (cy: number) => worldOffsetY + (cy - minY) * scale

  // Compute circuit physics: voltage drops, series current
  const battery = comps.find(c => c.type === 'battery')
  const vBat = battery?.value ?? 6
  const resistors = comps.filter(c => c.type === 'resistor')
  const rTotal = resistors.reduce((s, c) => s + (c.value ?? 0), 0) || 1
  const seriesCurrent = vBat / rTotal
  const voltageDrops = new Map<string, number>()
  resistors.forEach(r => {
    const ri = r.value ?? 0
    if (ri > 0) voltageDrops.set(r.id, (vBat * ri) / rTotal)
  })
  const circuitContext = { vBat, rTotal, current: seriesCurrent }

  const landmarks: LandmarkData[] = comps.map(comp => {
    const x = toWorldX(comp.position.x)
    const y = toWorldY(comp.position.y)
    const cs = sim?.componentStates.find(s => s.componentId === comp.id)
    const fault = sim?.faults.find(f => f.componentId === comp.id)?.fault ?? null
    const voltageDrop = comp.type === 'resistor' ? voltageDrops.get(comp.id) : undefined
    return {
      id: comp.id, type: comp.type, label: comp.label ?? comp.type,
      value: comp.value, voltageDrop, x, y,
      powered: cs?.powered ?? false,
      currentFlow: cs?.currentFlow ?? 0,
      fault,
      isClosed: comp.type === 'switch' ? (cs?.powered ?? false) : undefined,
    }
  })

  // Is the circuit closed? Battery and ground must both be powered, no short circuit.
  const battComp = comps.find(c => c.type === 'battery')
  const gndComp  = comps.find(c => c.type === 'ground')
  const battPowered = battComp ? (sim?.componentStates.find(cs => cs.componentId === battComp.id)?.powered ?? false) : false
  const gndPowered  = gndComp  ? (sim?.componentStates.find(cs => cs.componentId === gndComp.id)?.powered  ?? false) : false
  const hasShort = faultTypes.includes('short_circuit')
  const isClosedCircuit = battPowered && gndPowered && !hasShort

  const maxFlow = Math.max(0.05, ...landmarks.map(l => l.currentFlow))
  const heroSpeed = 80 + maxFlow * 100
  const sceneEdges = graph.edges.map(e => ({ sourceId: e.sourceId, targetId: e.targetId }))
  return { biome, landmarks, heroSpeed, isEmpty: false, circuitContext, edges: sceneEdges, isClosedCircuit }
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

// ─── Tilemap ──────────────────────────────────────────────────────────────────
function drawTiles(PIXI: any, container: any, biome: BiomeType): void {
  container.removeChildren()
  const pal = BIOME[biome]
  const g = new PIXI.Graphics()
  g.rect(0, 0, WORLD_W, WORLD_H).fill(pal.bg)

  const TILE = 32
  for (let tx = 0; tx < WORLD_W / TILE; tx++) {
    for (let ty = 0; ty < WORLD_H / TILE; ty++) {
      const h = (tx * 1619 + ty * 2971) % 17
      if (h < 3) g.rect(tx * TILE, ty * TILE, TILE, TILE).fill(pal.tile1)
      else if (h < 5) g.rect(tx * TILE, ty * TILE, TILE, TILE).fill(pal.tile2)
    }
  }

  const rng = seededRng(biome.charCodeAt(0) * 997)
  if (biome === 'forest') {
    for (let i = 0; i < 120; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, sz = 12 + rng() * 20
      g.rect(x - sz / 4, y, sz / 2, sz * 0.7).fill(0x2d1a00)
      g.rect(x - sz / 2, y - sz * 0.8, sz, sz * 0.8).fill(0x0d5c1a)
      g.rect(x - sz * 0.3, y - sz * 1.3, sz * 0.6, sz * 0.5).fill(0x147a24)
    }
  } else if (biome === 'dungeon') {
    for (let i = 0; i < 40; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H
      const w = 12 + rng() * 16, h2 = 40 + rng() * 60
      g.rect(x, y, w, h2).fill(0x1e1c38)
      g.rect(x + 2, y + 2, w - 4, 6).fill(0x2e2a50)
    }
    for (let i = 0; i < 20; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H
      g.rect(x, y, 8, 16).fill(0x3a3060)
      g.rect(x - 2, y - 8, 12, 8).fill(0xff8800)
    }
  } else if (biome === 'desert') {
    for (let i = 0; i < 60; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H
      g.ellipse(x, y, 80 + rng() * 100, 18 + rng() * 30).fill({ color: 0x7a5c30, alpha: 0.4 })
    }
  } else if (biome === 'arctic') {
    for (let i = 0; i < 80; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, h2 = 15 + rng() * 30
      g.poly([x, y - h2, x + h2 / 3, y, x, y + 4, x - h2 / 3, y])
        .fill({ color: 0x88ccee, alpha: 0.3 })
    }
  } else if (biome === 'lava') {
    for (let i = 0; i < 60; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H
      g.ellipse(x, y, 20 + rng() * 50, 8 + rng() * 20).fill({ color: 0xdd2200, alpha: 0.4 })
    }
  } else if (biome === 'void') {
    for (let i = 0; i < 70; i++) {
      const x = rng() * WORLD_W, y = rng() * WORLD_H, s = 4 + rng() * 12
      g.rect(x, y, s, s).fill({ color: 0x3a1a5a, alpha: 0.6 })
    }
  }
  container.addChild(g)
}

// ─── Path line (orthogonal circuit traces) ────────────────────────────────────
function drawPathLine(PIXI: any, container: any, pts: PathPt[], biome: BiomeType): void {
  container.removeChildren()
  if (pts.length < 2) return
  const pal = BIOME[biome]
  const g = new PIXI.Graphics()

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: pal.pathColor, width: 24, alpha: 0.7 })
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.floor(dist / 18)
    for (let s = 0; s < steps; s += 2) {
      const t0 = s / steps, t1 = (s + 1) / steps
      g.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0)
        .lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1)
        .stroke({ color: 0xffd700, width: 2, alpha: 0.5 })
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
  const strokeCol = lit ? col.glow : 0xcccccc
  const SW = 3  // stroke width

  // Background circle glow
  const bg = new PIXI.Graphics()
  if (lit) {
    bg.circle(0, 0, 50).fill({ color: col.glow, alpha: 0.08 })
  }
  c.addChild(bg)

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

// ─── Hero sprite (two walking frames) ─────────────────────────────────────────
function buildHeroFrame(PIXI: any, frame: 0 | 1): any {
  const g = new PIXI.Graphics()
  if (frame === 0) {
    g.rect(-10, 10, 7, 7).fill(0x3a1e00)
    g.rect(3, 12, 7, 5).fill(0x3a1e00)
    g.rect(-10, 0, 7, 11).fill(0x3b1d6e)
    g.rect(3, 2, 7, 11).fill(0x3b1d6e)
  } else {
    g.rect(-8, 12, 7, 5).fill(0x3a1e00)
    g.rect(1, 10, 7, 7).fill(0x3a1e00)
    g.rect(-8, 2, 7, 11).fill(0x3b1d6e)
    g.rect(1, 0, 7, 11).fill(0x3b1d6e)
  }
  g.rect(-5, -1, 10, 4).fill(0xf59e0b)
  g.rect(-9, -16, 18, 17).fill(0x6b21a8)
  g.rect(-13, -16, 5, 7).fill(0x7a2bbf)
  g.rect(8, -16, 5, 7).fill(0x7a2bbf)
  if (frame === 0) {
    g.rect(-12, -12, 4, 11).fill(0x6b21a8)
    g.rect(8, -8, 4, 9).fill(0x6b21a8)
  } else {
    g.rect(-12, -8, 4, 9).fill(0x6b21a8)
    g.rect(8, -12, 4, 11).fill(0x6b21a8)
  }
  g.rect(-12, -2, 4, 5).fill(0xf4b87a)
  g.rect(8, -2, 4, 5).fill(0xf4b87a)
  g.rect(-3, -18, 6, 3).fill(0xf4b87a)
  g.rect(-7, -30, 14, 13).fill(0xf4b87a)
  g.rect(-7, -30, 14, 4).fill(0xc8860a)
  g.rect(-9, -28, 3, 8).fill(0xc8860a)
  g.rect(6, -28, 3, 8).fill(0xc8860a)
  g.rect(-5, -23, 3, 3).fill(0x1a1a88)
  g.rect(2, -23, 3, 3).fill(0x1a1a88)
  g.rect(-3, -18, 6, 2).fill(0xcc7755)
  g.rect(12, -24, 3, 26).fill(0xdddddd)
  g.rect(8, -26, 10, 4).fill(0xaa8800)
  g.rect(13, -28, 2, 5).fill(0xdddddd)
  return g
}

function buildHeroGfx(PIXI: any): { container: any; frames: any[] } {
  const container = new PIXI.Container()
  const f0 = buildHeroFrame(PIXI, 0)
  const f1 = buildHeroFrame(PIXI, 1)
  f1.visible = false
  container.addChild(f0)
  container.addChild(f1)
  return { container, frames: [f0, f1] }
}

// ─── Landmark animation ───────────────────────────────────────────────────────
function animateLandmarks(container: any, tick: number, scene: SceneData): void {
  for (const child of container.children) {
    const lm = scene.landmarks.find(l => l.id === child.label)
    if (!lm) continue
    if (lm.type === 'led' && lm.powered) {
      child.alpha = 0.8 + 0.2 * Math.sin(tick * 0.12)
    } else if (lm.fault === 'short_circuit') {
      child.alpha = 0.5 + 0.5 * Math.sin(tick * 0.35)
    } else if (lm.type === 'ground' && lm.powered) {
      child.rotation = (tick * 0.008) % (Math.PI * 2)
    } else {
      child.alpha = 1
    }
  }
}

// ─── Particle flow ────────────────────────────────────────────────────────────
function updateParticles(PIXI: any, container: any, state: PixiState): void {
  container.removeChildren()
  const scene = state.currentScene
  const path = state.heroPath
  if (!scene || scene.isEmpty || path.length < 2) return

  const maxFlow = Math.max(0, ...scene.landmarks.map(l => l.currentFlow))
  if (maxFlow < 0.05) { state.particles = []; return }

  const wantedCount = Math.floor(maxFlow * 18) + 4
  const pathSegments = path.length - 1

  while (state.particles.length < wantedCount) {
    state.particles.push({
      t: Math.random(),
      speed: 0.0006 + Math.random() * 0.0008,
      color: scene.biome === 'lava' ? 0xff4400 : scene.biome === 'void' ? 0x8844ff : 0xffd700,
    })
  }
  while (state.particles.length > 25) state.particles.pop()

  const g = new PIXI.Graphics()
  for (const p of state.particles) {
    p.t = (p.t + p.speed * (scene.heroSpeed / 100)) % 1
    const segT = p.t * pathSegments
    const segIdx = Math.min(pathSegments - 1, Math.floor(segT))
    const segFrac = segT - segIdx
    const a = path[segIdx], b = path[Math.min(path.length - 1, segIdx + 1)]
    const px = a.x + (b.x - a.x) * segFrac
    const py = a.y + (b.y - a.y) * segFrac
    g.circle(px, py, 4).fill({ color: p.color, alpha: 0.85 })
  }
  container.addChild(g)
}

// ─── Speech bubble ────────────────────────────────────────────────────────────
function drawSpeechBubble(PIXI: any, container: any, text: string, heroX: number, heroY: number): void {
  container.removeChildren()
  if (!text) return

  const PADDING = 12
  const TAIL_H = 10
  const MAX_W = 200

  // Text first to measure
  const txt = new PIXI.Text({
    text,
    style: {
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: 8,
      fill: 0xe2e8f0,
      align: 'left',
      lineHeight: 14,
      wordWrap: true,
      wordWrapWidth: MAX_W - PADDING * 2,
    },
  })

  const bubbleW = Math.min(MAX_W, txt.width + PADDING * 2)
  const bubbleH = txt.height + PADDING * 2

  const g = new PIXI.Graphics()
  // Bubble body
  g.roundRect(-bubbleW / 2, -bubbleH - TAIL_H, bubbleW, bubbleH, 6)
    .fill({ color: 0x0f172a, alpha: 0.92 })
  g.roundRect(-bubbleW / 2, -bubbleH - TAIL_H, bubbleW, bubbleH, 6)
    .stroke({ color: 0x475569, width: 1.5 })
  // Tail
  g.poly([
    -6, -TAIL_H,
    6, -TAIL_H,
    0, 2,
  ]).fill({ color: 0x0f172a, alpha: 0.92 })

  txt.x = -bubbleW / 2 + PADDING
  txt.y = -bubbleH - TAIL_H + PADDING

  container.addChild(g)
  container.addChild(txt)

  // Position above hero
  container.x = heroX
  container.y = heroY - 40
}

// ─── Voltage drop popup (floating "−X.X V" when hero passes a resistor) ──────
function drawVoltageDropPopup(PIXI: any, state: PixiState): void {
  const container = state.voltageDropPopupContainer
  container.removeChildren()
  if (!state.voltageDropPopup) return
  const pop = state.voltageDropPopup
  const txt = new PIXI.Text({
    text: pop.text,
    style: {
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0xffaa44,
      fontWeight: 'bold',
    },
  })
  txt.anchor.set(0.5)
  txt.x = 0
  txt.y = 0
  container.x = state.heroContainer.x
  container.y = state.heroContainer.y - 58 + pop.yOffset
  container.alpha = Math.max(0, 1 - pop.ageMs / 2000)
  container.addChild(txt)
}

// ─── Day/night ────────────────────────────────────────────────────────────────
function updateDayNight(PIXI: any, overlay: any, elapsed: number, app: any): void {
  const W = app.screen.width, H = app.screen.height
  const t = (elapsed % 60_000) / 60_000
  let color: number, alpha: number
  if (t < 0.25) { color = 0xff8800; alpha = 0.07 * (1 - t / 0.25) }
  else if (t < 0.5) { color = 0xffffff; alpha = 0 }
  else if (t < 0.75) { color = 0xff4400; alpha = ((t - 0.5) / 0.25) * 0.1 }
  else { color = 0x000044; alpha = 0.12 + ((t - 0.75) / 0.25) * 0.1 }

  overlay.clear()
  if (alpha > 0.001) overlay.rect(0, 0, W, H).fill({ color, alpha })
}

// ─── Hero movement (step-by-step with story pauses) ───────────────────────────
function updateHero(state: PixiState, deltaMS: number, addChatEntry: (text: string, type: ChatEntry['type']) => void): void {
  const scene = state.currentScene
  if (!scene || scene.isEmpty || state.heroPath.length < 2) return
  if (!scene.isClosedCircuit) return

  // Handle skip
  if (state.skipRequested && state.heroPauseMs > 0) {
    state.heroPauseMs = 0
    state.currentStoryLandmark = null
    state.skipRequested = false
    return
  }
  state.skipRequested = false

  if (state.heroPauseMs > 0) {
    state.heroPauseMs -= deltaMS
    if (state.heroPauseMs <= 0) {
      state.currentStoryLandmark = null
    }
    return
  }

  const pathLen = state.heroPath.length - 1
  const segIdx = state.heroPathIdx % pathLen
  const a = state.heroPath[segIdx]
  const b = state.heroPath[(segIdx + 1) % state.heroPath.length]
  const dist = Math.hypot(b.x - a.x, b.y - a.y)
  if (dist < 1) {
    state.heroPathIdx = (state.heroPathIdx + 1) % pathLen
    state.heroProgress = 0
    return
  }

  const resistScale = a.resistanceScale ?? 1
  const step = (scene.heroSpeed * resistScale * deltaMS) / 1000 / dist
  state.heroProgress += step

  // Toggle walking frame
  state.heroFrameTimer += deltaMS
  if (state.heroFrameTimer >= 180) {
    state.heroFrameTimer = 0
    state.heroFrameIdx = 1 - state.heroFrameIdx
    for (let fi = 0; fi < state.heroFrames.length; fi++) {
      state.heroFrames[fi].visible = fi === state.heroFrameIdx
    }
  }

  if (state.heroProgress >= 1) {
    state.heroProgress = 0
    const nextIdx = (state.heroPathIdx + 1) % pathLen
    state.heroPathIdx = nextIdx
    const nextPt = state.heroPath[nextIdx]

    // Story pause at each landmark
    if (nextPt.landmarkId && !state.visitedLandmarks.has(nextPt.landmarkId)) {
      const lm = scene.landmarks.find(l => l.id === nextPt.landmarkId)
      if (lm) {
        state.visitedLandmarks.add(lm.id)
        state.currentStoryLandmark = lm.id
        state.heroPauseMs = STORY_PAUSE_MS
        const story = getPhysicsStory(lm.type, lm.label, lm.value, lm.fault, lm.powered, lm.voltageDrop, state.currentScene?.circuitContext)
        addChatEntry(story, lm.fault ? 'fault' : 'story')
        // Small "−X.X V" popup when passing through a resistor
        if (lm.type === 'resistor' && lm.voltageDrop != null && lm.voltageDrop > 0) {
          state.voltageDropPopup = { text: `−${Number(lm.voltageDrop).toFixed(1)} V`, yOffset: 0, ageMs: 0 }
        }
      }
    }
    return
  }

  const baseX = a.x + (b.x - a.x) * state.heroProgress
  const baseY = a.y + (b.y - a.y) * state.heroProgress
  const bob = Math.sin(state.elapsed * 0.012) * 3
  state.heroContainer.x = baseX
  state.heroContainer.y = baseY + bob
  const dx = b.x - a.x
  if (Math.abs(dx) > 1) state.heroContainer.scale.x = dx > 0 ? 1 : -1
}

// ─── Wipe transition ──────────────────────────────────────────────────────────
function wipeTransition(PIXI: any, app: any, onMidpoint: () => void): void {
  const W = app.screen.width, H = app.screen.height
  const cover = new PIXI.Graphics()
  app.stage.addChild(cover)
  const HALF = 200
  let elapsed = 0, fired = false

  const tick = (ticker: any) => {
    elapsed += ticker.deltaMS
    cover.clear()
    if (elapsed <= HALF) {
      cover.rect(0, 0, W, (elapsed / HALF) * H).fill(0x000000)
    } else {
      if (!fired) { fired = true; onMidpoint() }
      const h = H * (1 - Math.min(1, (elapsed - HALF) / HALF))
      if (h > 0) cover.rect(0, 0, W, h).fill(0x000000)
    }
    if (elapsed >= HALF * 2) { app.ticker.remove(tick); cover.destroy() }
  }
  app.ticker.add(tick)
}

// ─── Empty screen ─────────────────────────────────────────────────────────────
function buildEmptyScreen(PIXI: any, container: any): void {
  container.removeChildren()
  const g = new PIXI.Graphics()
  const rng = seededRng(1337)
  for (let i = 0; i < 250; i++) {
    const x = rng() * WORLD_W, y = rng() * WORLD_H
    const s = rng() > 0.9 ? 2 : 1
    g.rect(x, y, s, s).fill({ color: 0xffffff, alpha: 0.3 + rng() * 0.7 })
  }
  container.addChild(g)

  const msg = new PIXI.Text({
    text: 'DRAW A CIRCUIT\nOR UPLOAD A SCHEMATIC\nTO BEGIN YOUR QUEST\n\nCLICK HERO TO ADD COMPONENTS',
    style: { fontFamily: 'monospace', fontSize: 18, fill: 0x8866aa, align: 'center', lineHeight: 32 },
  })
  msg.anchor.set(0.5)
  msg.x = WORLD_W / 2
  msg.y = WORLD_H / 2
  container.addChild(msg)
}

// ─── Build full scene ─────────────────────────────────────────────────────────
function buildScene(PIXI: any, state: PixiState, scene: SceneData, app: any): void {
  state.currentScene = scene
  state.particles = []

  drawTiles(PIXI, state.tilesContainer, scene.biome)
  const path = buildHeroPath(scene.landmarks, scene.edges)
  state.heroPath = path
  // Only draw path trace when circuit is closed (it forms a real loop)
  if (scene.isClosedCircuit) {
    drawPathLine(PIXI, state.pathContainer, path, scene.biome)
  } else {
    state.pathContainer.removeChildren()
  }

  if (scene.isEmpty) {
    buildEmptyScreen(PIXI, state.landmarksContainer)
    state.heroContainer.visible = false
    state.world.x = app.screen.width / 2 - WORLD_W / 2
    state.world.y = app.screen.height / 2 - WORLD_H / 2
  } else {
    state.heroContainer.visible = true
    drawLandmarksLayer(PIXI, state.landmarksContainer, scene.landmarks)
    const start = path[0] ?? { x: WORLD_W / 2, y: WORLD_H / 2 }
    state.heroContainer.x = start.x
    state.heroContainer.y = start.y
    state.heroPathIdx = 0
    state.heroProgress = 0
    state.visitedLandmarks = new Set()
    state.currentStoryLandmark = null
    state.heroPauseMs = 0
    // Only pre-pause at first landmark if circuit is closed and ready to move
    if (scene.isClosedCircuit && start.landmarkId) {
      const firstLm = scene.landmarks.find(l => l.id === start.landmarkId)
      if (firstLm) {
        state.visitedLandmarks.add(firstLm.id)
        state.currentStoryLandmark = firstLm.id
        state.heroPauseMs = STORY_PAUSE_MS
      }
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
let _chatIdCounter = 0

export default function QuestView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const pixiStateRef = useRef<PixiState | null>(null)
  const circuitGraphRef = useRef<CircuitGraph>({ components: [], edges: [] })
  const simulationStateRef = useRef<SimulationState | null>(null)

  const circuitGraph = useCircuitStore(s => s.circuitGraph)
  const simulationState = useCircuitStore(s => s.simulationState)
  const requestCircuitLoad = useCircuitStore(s => s.requestCircuitLoad)
  const setCurrentNarration = useCircuitStore(s => s.setCurrentNarration)

  // Chat log state
  const [chatLog, setChatLog] = useState<ChatEntry[]>([])
  const [showComponentPicker, setShowComponentPicker] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const onHeroClickRef = useRef<() => void>(() => {})

  const addChatEntry = useCallback((text: string, type: ChatEntry['type']) => {
    const entry: ChatEntry = { id: ++_chatIdCounter, text, type, timestamp: Date.now() }
    setChatLog(prev => [...prev.slice(-20), entry])
    if (type === 'story') setCurrentNarration(text)
  }, [setCurrentNarration])

  const addChatEntryRef = useRef(addChatEntry)
  addChatEntryRef.current = addChatEntry
  onHeroClickRef.current = () => setShowComponentPicker(true)

  // Component picker items
  const PICKER_ITEMS: { type: ComponentType; label: string; color: string; symbol: string; defaultValue?: number }[] = [
    { type: 'battery',   label: 'BATTERY',   color: '#22c55e', symbol: '⚡', defaultValue: 9   },
    { type: 'resistor',  label: 'RESISTOR',  color: '#f59e0b', symbol: 'Ω',  defaultValue: 220 },
    { type: 'led',       label: 'LED',       color: '#ef4444', symbol: '◐'                      },
    { type: 'capacitor', label: 'CAPACITOR', color: '#3b82f6', symbol: '||', defaultValue: 100 },
    { type: 'switch',    label: 'SWITCH',    color: '#f97316', symbol: '/',  defaultValue: 1   },
    { type: 'motor',     label: 'MOTOR',     color: '#8b5cf6', symbol: 'M'                      },
    { type: 'ground',    label: 'GROUND',    color: '#94a3b8', symbol: '⏚'                      },
  ]

  const handlePickComponent = useCallback((type: ComponentType, defaultValue?: number) => {
    const typeInitial = type.charAt(0).toUpperCase()
    const same = circuitGraph.components.filter(c => c.type === type && c.label?.startsWith(typeInitial))
    let maxNum = 0
    same.forEach(c => {
      const m = c.label?.match(new RegExp(`^${typeInitial}(\\d+)$`))
      if (m) maxNum = Math.max(maxNum, parseInt(m[1]))
    })
    const newLabel = `${typeInitial}${maxNum + 1}`
    const positions = circuitGraph.components.map(c => c.position)
    let x = 200, y = 200
    if (positions.length > 0) {
      x = Math.max(...positions.map(p => p.x)) + 160
      y = positions[0].y
      if (x > 1200) { x = 100; y = Math.max(...positions.map(p => p.y)) + 120 }
    }
    requestCircuitLoad({
      components: [...circuitGraph.components, {
        id: `${type}_${Math.random().toString(36).slice(2, 9)}`,
        type, label: newLabel, value: defaultValue, position: { x, y },
      }],
      edges: circuitGraph.edges,
    })
    setShowComponentPicker(false)
  }, [circuitGraph, requestCircuitLoad])

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [chatLog])

  // Skip handler
  const handleSkip = useCallback(() => {
    const s = pixiStateRef.current
    if (s) s.skipRequested = true
  }, [])

  // Keep refs current
  circuitGraphRef.current = circuitGraph
  simulationStateRef.current = simulationState

  // ── Init PixiJS once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    const init = async () => {
      const PIXI = await import('pixi.js')
      if (cancelled || !containerRef.current) return

      const app = new PIXI.Application()
      await app.init({
        resizeTo: containerRef.current,
        background: 0x0f0e17,
        antialias: false,
        resolution: 1,
      })
      if (cancelled) { app.destroy(true); return }

      const canvas = app.canvas as HTMLCanvasElement
      canvas.style.imageRendering = 'pixelated'
      containerRef.current.appendChild(canvas)

      const world = new PIXI.Container()
      const tilesContainer = new PIXI.Container()
      const pathContainer = new PIXI.Container()
      const landmarksContainer = new PIXI.Container()
      const particlesContainer = new PIXI.Container()
      const heroContainer = new PIXI.Container()
      const uiContainer = new PIXI.Container()
      const speechBubbleContainer = new PIXI.Container()
      const voltageDropPopupContainer = new PIXI.Container()

      world.addChild(tilesContainer, pathContainer, landmarksContainer, particlesContainer, heroContainer, voltageDropPopupContainer, speechBubbleContainer)
      app.stage.addChild(world)

      const dayNightOverlay = new PIXI.Graphics()
      app.stage.addChild(dayNightOverlay)
      app.stage.addChild(uiContainer)

      const heroResult = buildHeroGfx(PIXI)
      heroContainer.addChild(heroResult.container)
      
      // Make hero interactive for upcoming Voice Agent integration
      heroContainer.eventMode = 'static'
      heroContainer.cursor = 'pointer'
      heroContainer.on('pointerdown', () => {
        onHeroClickRef.current()
      })

      const state: PixiState = {
        app, world, heroContainer, heroFrames: heroResult.frames,
        heroFrameIdx: 0, heroFrameTimer: 0,
        speechBubbleContainer,
        dayNightOverlay,
        pathContainer, landmarksContainer, tilesContainer, particlesContainer,
        uiContainer, currentScene: null,
        heroPath: [], heroPathIdx: 0, heroProgress: 0,
        heroPauseMs: 0, elapsed: 0, animTick: 0, particles: [],
        visitedLandmarks: new Set(),
        currentStoryLandmark: null,
        skipRequested: false,
        voltageDropPopup: null,
        voltageDropPopupContainer,
        heroIntroShown: false,
      }
      pixiStateRef.current = state

      // Build scene
      const scene = deriveScene(circuitGraphRef.current, simulationStateRef.current)
      buildScene(PIXI, state, scene, app)

      if (!scene.isEmpty) {
        state.heroIntroShown = true
        addChatEntryRef.current(
          '⚡ I AM VOLT!\nAn electron explorer who\ntravels through circuits.\nI power up cities, light LEDs,\nand spin motors across the land!',
          'story'
        )
        if (scene.isClosedCircuit) {
          addChatEntryRef.current('The circuit is complete!\nLet the journey begin!', 'system')
          const firstLm = scene.landmarks[0]
          if (firstLm) {
            const story = getPhysicsStory(firstLm.type, firstLm.label, firstLm.value, firstLm.fault, firstLm.powered, firstLm.voltageDrop, scene.circuitContext)
            addChatEntryRef.current(story, firstLm.fault ? 'fault' : 'story')
          }
        } else {
          addChatEntryRef.current(
            '🔌 The circuit is not yet complete.\nConnect battery → components → ground\nto form a closed loop.\nOnly then will I begin moving!',
            'system'
          )
        }
      }

      // Game loop
      app.ticker.add((ticker: any) => {
        const s = pixiStateRef.current
        if (!s || !s.currentScene) return
        s.elapsed += ticker.deltaMS
        s.animTick += ticker.deltaTime

        updateHero(s, ticker.deltaMS, addChatEntryRef.current)

        // Speech bubble
        if (s.currentScene && !s.currentScene.isEmpty && !s.currentScene.isClosedCircuit) {
          drawSpeechBubble(PIXI, s.speechBubbleContainer, '⚡ VOLT\nAwaiting a\ncomplete circuit!', s.heroContainer.x, s.heroContainer.y)
        } else if (s.currentStoryLandmark && s.currentScene) {
          const lm = s.currentScene.landmarks.find(l => l.id === s.currentStoryLandmark)
          if (lm) {
            const story = getPhysicsStory(lm.type, lm.label, lm.value, lm.fault, lm.powered, lm.voltageDrop, s.currentScene?.circuitContext)
            drawSpeechBubble(PIXI, s.speechBubbleContainer, story, s.heroContainer.x, s.heroContainer.y)
          }
        } else {
          s.speechBubbleContainer.removeChildren()
        }

        // Voltage drop popup (floating "−X.X V" when passing a resistor)
        if (s.voltageDropPopup) {
          s.voltageDropPopup.ageMs += ticker.deltaMS
          s.voltageDropPopup.yOffset -= 0.7
          if (s.voltageDropPopup.ageMs > 2200) s.voltageDropPopup = null
        }
        drawVoltageDropPopup(PIXI, s)

        if (!s.currentScene.isEmpty) {
          const tx = app.screen.width / 2 - s.heroContainer.x
          const ty = app.screen.height / 2 - s.heroContainer.y
          s.world.x += (tx - s.world.x) * 0.12 * ticker.deltaTime
          s.world.y += (ty - s.world.y) * 0.12 * ticker.deltaTime
        }

        updateDayNight(PIXI, s.dayNightOverlay, s.elapsed, app)
        animateLandmarks(s.landmarksContainer, s.animTick, s.currentScene)
        updateParticles(PIXI, s.particlesContainer, s)
      })
    }

    init()
    return () => {
      cancelled = true
      if (pixiStateRef.current) {
        try { pixiStateRef.current.app.destroy(true, { children: true }) } catch (_) {}
        pixiStateRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Rebuild on simulation change ────────────────────────────────────────────
  useEffect(() => {
    const s = pixiStateRef.current
    if (!s) return
    setChatLog([])
    import('pixi.js').then(PIXI => {
      const s2 = pixiStateRef.current
      if (!s2) return
      const scene = deriveScene(circuitGraphRef.current, simulationStateRef.current)
      wipeTransition(PIXI, s2.app, () => {
        const s3 = pixiStateRef.current
        if (s3) {
          buildScene(PIXI, s3, scene, s3.app)
          if (!scene.isEmpty) {
            // Show Volt's intro only once
            if (!s3.heroIntroShown) {
              s3.heroIntroShown = true
              addChatEntryRef.current(
                '⚡ I AM VOLT!\nAn electron explorer who\ntravels through circuits.\nI power up cities, light LEDs,\nand spin motors across the land!',
                'story'
              )
            }

            if (scene.isClosedCircuit) {
              addChatEntryRef.current('🗺️ Circuit complete! VOLT begins the journey!', 'system')
              const firstLm = scene.landmarks[0]
              if (firstLm) {
                const story = getPhysicsStory(firstLm.type, firstLm.label, firstLm.value, firstLm.fault, firstLm.powered, firstLm.voltageDrop, scene.circuitContext)
                addChatEntryRef.current(story, firstLm.fault ? 'fault' : 'story')
              }
            } else {
              addChatEntryRef.current(
                '🔌 Circuit incomplete...\nConnect all parts into a closed loop\n(battery → components → ground).\nI will wait here until it is done!',
                'system'
              )
              // Show specific faults
              const sim = simulationStateRef.current
              if (sim && sim.faults.length > 0) {
                for (const f of sim.faults.slice(0, 3)) {
                  addChatEntryRef.current(`⚠️ ${f.message}`, 'fault')
                }
              }
            }
          }
        }
      })
    })
  }, [circuitGraph, simulationState]) // Rebuild when circuit or simulation result changes

  const isPaused = pixiStateRef.current?.heroPauseMs && pixiStateRef.current.heroPauseMs > 0

  return (
    <div className="w-full h-full relative" style={{ background: '#0F0E17' }}>
      {/* PixiJS canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Skip button (top-right) */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #475569',
          borderRadius: 6,
          color: '#94a3b8',
          fontSize: 11,
          fontFamily: '"Courier New", monospace',
          fontWeight: 700,
          cursor: 'pointer',
          zIndex: 10,
          transition: 'all 0.15s ease',
          letterSpacing: '0.05em',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ffd700'; e.currentTarget.style.borderColor = '#ffd700' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#475569' }}
      >
        ▶▶ SKIP
      </button>

      {/* Minecraft-chat-style retro overlay log (bottom-left) */}
      <div
        ref={chatRef}
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          maxWidth: 380,
          maxHeight: 220,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 10,
          pointerEvents: 'none',
          // Hide scrollbar
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {chatLog.map((entry, i) => {
          const age = (Date.now() - entry.timestamp) / 1000
          const opacity = age > 10 ? Math.max(0.15, 1 - (age - 10) / 8) : 1

          return (
            <div
              key={entry.id}
              style={{
                background: entry.type === 'fault'
                  ? 'rgba(127, 29, 29, 0.75)'
                  : entry.type === 'system'
                    ? 'rgba(30, 58, 95, 0.75)'
                    : 'rgba(15, 23, 42, 0.80)',
                padding: '5px 10px',
                borderRadius: 4,
                borderLeft: entry.type === 'fault'
                  ? '3px solid #ef4444'
                  : entry.type === 'system'
                    ? '3px solid #3b82f6'
                    : '3px solid #ffd700',
                opacity,
                transition: 'opacity 0.5s ease',
              }}
            >
              <span
                style={{
                  fontFamily: '"Courier New", monospace',
                  fontSize: 10,
                  color: entry.type === 'fault'
                    ? '#fca5a5'
                    : entry.type === 'system'
                      ? '#93c5fd'
                      : '#e2e8f0',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  letterSpacing: '0.02em',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {entry.text}
              </span>
            </div>
          )
        })}
      </div>

      {/* Component progress + click hint (top-left) */}
      {circuitGraph.components.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
          {circuitGraph.components.map(comp => {
            const visited = pixiStateRef.current?.visitedLandmarks?.has(comp.id)
            const isCurrent = pixiStateRef.current?.currentStoryLandmark === comp.id
            return (
              <div
                key={comp.id}
                title={comp.label ?? comp.type}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: isCurrent
                    ? '#ffd700'
                    : visited
                      ? '#22c55e'
                      : '#475569',
                  border: isCurrent ? '2px solid #fff' : '1px solid #64748b',
                  transition: 'all 0.3s ease',
                  boxShadow: isCurrent ? '0 0 8px #ffd700' : 'none',
                }}
              />
            )
          })}
          </div>
          <div style={{
            fontFamily: 'monospace', fontSize: 9, color: '#334155',
            cursor: 'pointer',
          }}
            onClick={() => setShowComponentPicker(true)}
          >
            💡 click hero to add
          </div>
        </div>
      )}

      {/* Faults / Stats overlay (top-right area below skip) */}
      {simulationState && simulationState.faults.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 12,
            background: 'rgba(127, 29, 29, 0.7)',
            border: '1px solid #991b1b',
            borderRadius: 6,
            padding: '6px 10px',
            maxWidth: 200,
            zIndex: 10,
          }}
        >
          <div style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 9,
            color: '#fca5a5',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 4,
          }}>
            ⚠ {simulationState.faults.length} FAULT{simulationState.faults.length > 1 ? 'S' : ''}
          </div>
          {simulationState.faults.slice(0, 3).map((f, i) => (
            <div key={i} style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 8,
              color: '#fecaca',
              lineHeight: 1.3,
              marginBottom: 2,
            }}>
              • {f.message}
            </div>
          ))}
        </div>
      )}

      {/* Component Picker Modal — appears when hero is clicked */}
      {showComponentPicker && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setShowComponentPicker(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '2px solid #ffd700',
              borderRadius: 10,
              padding: '20px 24px',
              minWidth: 340,
              boxShadow: '0 0 40px rgba(255,215,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 8,
              color: '#ffd700', marginBottom: 6, textAlign: 'center',
            }}>
              + ADD COMPONENT
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 10, color: '#64748b',
              textAlign: 'center', marginBottom: 14,
            }}>
              Select a component to add to your circuit
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PICKER_ITEMS.map(item => (
                <button
                  key={item.type}
                  onClick={() => handlePickComponent(item.type, item.defaultValue)}
                  style={{
                    background: '#0a0e1a',
                    border: `2px solid ${item.color}44`,
                    borderRadius: 6,
                    padding: '10px 6px',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = item.color
                    e.currentTarget.style.background = `${item.color}18`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${item.color}44`
                    e.currentTarget.style.background = '#0a0e1a'
                  }}
                >
                  <span style={{ fontSize: 20 }}>{item.symbol}</span>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 5, color: item.color }}>
                    {item.label}
                  </span>
                  {item.defaultValue !== undefined && (
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569' }}>
                      {item.type === 'battery' ? `${item.defaultValue}V`
                        : item.type === 'resistor' ? `${item.defaultValue}Ω`
                        : item.type === 'capacitor' ? `${item.defaultValue}μF`
                        : item.defaultValue}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 5,
              color: '#334155', textAlign: 'center', marginTop: 14,
            }}>
              CLICK OUTSIDE OR PRESS ESC TO CANCEL
            </div>
          </div>
        </div>
      )}

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}
