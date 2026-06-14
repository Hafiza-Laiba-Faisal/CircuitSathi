'use client'

import { useCallback, useRef, useEffect, DragEvent, memo, useState } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  ReactFlowInstance,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  ConnectionMode,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useCircuitStore } from '../store/circuitStore'
import { ComponentType as CType, CircuitGraph } from '../../shared/types'
import UploadZone from './UploadZone'
import { DEMO_CIRCUITS, DemoCircuit } from '../lib/demoCircuits'

/* ------------------------------------------------------------------ */
/*  Component palette configuration                                   */
/* ------------------------------------------------------------------ */

const CONFIGS: Record<CType, { label: string; color: string; symbol: string; defaultValue?: number }> = {
  // Power
  battery:      { label: 'Battery',      color: '#22c55e', symbol: '+−', defaultValue: 9 },
  ground:       { label: 'Ground',       color: '#94a3b8', symbol: '⏚' },
  ac_source:    { label: 'AC Source',    color: '#14b8a6', symbol: '∿', defaultValue: 220 },
  // Passive
  resistor:     { label: 'Resistor',     color: '#f59e0b', symbol: 'Ω', defaultValue: 220 },
  capacitor:    { label: 'Capacitor',    color: '#3b82f6', symbol: '||', defaultValue: 100 },
  inductor:     { label: 'Inductor',     color: '#a78bfa', symbol: '⌇', defaultValue: 10 },
  potentiometer:{ label: 'Potentio.',    color: '#f97316', symbol: '↕Ω', defaultValue: 1000 },
  // Semiconductors
  led:          { label: 'LED',          color: '#ef4444', symbol: '◐' },
  diode:        { label: 'Diode',        color: '#fb923c', symbol: '▷|' },
  transistor:   { label: 'Transistor',   color: '#d946ef', symbol: 'BJT' },
  mosfet:       { label: 'MOSFET',       color: '#c026d3', symbol: 'FET' },
  // Sensors
  ldr:          { label: 'LDR',          color: '#facc15', symbol: '☀R' },
  thermistor:   { label: 'Thermistor',   color: '#f87171', symbol: '🌡R' },
  // Measurement
  voltmeter:    { label: 'Voltmeter',    color: '#38bdf8', symbol: 'V' },
  ammeter:      { label: 'Ammeter',      color: '#34d399', symbol: 'A' },
  multimeter:   { label: 'Multimeter',   color: '#60a5fa', symbol: 'M̃' },
  oscilloscope: { label: 'Oscilloscope', color: '#818cf8', symbol: '∼∼' },
  probe:        { label: 'Probe',        color: '#fbbf24', symbol: '⚡P' },
  // Output
  switch:       { label: 'Switch',       color: '#f97316', symbol: '⨯', defaultValue: 1 },
  motor:        { label: 'Motor',        color: '#8b5cf6', symbol: 'M' },
  buzzer:       { label: 'Buzzer',       color: '#e879f9', symbol: '🔊' },
  relay:        { label: 'Relay',        color: '#a3e635', symbol: '⎍' },
  // Digital
  and_gate:     { label: 'AND',          color: '#06b6d4', symbol: '&' },
  or_gate:      { label: 'OR',           color: '#22d3ee', symbol: '≥1' },
  not_gate:     { label: 'NOT',          color: '#67e8f9', symbol: '¬' },
  xor_gate:     { label: 'XOR',          color: '#0ea5e9', symbol: '⊕' },
  clock:        { label: 'Clock',        color: '#2dd4bf', symbol: '⏲' },
  // AC
  transformer:  { label: 'Transformer',  color: '#10b981', symbol: '⧓' },
  // Utility
  wire:         { label: 'Wire',         color: '#6b7280', symbol: '—' },
}

type PaletteGroup = { title: string; items: CType[] }

const PALETTE_GROUPS: PaletteGroup[] = [
  { title: 'Power',          items: ['battery', 'ground', 'ac_source'] },
  { title: 'Passive',        items: ['resistor', 'capacitor', 'inductor', 'potentiometer'] },
  { title: 'Semiconductors', items: ['led', 'diode', 'transistor', 'mosfet'] },
  { title: 'Sensors',        items: ['ldr', 'thermistor'] },
  { title: 'Measurement',    items: ['voltmeter', 'ammeter', 'multimeter', 'oscilloscope', 'probe'] },
  { title: 'Output',         items: ['switch', 'motor', 'buzzer', 'relay'] },
  { title: 'Digital',        items: ['and_gate', 'or_gate', 'not_gate', 'xor_gate', 'clock'] },
]

