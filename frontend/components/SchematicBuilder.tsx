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
  battery:   { label: 'Battery',   color: '#22c55e', symbol: '+\u2212', defaultValue: 9 },
  resistor:  { label: 'Resistor',  color: '#f59e0b', symbol: '\u03A9',  defaultValue: 220 },
  led:       { label: 'LED',       color: '#ef4444', symbol: '\u25D0' },
  capacitor: { label: 'Capacitor', color: '#3b82f6', symbol: '||',      defaultValue: 100 },
  switch:    { label: 'Switch',    color: '#f97316', symbol: '\u2A2F',  defaultValue: 1 },
  motor:     { label: 'Motor',     color: '#8b5cf6', symbol: 'M' },
  ground:    { label: 'Ground',    color: '#94a3b8', symbol: '\u23DA' },
  wire:      { label: 'Wire',      color: '#6b7280', symbol: '\u2014' },
}

const PALETTE: CType[] = ['battery', 'resistor', 'led', 'capacitor', 'switch', 'motor', 'ground']

// Map palette/upload types to simulation ComponentType so closed circuit is detected
const SIM_TYPE_MAP: Record<string, CType> = {
  voltage_source: 'battery',
  current_source: 'battery',
  inductor: 'resistor',
  diode: 'led',
  battery: 'battery',
  resistor: 'resistor',
  led: 'led',
  capacitor: 'capacitor',
  switch: 'switch',
  motor: 'motor',
  ground: 'ground',
  wire: 'wire',
}
const VALID_TYPES: CType[] = ['battery', 'wire', 'resistor', 'led', 'capacitor', 'switch', 'ground', 'motor']
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

    const srcComp = graph.components.find(c => c.id === edge.sourceId)
    const tgtComp = graph.components.find(c => c.id === edge.targetId)

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
      <span style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: '#475569' }}>
        {demo.graph.components.length} components · {demo.graph.edges.length} wires
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Inner builder (must be inside ReactFlowProvider)                   */
/* ------------------------------------------------------------------ */

