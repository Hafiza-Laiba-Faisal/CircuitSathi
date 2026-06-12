'use client'

import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import ReactFlow, {
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  ReactFlowProvider,
} from 'reactflow'
import type {
  Connection,
  Node as RFNode,
  Edge as RFEdge,
  ReactFlowInstance,
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useCircuitStore } from '../store/circuitStore'
import { nodeTypes } from '../lib/reactflow/index'
import { saveProject } from '../lib/api'
import type { CanvasComponentType } from './ComponentPalette'
import { COMPONENT_CONFIGS } from './ComponentPalette'

// ─── Handle reference ─────────────────────────────────────────────────────────

export interface BuildCanvasHandle {
  undo: () => void
  redo: () => void
  clear: () => void
  export: () => void
  simulate: () => void
  canUndo: boolean
  canRedo: boolean
}

// ─── History snapshot ─────────────────────────────────────────────────────────

interface Snapshot {
  nodes: RFNode[]
  edges: RFEdge[]
}

// ─── Utility: snap to grid ────────────────────────────────────────────────────

function snapToGrid(value: number, grid = 16): number {
  return Math.round(value / grid) * grid
}

// ─── ID generator ─────────────────────────────────────────────────────────────

let _nodeCounter = 0
function nextNodeId(): string {
  return `node_${++_nodeCounter}_${Date.now()}`
}

let _edgeCounter = 0
function nextEdgeId(): string {
  return `edge_${++_edgeCounter}_${Date.now()}`
}

// ─── Edge colour helper ───────────────────────────────────────────────────────

function edgeColorForFlow(flow: number): string {
  if (flow > 0.85) return '#ef4444'
  if (flow > 0.4) return '#eab308'
  return '#3b82f6'
}

// ─── Inner canvas (needs ReactFlowProvider above it) ─────────────────────────

interface InnerCanvasProps {
  forwardedRef: React.Ref<BuildCanvasHandle>
}