const PALETTE: CType[] = PALETTE_GROUPS.flatMap(g => g.items)

// Map palette/upload types to simulation ComponentType so closed circuit is detected
const SIM_TYPE_MAP: Record<string, CType> = {
  voltage_source: 'battery', current_source: 'battery',
  battery: 'battery', resistor: 'resistor', led: 'led',
  capacitor: 'capacitor', switch: 'switch', motor: 'motor',
  ground: 'ground', wire: 'wire', inductor: 'inductor',
  potentiometer: 'potentiometer', diode: 'diode',
  transistor: 'transistor', mosfet: 'mosfet',
  ldr: 'ldr', thermistor: 'thermistor',
  voltmeter: 'voltmeter', ammeter: 'ammeter',
  multimeter: 'multimeter', oscilloscope: 'oscilloscope', probe: 'probe',
  buzzer: 'buzzer', relay: 'relay',
  and_gate: 'and_gate', or_gate: 'or_gate', not_gate: 'not_gate',
  xor_gate: 'xor_gate', clock: 'clock',
  ac_source: 'ac_source', transformer: 'transformer',
}
const VALID_TYPES: CType[] = Object.values(SIM_TYPE_MAP).filter((v, i, a) => a.indexOf(v) === i)
function toSimType(raw: string | undefined): CType {
  const t = SIM_TYPE_MAP[raw ?? ''] ?? raw
  return (VALID_TYPES.includes(t as CType) ? t : 'wire') as CType
}

/* ------------------------------------------------------------------ */
/*  SVG symbol registry (for export)                                   */
/* ------------------------------------------------------------------ */

const SVG_SYMBOLS: Record<string, (cx: number, cy: number, value?: number) => string> = {
  battery: (cx, cy) => `
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 16}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <line x1="${cx - 16}" y1="${cy - 12}" x2="${cx - 16}" y2="${cy + 12}" stroke="#333" stroke-width="3"/>
    <line x1="${cx - 8}" y1="${cy - 7}" x2="${cx - 8}" y2="${cy + 7}" stroke="#333" stroke-width="1.5"/>
    <line x1="${cx}" y1="${cy - 12}" x2="${cx}" y2="${cy + 12}" stroke="#333" stroke-width="3"/>
    <line x1="${cx + 8}" y1="${cy - 7}" x2="${cx + 8}" y2="${cy + 7}" stroke="#333" stroke-width="1.5"/>
    <line x1="${cx + 16}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <text x="${cx - 12}" y="${cy - 16}" font-size="9" fill="#333" text-anchor="middle">+</text>
    <text x="${cx + 4}" y="${cy - 16}" font-size="9" fill="#333" text-anchor="middle">−</text>`,
  resistor: (cx, cy) => `
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 18}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <rect x="${cx - 18}" y="${cy - 8}" width="36" height="16" rx="2" fill="none" stroke="#333" stroke-width="1.8"/>
    <line x1="${cx + 18}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>`,
  capacitor: (cx, cy) => `
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 5}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <line x1="${cx - 5}" y1="${cy - 14}" x2="${cx - 5}" y2="${cy + 14}" stroke="#333" stroke-width="2.5"/>
    <line x1="${cx + 5}" y1="${cy - 14}" x2="${cx + 5}" y2="${cy + 14}" stroke="#333" stroke-width="2.5"/>
    <line x1="${cx + 5}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>`,
  led: (cx, cy) => `
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 12}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <polygon points="${cx - 12},${cy - 10} ${cx - 12},${cy + 10} ${cx + 6},${cy}" fill="none" stroke="#333" stroke-width="1.8"/>
    <line x1="${cx + 6}" y1="${cy - 10}" x2="${cx + 6}" y2="${cy + 10}" stroke="#333" stroke-width="1.8"/>
    <line x1="${cx + 6}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <line x1="${cx + 10}" y1="${cy - 12}" x2="${cx + 16}" y2="${cy - 18}" stroke="#333" stroke-width="1.2"/>
    <polygon points="${cx + 14},${cy - 19} ${cx + 17},${cy - 16} ${cx + 13},${cy - 15}" fill="#333"/>
    <line x1="${cx + 14}" y1="${cy - 8}" x2="${cx + 20}" y2="${cy - 14}" stroke="#333" stroke-width="1.2"/>
    <polygon points="${cx + 18},${cy - 15} ${cx + 21},${cy - 12} ${cx + 17},${cy - 11}" fill="#333"/>`,
  switch: (cx, cy, value) => {
    const closed = value === 1
    return `
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 12}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <circle cx="${cx - 12}" cy="${cy}" r="2.5" fill="#333"/>
    <circle cx="${cx + 12}" cy="${cy}" r="2.5" fill="#333"/>
    ${closed
      ? `<line x1="${cx - 12}" y1="${cy}" x2="${cx + 12}" y2="${cy}" stroke="#333" stroke-width="1.8"/>`
      : `<line x1="${cx - 12}" y1="${cy}" x2="${cx + 10}" y2="${cy - 10}" stroke="#333" stroke-width="1.8"/>`
    }
    <line x1="${cx + 12}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>`
  },
  ground: (cx, cy) => `
    <line x1="${cx}" y1="${cy - 20}" x2="${cx}" y2="${cy - 4}" stroke="#666" stroke-width="1.5"/>
    <line x1="${cx - 14}" y1="${cy - 4}" x2="${cx + 14}" y2="${cy - 4}" stroke="#333" stroke-width="2.5"/>
    <line x1="${cx - 9}" y1="${cy + 2}" x2="${cx + 9}" y2="${cy + 2}" stroke="#333" stroke-width="1.8"/>
    <line x1="${cx - 4}" y1="${cy + 8}" x2="${cx + 4}" y2="${cy + 8}" stroke="#333" stroke-width="1.5"/>`,
  motor: (cx, cy) => `
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 14}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="#333" stroke-width="1.8"/>
    <text x="${cx}" y="${cy + 5}" font-size="14" fill="#333" text-anchor="middle" font-weight="bold">M</text>
    <line x1="${cx + 14}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>`,
  wire: (cx, cy) => `
    <circle cx="${cx}" cy="${cy}" r="4" fill="#333"/>
    <line x1="${cx - 30}" y1="${cy}" x2="${cx - 4}" y2="${cy}" stroke="#666" stroke-width="1.5"/>
    <line x1="${cx + 4}" y1="${cy}" x2="${cx + 30}" y2="${cy}" stroke="#666" stroke-width="1.5"/>`,
}