function BuilderInner() {
  const rfInstance = useRef<ReactFlowInstance | null>(null)
  const { setCircuitGraph, pendingLoad, clearPendingLoad, setSelectedComponentId, selectedComponentId, activeMode, requestCircuitLoad } = useCircuitStore()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showDemos, setShowDemos] = useState(false)

  /* ---------- sync React Flow → Zustand store ---------- */
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
        id: e.id,
        sourceId: e.source,
        targetId: e.target,
        sourcePin: e.sourceHandle || undefined,
        targetPin: e.targetHandle || undefined,
      })),
    }
    const key = JSON.stringify(graph)
    if (key === prevGraphRef.current) return
    prevGraphRef.current = key
    setCircuitGraph(graph)
  }, [nodes, edges, setCircuitGraph])

  /* ---------- load preset / saved circuit ---------- */
  useEffect(() => {
    if (!pendingLoad) return
    const newNodes: Node[] = pendingLoad.components.map(c => ({
      id: c.id,
      type: 'circuitNode',
      position: c.position,
      data: { componentType: c.type, label: c.label, value: c.value },
    }))
    const newEdges: Edge[] = pendingLoad.edges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      sourceHandle: e.sourcePin ?? null,
      targetHandle: e.targetPin ?? null,
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      animated: true,
    }))
    setNodes(newNodes)
    setEdges(newEdges)
    clearPendingLoad()
    setTimeout(() => rfInstance.current?.fitView({ padding: 0.2 }), 50)
  }, [pendingLoad, clearPendingLoad, setNodes, setEdges])

  /* ---------- edge creation ---------- */
  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds =>
        addEdge({ ...params, style: { stroke: '#06b6d4', strokeWidth: 2 }, animated: true }, eds),
      ),
    [setEdges],
  )

  /* ---------- drag-and-drop from palette ---------- */
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/circuitcomponent') as CType
      if (!type || !rfInstance.current) return

      const position = rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const cfg = CONFIGS[type]
      const id = `${type}_${Math.random().toString(36).slice(2, 9)}`

      const typeInitial = type.charAt(0).toUpperCase()
      
      setNodes(nds => {
        const sameTypeNodes = nds.filter(n => n.data.componentType === type && n.data.label?.startsWith(typeInitial))
        let maxNum = 0
        sameTypeNodes.forEach(n => {
          const match = n.data.label.match(new RegExp(`^${typeInitial}(\\d+)$`))
          if (match) maxNum = Math.max(maxNum, parseInt(match[1]))
        })
        const newLabel = `${typeInitial}${maxNum + 1}`

        return [
          ...nds,
          {
            id,
            type: 'circuitNode',
            position,
            data: { componentType: type, label: newLabel, value: cfg.defaultValue },
          },
        ]
      })
    },
    [setNodes],
  )

  /* ---------- node click / double-click ---------- */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => setSelectedComponentId(node.id),
    [setSelectedComponentId],
  )

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.data.componentType === 'switch') {
        setNodes(nds =>
          nds.map(n =>
            n.id === node.id
              ? { ...n, data: { ...n.data, value: n.data.value === 1 ? 0 : 1 } }
              : n,
          ),
        )
      }
    },
    [setNodes],
  )

  const onPaneClick = useCallback(() => setSelectedComponentId(null), [setSelectedComponentId])

  const handleFileParsed = useCallback(
    (graph: CircuitGraph) => requestCircuitLoad(graph),
    [requestCircuitLoad],
  )

  /* ---------- load demo circuit ---------- */
  const handleLoadDemo = useCallback(
    (graph: CircuitGraph) => {
      requestCircuitLoad(graph)
      setShowDemos(false)
    },
    [requestCircuitLoad],
  )

  /* ---------- export functions ---------- */
  const handleExportJSON = useCallback(() => {
    const graph: CircuitGraph = {
      components: nodes.map(n => ({
        id: n.id,
        type: n.data.componentType,
        label: n.data.label,
        value: n.data.value,
        position: n.position,
      })),
      edges: edges.map(e => ({
        id: e.id,
        sourceId: e.source,
        targetId: e.target,
        sourcePin: e.sourceHandle || undefined,
        targetPin: e.targetHandle || undefined,
      })),
    }
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'circuit-schematic.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  const handleExportSVG = useCallback(() => {
    const graph: CircuitGraph = {
      components: nodes.map(n => ({
        id: n.id,
        type: n.data.componentType,
        label: n.data.label,
        value: n.data.value,
        position: n.position,
      })),
      edges: edges.map(e => ({
        id: e.id,
        sourceId: e.source,
        targetId: e.target,
        sourcePin: e.sourceHandle || undefined,
        targetPin: e.targetHandle || undefined,
      })),
    }
    const svg = generateSchematicSVG(graph)
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'circuit-schematic.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges])

  return (
    <div className="h-full flex flex-col">
      {activeMode === 'upload' ? (
        /* upload zone — fixed height, scrollable */
        <div className="shrink-0 max-h-[50%] overflow-y-auto border-b border-gray-700">
          <UploadZone onParsed={handleFileParsed} />
        </div>
      ) : (
        <>
          {/* component palette */}
          <div style={{
            display: 'flex', gap: 4, padding: '6px 8px',
            background: '#0a0e1a', borderBottom: '2px solid #1e293b',
            flexWrap: 'wrap',
          }}>
            {PALETTE.map(type => {
              const c = CONFIGS[type]
              return (
                <div
                  key={type}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/circuitcomponent', type)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 8px',
                    background: '#0f172a',
                    border: `2px solid ${c.color}44`,
                    borderRadius: 2,
                    cursor: 'grab',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 7,
                    color: c.color,
                    transition: 'all 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.boxShadow = `0 0 6px ${c.color}44` }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = `${c.color}44`; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <span style={{ fontSize: 11 }}>{c.symbol}</span>
                  <span>{c.label}</span>
                </div>
              )
            })}
          </div>

          {/* Demo Circuits & Export bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px',
            background: '#0a0e1a', borderBottom: '2px solid #1e293b',
          }}>
            <button
              onClick={() => setShowDemos(prev => !prev)}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 7,
                color: showDemos ? '#ffd700' : '#64748b',
                background: showDemos ? '#1a1500' : '#0f172a',
                border: `2px solid ${showDemos ? '#ffd700' : '#334155'}`,
                borderRadius: 2,
                padding: '4px 8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {showDemos ? '▾ DEMOS' : '▸ DEMOS'}
            </button>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={handleExportSVG}
                disabled={nodes.length === 0}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 6,
                  color: nodes.length === 0 ? '#475569' : '#a78bfa',
                  background: '#0f172a',
                  border: `2px solid ${nodes.length === 0 ? '#1e293b' : '#3730a3'}`,
                  borderRadius: 2,
                  padding: '3px 6px',
                  cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: nodes.length === 0 ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                ↓ SVG
              </button>
              <button
                onClick={handleExportJSON}
                disabled={nodes.length === 0}
                style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: 6,
                  color: nodes.length === 0 ? '#475569' : '#34d399',
                  background: '#0f172a',
                  border: `2px solid ${nodes.length === 0 ? '#1e293b' : '#065f46'}`,
                  borderRadius: 2,
                  padding: '3px 6px',
                  cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: nodes.length === 0 ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                ↓ JSON
              </button>
            </div>
          </div>

          {/* Demo circuits grid (collapsible) */}
          {showDemos && (
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                padding: '6px 8px',
                background: '#0a0e1a',
                borderBottom: '2px solid #1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 6,
                color: '#475569',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                CLICK TO LOAD A DEMO
              </div>
              {DEMO_CIRCUITS.map(demo => (
                <DemoCard key={demo.id} demo={demo} onLoad={handleLoadDemo} />
              ))}
            </div>
          )}
        </>
      )}

      {/* canvas */}
      <div className="flex-1 min-h-[200px] relative">
        {/* Properties Panel Overlay */}
        {(() => {
          const selNode = nodes.find(n => n.id === selectedComponentId)
          if (!selNode) return null
          return (
            <div style={{
              position: 'absolute', top: 10, right: 10, zIndex: 10,
              background: '#0a0e1a', border: '2px solid #3b82f6', borderRadius: 4,
              padding: '8px 12px', width: 240,
              boxShadow: '0 4px 6px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: '#60a5fa', marginBottom: 2 }}>
                {selNode.data.componentType.toUpperCase()} PROPERTIES
              </div>
              {/* Physics equation hint */}
              <div style={{
                fontFamily: 'monospace', fontSize: 9, color: '#475569',
                borderLeft: '2px solid #1e3a5f', paddingLeft: 6, lineHeight: 1.5,
              }}>
                {selNode.data.componentType === 'resistor' && 'V = I × R\nP = I²R = V²/R'}
                {selNode.data.componentType === 'battery' && 'ε = EMF (Electromotive Force)\nI = ε / R_total'}
                {selNode.data.componentType === 'capacitor' && 'Q = C × V\nE = ½CV²\nI = C × dV/dt'}
                {selNode.data.componentType === 'led' && 'P = V_f × I_f\nE = h × f (photon)'}
                {selNode.data.componentType === 'motor' && 'P = V × I\nτ = K_t × I (torque)'}
                {selNode.data.componentType === 'switch' && (selNode.data.value === 1 ? 'CLOSED — current flows' : 'OPEN — no current\nDouble-click to toggle')}
                {selNode.data.componentType === 'ground' && 'V_ref = 0V\nReturn path for current'}
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: '#94a3b8' }}>Label</span>
                <input 
                  type="text" 
                  value={selNode.data.label || ''} 
                  onChange={e => {
                    const val = e.target.value
                    setNodes(nds => nds.map(n => n.id === selNode.id ? { ...n, data: { ...n.data, label: val } } : n))
                  }}
                  style={{
                    background: '#1e293b', border: '1px solid #475569', color: '#f8fafc',
                    fontFamily: 'monospace', fontSize: 12, padding: '4px 6px', borderRadius: 2
                  }}
                />
              </label>
              {selNode.data.value !== undefined && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontFamily: "'VT323', monospace", fontSize: 13, color: '#94a3b8' }}>Value</span>
                  <input 
                    type="number" 
                    value={selNode.data.value === null ? '' : selNode.data.value} 
                    onChange={e => {
                      const val = parseFloat(e.target.value)
                      setNodes(nds => nds.map(n => n.id === selNode.id ? { ...n, data: { ...n.data, value: isNaN(val) ? 0 : val } } : n))
                    }}
                    style={{
                      background: '#1e293b', border: '1px solid #475569', color: '#f8fafc',
                      fontFamily: 'monospace', fontSize: 12, padding: '4px 6px', borderRadius: 2
                    }}
                  />
                </label>
              )}
            </div>
          )
        })()}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={inst => { rfInstance.current = inst }}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          className="bg-gray-950"
          connectionLineStyle={{ stroke: '#06b6d4', strokeWidth: 2 }}
          defaultEdgeOptions={{
            style: { stroke: '#06b6d4', strokeWidth: 2 },
            animated: true,
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!bg-gray-800 !border-gray-600 [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!fill-white" />
          <Background color="#374151" gap={20} variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper with provider                                     */
/* ------------------------------------------------------------------ */

export default function SchematicBuilder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  )
}