function InnerCanvas({ forwardedRef }: InnerCanvasProps) {
  const {
    setCanvasNodes,
    setCanvasEdges,
    setIsDirty,
    setCanvasStatus,
    canvasToCircuitGraph,
    setCircuitGraph,
    simulationState,
    canvasStatus,
    projectId,
    projectName,
  } = useCircuitStore()

  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge[]>([])
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null)

  // Undo / Redo stacks
  const undoStack = useRef<Snapshot[]>([])
  const redoStack = useRef<Snapshot[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Debounce ref for auto-simulation
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)
  const [editingNode, setEditingNode] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Track backend availability
  const [backendOnline, setBackendOnline] = useState(true)

  // Check backend once on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/projects`, { method: 'HEAD' })
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false))
  }, [])

  // ─── Sync simulation edge colours ──────────────────────────────────────────

  useEffect(() => {
    if (!simulationState) return
    setEdges(prev =>
      prev.map(edge => {
        const targetState = simulationState.componentStates.find(
          cs => cs.componentId === edge.target,
        )
        const flow = targetState?.currentFlow ?? 0
        return {
          ...edge,
          style: {
            ...edge.style,
            stroke: edgeColorForFlow(flow),
            strokeWidth: 2,
          },
          animated: (targetState?.powered ?? false) && flow > 0,
        }
      }),
    )
  }, [simulationState, setEdges])

  // ─── Push to undo stack ────────────────────────────────────────────────────

  const pushUndo = useCallback(
    (currentNodes: RFNode[], currentEdges: RFEdge[]) => {
      undoStack.current = [
        ...undoStack.current.slice(-49),
        { nodes: currentNodes, edges: currentEdges },
      ]
      redoStack.current = []
      setCanUndo(true)
      setCanRedo(false)
    },
    [],
  )

  // ─── Debounced simulation trigger ─────────────────────────────────────────

  const triggerSimulation = useCallback(
    (currentNodes: RFNode[], currentEdges: RFEdge[]) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      debounceTimer.current = setTimeout(() => {
        // Validate: needs at least a battery/voltage_source AND a ground
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasPower = currentNodes.some(n =>
          ['battery', 'voltage_source'].includes((n.data as any)?.componentType),
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasGround = currentNodes.some(
          n => (n.data as any)?.componentType === 'ground',
        )

        if (!hasPower || !hasGround) {
          setCanvasStatus('incomplete')
          return
        }

        setCanvasStatus('simulating')
        setCanvasNodes(currentNodes)
        setCanvasEdges(currentEdges)

        // Derive graph and run client-side simulation via store
        const graph = canvasToCircuitGraph()
        setCircuitGraph(graph)

        // Check result
        const store = useCircuitStore.getState()
        const sim = store.simulationState
        if (sim && sim.faults.length > 0) {
          setCanvasStatus('fault')
        } else {
          setCanvasStatus('updated')
          setTimeout(() => setCanvasStatus('idle'), 1500)
        }
      }, 800)
    },
    [setCanvasNodes, setCanvasEdges, canvasToCircuitGraph, setCircuitGraph, setCanvasStatus],
  )

  // ─── Wrap node/edge changes to track dirty state ───────────────────────────

  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const handleEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChange>[0]) => {
      onEdgesChange(changes)
    },
    [onEdgesChange],
  )

  // Fire after state settles via useEffect
  const prevNodesRef = useRef(nodes)
  const prevEdgesRef = useRef(edges)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      prevNodesRef.current = nodes
      prevEdgesRef.current = edges
      return
    }

    const nodesChanged = nodes !== prevNodesRef.current
    const edgesChanged = edges !== prevEdgesRef.current

    if (nodesChanged || edgesChanged) {
      setIsDirty(true)
      setCanvasStatus('drawing')
      triggerSimulation(nodes, edges)
      prevNodesRef.current = nodes
      prevEdgesRef.current = edges
    }
  }, [nodes, edges, setIsDirty, setCanvasStatus, triggerSimulation])

  // ─── Connect edges ─────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      pushUndo(nodes, edges)
      const newEdge: RFEdge = {
        ...connection,
        id: nextEdgeId(),
        source: connection.source!,
        target: connection.target!,
        style: { stroke: '#3b82f6', strokeWidth: 2 },
        animated: false,
      }
      setEdges(prev => addEdge(newEdge, prev))
    },
    [nodes, edges, pushUndo, setEdges],
  )

  // ─── Drop handler (palette → canvas) ─────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const compType = e.dataTransfer.getData('application/canvascomponent') as CanvasComponentType
      if (!compType) return

      const config = COMPONENT_CONFIGS[compType]
      if (!config) return

      if (!rfInstance) return
      const position = rfInstance.project({ x: e.clientX, y: e.clientY })
      const snappedPos = {
        x: snapToGrid(position.x),
        y: snapToGrid(position.y),
      }

      pushUndo(nodes, edges)

      const newNode: RFNode = {
        id: nextNodeId(),
        type: 'circuitNode',
        position: snappedPos,
        data: {
          componentType: compType,
          label: config.label,
          value: config.defaultValue,
          unit: config.unit,
          onDelete: (id: string) => {
            pushUndo(nodes, edges)
            setNodes(prev => prev.filter(n => n.id !== id))
            setEdges(prev => prev.filter(e => e.source !== id && e.target !== id))
          },
          onValueChange: (id: string, val: number) => {
            setNodes(prev =>
              prev.map(n =>
                n.id === id ? { ...n, data: { ...n.data, value: val } } : n,
              ),
            )
          },
        },
      }

      setNodes(prev => [...prev, newNode])
    },
    [rfInstance, nodes, edges, pushUndo, setNodes, setEdges],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  // ─── Double-click node: toggle switch ────────────────────────────────────

  const onNodeDoubleClick = useCallback(
    (_e: React.MouseEvent, node: RFNode) => {
      if (node.data?.componentType !== 'switch') return
      pushUndo(nodes, edges)
      setNodes(prev =>
        prev.map(n =>
          n.id === node.id
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? { ...n, data: { ...n.data, value: (n.data as any).value === 1 ? 0 : 1 } }
            : n,
        ),
      )
    },
    [nodes, edges, pushUndo, setNodes],
  )

  // ─── Undo / Redo ──────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const snapshot = undoStack.current.pop()!
    redoStack.current.push({ nodes, edges })
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
  }, [nodes, edges, setNodes, setEdges])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const snapshot = redoStack.current.pop()!
    undoStack.current.push({ nodes, edges })
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
  }, [nodes, edges, setNodes, setEdges])

  // ─── Clear ────────────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    pushUndo(nodes, edges)
    setNodes([])
    setEdges([])
    setCanvasStatus('idle')
  }, [nodes, edges, pushUndo, setNodes, setEdges, setCanvasStatus])

  // ─── Export ───────────────────────────────────────────────────────────────

  const exportCanvas = useCallback(() => {
    setCanvasNodes(nodes)
    setCanvasEdges(edges)
    const graph = canvasToCircuitGraph()
    const blob = new Blob([JSON.stringify(graph, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'circuit.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, setCanvasNodes, setCanvasEdges, canvasToCircuitGraph])

  // ─── Simulate (manual) ────────────────────────────────────────────────────

  const simulateManual = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasPower = nodes.some(n =>
      ['battery', 'voltage_source'].includes((n.data as any)?.componentType),
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasGround = nodes.some(n => (n.data as any)?.componentType === 'ground')

    if (!hasPower || !hasGround) {
      setCanvasStatus('incomplete')
      return
    }

    setCanvasStatus('simulating')
    setCanvasNodes(nodes)
    setCanvasEdges(edges)
    const graph = canvasToCircuitGraph()
    setCircuitGraph(graph)

    const store = useCircuitStore.getState()
    const sim = store.simulationState
    if (sim && sim.faults.length > 0) {
      setCanvasStatus('fault')
    } else {
      setCanvasStatus('updated')
      setTimeout(() => setCanvasStatus('idle'), 1500)
    }
  }, [nodes, edges, setCanvasNodes, setCanvasEdges, canvasToCircuitGraph, setCircuitGraph, setCanvasStatus])

  // ─── Save ─────────────────────────────────────────────────────────────────

  const saveCanvas = useCallback(async () => {
    if (!backendOnline) {
      alert('Backend offline – cannot save.')
      return
    }
    setCanvasNodes(nodes)
    setCanvasEdges(edges)
    const graph = canvasToCircuitGraph()
    const store = useCircuitStore.getState()
    try {
      await saveProject(projectName ?? 'Untitled Circuit', graph, store.simulationState)
      alert('Saved!')
    } catch (err) {
      console.error('Save failed', err)
      alert('Save failed – backend may be offline.')
    }
  }, [backendOnline, nodes, edges, setCanvasNodes, setCanvasEdges, canvasToCircuitGraph, projectName])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const ctrl = isMac ? e.metaKey : e.ctrlKey

      if ((e.key === 'Delete' || e.key === 'Backspace') && !ctrl) {
        e.preventDefault()
        pushUndo(nodes, edges)
        setNodes(prev => prev.filter(n => !n.selected))
        setEdges(prev => prev.filter(ed => !ed.selected))
        return
      }

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if (
        (ctrl && e.key === 'y') ||
        (ctrl && e.shiftKey && e.key === 'z') ||
        (ctrl && e.shiftKey && e.key === 'Z')
      ) {
        e.preventDefault()
        redo()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodes, edges, undo, redo, pushUndo, setNodes, setEdges])

  // ─── Expose imperative handle ─────────────────────────────────────────────

  useImperativeHandle(
    forwardedRef,
    () => ({
      undo,
      redo,
      clear: clearCanvas,
      export: exportCanvas,
      simulate: simulateManual,
      get canUndo() { return canUndo },
      get canRedo() { return canRedo },
    }),
    [undo, redo, clearCanvas, exportCanvas, simulateManual, canUndo, canRedo],
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Backend offline badge */}
      {!backendOnline && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 100,
            background: '#7f1d1d',
            color: '#fca5a5',
            fontSize: 10,
            fontFamily: 'monospace',
            padding: '2px 8px',
            borderRadius: 4,
            border: '1px solid #991b1b',
          }}
        >
          Sim offline
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={inst => setRfInstance(inst)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        snapToGrid={true}
        snapGrid={[16, 16]}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#111827' }}
        fitView
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#374151"
        />
        <Controls
          style={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: 6,
          }}
        />
        <MiniMap
          style={{
            background: '#0f172a',
            border: '1px solid #374151',
          }}
          nodeColor={node => {
            const compType = node.data?.componentType as string
            const colors: Record<string, string> = {
              battery: '#f59e0b',
              voltage_source: '#f59e0b',
              resistor: '#a16207',
              capacitor: '#4338ca',
              led: '#f97316',
              diode: '#f97316',
              switch: '#6b7280',
              ground: '#7c3aed',
              motor: '#8b5cf6',
              current_source: '#ec4899',
              wire: '#22c55e',
              inductor: '#0369a1',
            }
            return colors[compType] ?? '#4b5563'
          }}
          maskColor="rgba(0,0,0,0.5)"
        />
      </ReactFlow>
    </div>
  )
}

// ─── Wrapper with ReactFlowProvider ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const BuildCanvas = forwardRef<BuildCanvasHandle, {}>(
  function BuildCanvas(_props, ref) {
    return (
      <ReactFlowProvider>
        <InnerCanvas forwardedRef={ref} />
      </ReactFlowProvider>
    )
  },
)

export default BuildCanvas