function generateSchematicSVG(graph: CircuitGraph): string {
  if (graph.components.length === 0) return ''

  // Scale factor from ReactFlow positions to SVG coords
  const SCALE = 0.8
  const PADDING = 80

  // Find bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of graph.components) {
    minX = Math.min(minX, c.position.x)
    minY = Math.min(minY, c.position.y)
    maxX = Math.max(maxX, c.position.x)
    maxY = Math.max(maxY, c.position.y)
  }

  const offsetX = -minX * SCALE + PADDING
  const offsetY = -minY * SCALE + PADDING
  const svgW = (maxX - minX) * SCALE + PADDING * 2
  const svgH = (maxY - minY) * SCALE + PADDING * 2

  // Build a position lookup
  const posMap: Record<string, { x: number; y: number }> = {}
  for (const c of graph.components) {
    posMap[c.id] = {
      x: c.position.x * SCALE + offsetX,
      y: c.position.y * SCALE + offsetY,
    }
  }

  let symbols = ''
  let labels = ''
  let wires = ''

  // Draw wires (edges) as orthogonal lines
  for (const edge of graph.edges) {
    const src = posMap[edge.sourceId]
    const tgt = posMap[edge.targetId]
    if (!src || !tgt) continue

    // Determine connection points based on pin
    let sx = src.x + 30, sy = src.y
    let tx = tgt.x - 30, ty = tgt.y

    if (edge.sourcePin === 'bottom') { sx = src.x; sy = src.y + 20 }
    if (edge.sourcePin === 'top') { sx = src.x; sy = src.y - 20 }
    if (edge.targetPin === 'bottom') { tx = tgt.x; ty = tgt.y + 20 }
    if (edge.targetPin === 'top') { tx = tgt.x; ty = tgt.y - 20 }

    // Orthogonal routing
    if (Math.abs(sy - ty) < 2) {
      // Horizontal
      wires += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#666" stroke-width="1.5"/>\n`
    } else {
      // L-shaped routing: horizontal then vertical
      const midX = tx
      wires += `<line x1="${sx}" y1="${sy}" x2="${midX}" y2="${sy}" stroke="#666" stroke-width="1.5"/>\n`
      wires += `<line x1="${midX}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="#666" stroke-width="1.5"/>\n`
    }
  }

  // Draw component symbols and labels
  for (const comp of graph.components) {
    const pos = posMap[comp.id]
    const symbolFn = SVG_SYMBOLS[comp.type]
    if (symbolFn) {
      symbols += symbolFn(pos.x, pos.y, comp.value)
    }

    // Label below
    labels += `<text x="${pos.x}" y="${pos.y + 28}" font-size="10" fill="#555" text-anchor="middle" font-family="monospace">${comp.label || comp.type}</text>\n`
    // Value below label
    if (comp.value !== undefined) {
      let valStr: string
      if (comp.type === 'resistor') valStr = comp.value >= 1000 ? `${(comp.value / 1000).toFixed(1)}kΩ` : `${Number(comp.value).toFixed(1)}Ω`
      else if (comp.type === 'capacitor') valStr = `${comp.value}µF`
      else if (comp.type === 'battery') valStr = `${Number(comp.value).toFixed(1)}V`
      else valStr = `${comp.value}`
      labels += `<text x="${pos.x}" y="${pos.y + 40}" font-size="9" fill="#888" text-anchor="middle" font-family="monospace">${valStr}</text>\n`
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <rect width="${svgW}" height="${svgH}" fill="white"/>
  <g id="wires">${wires}</g>
  <g id="symbols">${symbols}</g>
  <g id="labels">${labels}</g>
</svg>`
}

/* ------------------------------------------------------------------ */
/*  Custom React Flow node                                            */
/* ------------------------------------------------------------------ */

function CircuitNodeRaw({ id, data, selected }: NodeProps) {
  const simulationState = useCircuitStore(s => s.simulationState)
  const cs = simulationState?.componentStates.find(c => c.componentId === id)

  const isTeaching = data.isTeaching === true
  const powered = cs?.powered ?? false
  const currentFlow = cs?.currentFlow ?? 0
  const fault = cs?.fault
  const cfg = CONFIGS[data.componentType as CType] ?? CONFIGS.wire

  const borderColor = fault
    ? '#ef4444'
    : powered
      ? cfg.color
      : '#4b5563'

  const bg = fault
    ? 'rgba(127,29,29,0.6)'
    : powered
      ? `${cfg.color}22`
    : isTeaching
      ? 'rgba(251,191,36,0.15)'
      : powered
        ? `${cfg.color}22`
        : 'rgba(31,41,55,0.8)'

  const unitLabel =
    data.componentType === 'battery' ? (data.value != null ? `${Number(data.value).toFixed(1)}V` : '') :
    data.componentType === 'resistor' ? (data.value != null ? `${Number(data.value).toFixed(1)}\u03A9` : '') :
    data.componentType === 'capacitor' ? `${data.value ?? ''}\u00B5F` :
    data.componentType === 'switch' ? (data.value === 1 ? 'ON' : 'OFF') :
    null

  return (
    <div
      className={`relative px-3 py-2 rounded-lg border-2 min-w-[80px] text-center shadow-lg transition-all
        ${selected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-gray-900' : ''}
        ${isTeaching ? 'animate-pulse scale-110 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : ''}
        ${fault ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: bg, borderColor }}
    >
      <Handle type="target" position={Position.Left} id="left"
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-gray-900" />
      <Handle type="source" position={Position.Right} id="right"
        className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-gray-900" />

      <div className="text-lg leading-none mb-0.5 select-none" style={{ color: cfg.color }}>
        {cfg.symbol}
      </div>
      <div className="text-[11px] font-semibold text-white truncate max-w-[90px]">
        {data.label || cfg.label}
      </div>
      {unitLabel && (
        <div className="text-[10px] text-gray-400">{unitLabel}</div>
      )}

      {currentFlow > 0 && (
        <div
          className="absolute -bottom-1 left-1 right-1 h-1 rounded-full"
          style={{
            backgroundColor: currentFlow > 0.85 ? '#ef4444' : currentFlow > 0.5 ? '#f59e0b' : '#22c55e',
            opacity: 0.4 + currentFlow * 0.6,
          }}
        />
      )}
    </div>
  )
}

const CircuitNode = memo(CircuitNodeRaw)
const nodeTypes = { circuitNode: CircuitNode }

/* ------------------------------------------------------------------ */
/*  Demo Circuit Card                                                  */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  basic: '#22c55e',
  intermediate: '#f59e0b',
  advanced: '#ef4444',
}

function DemoCard({ demo, onLoad }: { demo: DemoCircuit; onLoad: (g: CircuitGraph) => void }) {
  const [hovered, setHovered] = useState(false)
  const catColor = CATEGORY_COLORS[demo.category] ?? '#6b7280'

  return (
    <button
      onClick={() => onLoad(demo.graph)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 8px',
        background: hovered ? '#1e293b' : '#0f172a',
        border: `2px solid ${hovered ? catColor : '#1e293b'}`,
        borderRadius: 2,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: catColor,
          background: `${catColor}22`,
          padding: '2px 5px',
          border: `1px solid ${catColor}44`,
          borderRadius: 2,
        }}>
          {demo.category}
        </span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: '#e2e8f0' }}>
          {demo.name}
        </span>
      </div>
      <span style={{ fontFamily: "'VT323', monospace", fontSize: 14, color: '#94a3b8', lineHeight: 1.2 }}>
        {demo.description}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Inner builder (must be inside ReactFlowProvider)                   */
/* ------------------------------------------------------------------ */

function BuilderInner() {
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const { setCircuitGraph, pendingLoad, clearPendingLoad, setSelectedComponentId, selectedComponentId, activeMode, requestCircuitLoad, activeToolbarComponent } = useCircuitStore()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showDemos, setShowDemos] = useState(false)

  const prevGraphRef = useRef<string>('')
  useEffect(() => {
    const graph: CircuitGraph = {
      components: nodes.map(n => ({
        id: n.id,
        type: toSimType(n.data?.componentType as string),
        label: (n.data?.label as string) ?? n.id,
        value: n.data?.value as number | undefined,
        position: n.position,
      })),
      edges: edges.map(e => ({
        id: e.id, sourceId: e.source, targetId: e.target,
        sourcePin: e.sourceHandle || undefined, targetPin: e.targetHandle || undefined,
      })),
    }
    const key = JSON.stringify(graph)
    if (key === prevGraphRef.current) return
    prevGraphRef.current = key
    setCircuitGraph(graph)
  }, [nodes, edges, setCircuitGraph])

  useEffect(() => {
    if (!pendingLoad) return
    setNodes(pendingLoad.components.map(c => ({ id: c.id, type: 'circuitNode', position: c.position, data: { componentType: c.type, label: c.label, value: c.value } })))
    setEdges(pendingLoad.edges.map(e => ({ id: e.id, source: e.sourceId, target: e.targetId, sourceHandle: e.sourcePin ?? null, targetHandle: e.targetPin ?? null, style: { stroke: '#06b6d4', strokeWidth: 2 }, animated: true })))
    clearPendingLoad()
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }, [pendingLoad, clearPendingLoad, setNodes, setEdges])

  const onConnect = useCallback((params: Connection) => setEdges(eds => addEdge({ ...params, style: { stroke: '#06b6d4', strokeWidth: 2 }, animated: true }, eds)), [setEdges])
  const onDragOver = useCallback((e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    const type = (
      e.dataTransfer.getData('application/circuitcomponent') ||
      e.dataTransfer.getData('text/plain')
    ) as CType
    if (!type || !rfInstance.current) return
    const position = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const cfg = CONFIGS[type]
    const id = `${type}_${Math.random().toString(36).slice(2, 9)}`
    setNodes(nds => [...nds, { id, type: 'circuitNode', position, data: { componentType: type, label: `${type.charAt(0).toUpperCase()}${nds.length + 1}`, value: cfg.defaultValue } }])
  }, [setNodes])

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedComponentId(node.id), [setSelectedComponentId])
  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    if (node.data.componentType === 'switch') {
      setNodes(nds => nds.map(n => n.id === node.id ? { ...n, data: { ...n.data, value: n.data.value === 1 ? 0 : 1 } } : n))
    }
  }, [setNodes])

  const onPaneClick = useCallback(() => setSelectedComponentId(null), [setSelectedComponentId])
  const handleFileParsed = useCallback((graph: CircuitGraph) => requestCircuitLoad(graph), [requestCircuitLoad])
  const handleLoadDemo = useCallback((graph: CircuitGraph) => { requestCircuitLoad(graph); setShowDemos(false) }, [requestCircuitLoad])

  const handleExportJSON = useCallback(() => {
    const graph = { components: nodes.map(n => ({ id: n.id, type: n.data.componentType, label: n.data.label, value: n.data.value, position: n.position })), edges: edges.map(e => ({ id: e.id, sourceId: e.source, targetId: e.target })) }
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'circuit.json'; a.click(); URL.revokeObjectURL(url)
  }, [nodes, edges])

  const handleExportSVG = useCallback(() => {
    const svg = generateSchematicSVG({ components: nodes.map(n => ({ id: n.id, type: n.data.componentType, label: n.data.label, value: n.data.value, position: n.position })), edges: edges.map(e => ({ id: e.id, sourceId: e.source, targetId: e.target })) })
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'circuit.svg'; a.click(); URL.revokeObjectURL(url)
  }, [nodes, edges])

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0e1a] relative group border border-amber-500/10 rounded-xl overflow-hidden shadow-2xl">
      <div className="flex flex-1 min-h-0">
        {activeMode === 'upload' ? (
          <div className="flex-1 overflow-y-auto border-r border-gray-700 bg-black/20"><UploadZone onParsed={handleFileParsed} /></div>
        ) : (
          <>
            <div className="w-52 flex flex-col gap-2 p-3 bg-[#050810] border-r border-amber-500/20 overflow-y-auto custom-scrollbar shrink-0">
              {PALETTE_GROUPS.map(group => (
                <div key={group.title} className="mb-4">
                  <div className="text-[9px] font-bold text-amber-500/60 uppercase tracking-widest mb-2 px-1">{group.title}</div>
                  <div className="flex flex-col gap-2">
                    {group.items.map(type => {
                      const c = CONFIGS[type]
                      const isActive = activeToolbarComponent === type
                      return (
                        <div key={type} draggable onDragStart={e => {
                          e.dataTransfer.setData('application/circuitcomponent', type)
                          e.dataTransfer.setData('text/plain', type)
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-grab transition-all duration-200 border ${isActive ? 'bg-amber-500/20 border-amber-400' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                          style={{ color: isActive ? '#fbbf24' : c.color }}>
                          <span className="text-lg w-6 text-center">{c.symbol}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">{c.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex-1 relative">
              {(() => {
                const selNode = nodes.find(n => n.id === selectedComponentId)
                if (!selNode) return null
                return (
                  <div className="absolute top-4 right-4 z-10 w-64 glass-panel p-4 rounded-xl border border-blue-500/30 shadow-2xl space-y-3">
                    <div className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">{selNode.data.componentType} Settings</div>
                    <input type="text" value={selNode.data.label || ''} onChange={e => setNodes(nds => nds.map(n => n.id === selNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n))} className="w-full bg-black/40 border border-white/10 p-2 text-xs rounded" />
                    {selNode.data.value !== undefined && <input type="number" value={selNode.data.value} onChange={e => setNodes(nds => nds.map(n => n.id === selNode.id ? { ...n, data: { ...n.data, value: parseFloat(e.target.value) || 0 } } : n))} className="w-full bg-black/40 border border-white/10 p-2 text-xs rounded" />}
                  </div>
                )
              })()}
              <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver} onInit={inst => { rfInstance.current = inst }} onNodeClick={onNodeClick} onNodeDoubleClick={onNodeDoubleClick} onPaneClick={onPaneClick} nodeTypes={nodeTypes} connectionMode={ConnectionMode.Loose} fitView className="bg-gray-950">
                <Controls className="!bg-gray-800 !border-gray-600 [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!fill-white" />
                <Background color="#374151" gap={20} variant={BackgroundVariant.Dots} />
              </ReactFlow>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-between p-3 bg-[#050810] border-t border-amber-500/10">
        <button onClick={() => setShowDemos(!showDemos)} className="text-[9px] font-bold text-amber-500 uppercase tracking-widest py-1.5 px-4 rounded border border-amber-500/20 hover:bg-amber-500/10 transition-all">{showDemos ? 'Hide Demos' : 'Show Demos'}</button>
        <div className="flex gap-2">
          <button onClick={handleExportSVG} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-blue-400">Export SVG</button>
          <button onClick={handleExportJSON} className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all text-emerald-400">Export JSON</button>
        </div>
      </div>
      {showDemos && <div className="absolute bottom-16 left-3 right-3 glass-panel max-h-[300px] overflow-y-auto p-4 rounded-xl border border-amber-500/20 z-50 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{DEMO_CIRCUITS.map(d => <DemoCard key={d.id} demo={d} onLoad={handleLoadDemo} />)}</div>}
    </div>
  )
}

export default function SchematicBuilder() { return <ReactFlowProvider><BuilderInner /></ReactFlowProvider> }
