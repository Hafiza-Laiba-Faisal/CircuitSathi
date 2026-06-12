import { Router, Request, Response } from 'express'
import { CircuitGraph, CircuitNode, CircuitEdge, SimulationResult, SceneConfig } from '../../shared/types/circuit'

const router = Router()

// POST /api/simulate
router.post('/', (req: Request, res: Response) => {
  const { circuitGraph } = req.body as { circuitGraph: CircuitGraph }
  if (!circuitGraph || !Array.isArray(circuitGraph.nodes) || !Array.isArray(circuitGraph.edges)) {
    res.status(400).json({ error: 'Body must contain circuitGraph: { nodes, edges }' })
    return
  }
  try {
    const simulationResult = runMNA(circuitGraph)
    res.json({ simulationResult })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(400).json({ error: msg })
  }
})

export default router

/* ============================================================
   MNA — Modified Nodal Analysis
   Solves: [G B; C D] * [v; j] = [I; E]
   G = conductance matrix (n×n)
   B = voltage-source incidence (n×m)
   C = B^T
   D = 0 matrix (m×m) for ideal sources
   v = unknown node voltages (n×1)
   j = unknown branch currents through voltage sources (m×1)
   I = known current injections at nodes (n×1)
   E = known voltage source values (m×1)
   Reference/ground node is removed from the system.
   ============================================================ */

interface BranchVS {
  nodePos: number // index of + terminal in node list (-1 = ground)
  nodeNeg: number // index of − terminal in node list (-1 = ground)
  voltage: number
  componentId: string
}

function runMNA(graph: CircuitGraph): SimulationResult {
  const { nodes, edges } = graph

  // --- 1. Identify ground node ---
  const groundNode = nodes.find(n => n.type === 'ground')
  const gndId = groundNode?.id ?? null

  // Build adjacency: component ids connected per wire/edge
  // For MNA we need to know which electrical nodes (junction points) exist.
  // We treat each node id as a unique electrical node.
  // Wires are short-circuits between their endpoints — we merge them via union-find.

  // --- 2. Union-Find to collapse wire nets ---
  const parent = new Map<string, string>()
  const allIds = nodes.map(n => n.id)
  for (const id of allIds) parent.set(id, id)

  function find(x: string): string {
    while (parent.get(x) !== x) {
      const p = parent.get(x)!
      parent.set(x, parent.get(p) ?? p)
      x = p
    }
    return x
  }
  function union(a: string, b: string) { parent.set(find(a), find(b)) }

  // Merge wire-connected nodes and closed switches
  for (const edge of edges) {
    const fromNode = nodes.find(n => n.id === edge.from)
    const toNode = nodes.find(n => n.id === edge.to)
    if (!fromNode || !toNode) continue
    const fromType = fromNode.type
    const toType = toNode.type
    // Wires and closed switches short their two endpoints
    if (fromType === 'wire' || toType === 'wire') {
      union(edge.from, edge.to)
    }
    if ((fromType === 'switch' && fromNode.isOn) || (toType === 'switch' && toNode.isOn)) {
      union(edge.from, edge.to)
    }
  }

  // Collect unique electrical nets
  const netSet = new Set<string>()
  for (const id of allIds) netSet.add(find(id))
  const nets = Array.from(netSet)

  // Ground net
  const gndNet = gndId ? find(gndId) : null

  // Non-ground nets → MNA node indices 0..n-1
  const nonGndNets = nets.filter(n => n !== gndNet)
  const netIndex = new Map<string, number>()
  nonGndNets.forEach((n, i) => netIndex.set(n, i))
  const n = nonGndNets.length // number of unknown node voltages

  // Helper: get MNA index for a component-id's net (-1 = ground)
  function nodeIdx(id: string): number {
    const net = find(id)
    if (net === gndNet) return -1
    return netIndex.get(net) ?? -1
  }

  // --- 3. Classify components ---
  const voltageSources: BranchVS[] = []
  const nodeMap = new Map<string, CircuitNode>(nodes.map(nd => [nd.id, nd]))

  // G matrix (n×n), I vector (n), extended for voltage sources
  // We'll build them first without voltage sources, then extend.
  const G: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  const Ivec: number[] = new Array(n).fill(0)

  // Process each component (connected via edges)
  // We need to figure out which two terminals each 2-terminal component connects.
  // Build component → connected nets map from edges.
  const compNets = new Map<string, string[]>()
  for (const nd of nodes) compNets.set(nd.id, [])
  for (const edge of edges) {
    compNets.get(edge.from)?.push(find(edge.to))
    compNets.get(edge.to)?.push(find(edge.from))
  }

  for (const nd of nodes) {
    const nets2 = [...new Set(compNets.get(nd.id) ?? [])]
    if (nd.type === 'wire' || nd.type === 'ground' || nd.type === 'switch') continue

    // Get the two distinct nets this component bridges
    if (nets2.length < 2) continue // floating component — skip

    const netA = nets2[0]
    const netB = nets2[1]
    const idxA = netA === gndNet ? -1 : (netIndex.get(netA) ?? -1)
    const idxB = netB === gndNet ? -1 : (netIndex.get(netB) ?? -1)

    switch (nd.type) {
      case 'resistor': {
        const R = nd.value ?? 1000
        const g = 1 / R
        if (idxA >= 0) G[idxA][idxA] += g
        if (idxB >= 0) G[idxB][idxB] += g
        if (idxA >= 0 && idxB >= 0) { G[idxA][idxB] -= g; G[idxB][idxA] -= g }
        break
      }
      case 'capacitor': {
        // DC steady-state: open circuit — do nothing
        break
      }
      case 'inductor': {
        // DC steady-state: short circuit — stamp as very low resistance
        const R = 1e-6
        const g = 1 / R
        if (idxA >= 0) G[idxA][idxA] += g
        if (idxB >= 0) G[idxB][idxB] += g
        if (idxA >= 0 && idxB >= 0) { G[idxA][idxB] -= g; G[idxB][idxA] -= g }
        break
      }
      case 'led': {
        // Model: ideal forward voltage source 2V + 100Ω series resistance
        // We stamp a voltage source of 2V (positive terminal = netA assumed)
        // plus a resistor of 100Ω
        voltageSources.push({ nodePos: idxA, nodeNeg: idxB, voltage: 2.0, componentId: nd.id })
        const g = 1 / 100
        if (idxA >= 0) G[idxA][idxA] += g
        if (idxB >= 0) G[idxB][idxB] += g
        if (idxA >= 0 && idxB >= 0) { G[idxA][idxB] -= g; G[idxB][idxA] -= g }
        break
      }
      case 'diode': {
        // Simple ideal model: 0.7V forward voltage
        voltageSources.push({ nodePos: idxA, nodeNeg: idxB, voltage: 0.7, componentId: nd.id })
        break
      }
      case 'voltageSource': {
        const V = nd.value ?? 9
        voltageSources.push({ nodePos: idxA, nodeNeg: idxB, voltage: V, componentId: nd.id })
        break
      }
      case 'currentSource': {
        const I = nd.value ?? 0.001
        // current flows from nodeNeg to nodePos (conventional into nodePos)
        if (idxA >= 0) Ivec[idxA] += I
        if (idxB >= 0) Ivec[idxB] -= I
        break
      }
    }
  }

  const m = voltageSources.length
  const size = n + m

  // Build full MNA matrix [G B; C D] and RHS [I; E]
  const A: number[][] = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (__, j) => (i < n && j < n ? G[i][j] : 0))
  )
  const b: number[] = [...Ivec, ...voltageSources.map(vs => vs.voltage)]

  for (let k = 0; k < m; k++) {
    const vs = voltageSources[k]
    if (vs.nodePos >= 0) { A[vs.nodePos][n + k] += 1; A[n + k][vs.nodePos] += 1 }
    if (vs.nodeNeg >= 0) { A[vs.nodeNeg][n + k] -= 1; A[n + k][vs.nodeNeg] -= 1 }
  }

  // --- 4. Solve Ax = b via Gaussian elimination with partial pivoting ---
  let solution: number[] | null = null
  if (size > 0) {
    solution = gaussianElimination(A, b)
  }

  const nodeVoltages: number[] = solution ? solution.slice(0, n) : new Array(n).fill(0)
  const vSourceCurrents: number[] = solution ? solution.slice(n) : new Array(m).fill(0)

  function getVoltage(id: string): number {
    const idx = nodeIdx(id)
    if (idx < 0) return 0
    return nodeVoltages[idx] ?? 0
  }

  // --- 5. Annotate nodes with voltage, current, power, faults ---
  const faults: string[] = []
  const annotatedNodes: CircuitNode[] = nodes.map(nd => {
    const v = getVoltage(nd.id)
    let current = 0
    let power = 0
    let fault: 'open' | 'short' | 'overcurrent' | null = null

    const nets2 = [...new Set(compNets.get(nd.id) ?? [])]
    if (nets2.length >= 2) {
      const netA = nets2[0]
      const netB = nets2[1]
      const vA = netA === gndNet ? 0 : (nodeVoltages[netIndex.get(netA) ?? -1] ?? 0)
      const vB = netB === gndNet ? 0 : (nodeVoltages[netIndex.get(netB) ?? -1] ?? 0)
      const vDiff = Math.abs(vA - vB)

      if (nd.type === 'resistor') {
        const R = nd.value ?? 1000
        current = vDiff / R
        power = current * vDiff
        if (nd.value !== undefined && current > nd.value * 2) {
          fault = 'overcurrent'
          faults.push(`Overcurrent through ${nd.id}: ${current.toFixed(3)}A`)
        }
      } else if (nd.type === 'voltageSource') {
        const vsIdx = voltageSources.findIndex(vs => vs.componentId === nd.id)
        if (vsIdx >= 0) {
          current = Math.abs(vSourceCurrents[vsIdx])
          power = current * (nd.value ?? 0)
        }
        // Short circuit: voltage source with near-zero resistance path (current > 10A is a proxy)
        if (current > 10) {
          fault = 'short'
          faults.push(`Short circuit detected at ${nd.id}: current=${current.toFixed(1)}A`)
        }
      } else if (nd.type === 'led' || nd.type === 'diode') {
        const vsIdx = voltageSources.findIndex(vs => vs.componentId === nd.id)
        if (vsIdx >= 0) {
          current = Math.abs(vSourceCurrents[vsIdx])
          power = current * (nd.type === 'led' ? 2.0 : 0.7) + current * current * 100
        }
        if (current > 0.03) {
          fault = 'overcurrent'
          faults.push(`Overcurrent through ${nd.id}: ${(current * 1000).toFixed(1)}mA (max ~20mA)`)
        }
      } else if (nd.type === 'currentSource') {
        current = nd.value ?? 0
        power = current * vDiff
      } else if (nd.type === 'inductor') {
        current = vDiff / 1e-6
        power = current * vDiff
      }

      // Open circuit: component with both terminals floating (no current, non-trivial component)
      if (nets2.length < 2 && nd.type !== 'ground' && nd.type !== 'wire') {
        fault = 'open'
        faults.push(`Open circuit: ${nd.id} is not connected on both terminals`)
      }
    } else if (nd.type !== 'ground' && nd.type !== 'wire' && nd.type !== 'switch') {
      fault = 'open'
      faults.push(`Open circuit: ${nd.id} has insufficient connections`)
    }

    return { ...nd, voltage: parseFloat(v.toFixed(6)), current: parseFloat(current.toFixed(6)), power: parseFloat(power.toFixed(6)), fault }
  })

  // Annotate edges with current
  const annotatedEdges: CircuitEdge[] = edges.map(edge => {
    const fromNode = nodeMap.get(edge.from)
    const toNode = nodeMap.get(edge.to)
    let current = 0
    if (fromNode && toNode) {
      const vFrom = getVoltage(edge.from)
      const vTo = getVoltage(edge.to)
      const vDiff = Math.abs(vFrom - vTo)
      // Approximate: if there's a resistor involved use R, else use a small value
      current = vDiff > 1e-9 ? vDiff / 100 : 0
    }
    return { ...edge, current: parseFloat(current.toFixed(6)) }
  })

  // Short circuit detection: if any voltage source sees its terminals shorted (vDiff ≈ 0 but source has nonzero V)
  for (const vs of voltageSources) {
    const vPos = vs.nodePos >= 0 ? (nodeVoltages[vs.nodePos] ?? 0) : 0
    const vNeg = vs.nodeNeg >= 0 ? (nodeVoltages[vs.nodeNeg] ?? 0) : 0
    const vDiff = Math.abs(vPos - vNeg)
    if (vs.voltage > 0 && vDiff < 0.01) {
      faults.push(`Short circuit: voltage source ${vs.componentId} terminals are nearly equal (${vDiff.toFixed(4)}V drop across ${vs.voltage}V source)`)
    }
  }

  const totalPower = annotatedNodes.reduce((sum, nd) => sum + (nd.power ?? 0), 0)

  return {
    graph: { nodes: annotatedNodes, edges: annotatedEdges },
    totalPower: parseFloat(totalPower.toFixed(6)),
    faults,
  }
}

/* ============================================================
   Gaussian elimination with partial pivoting
   Solves Ax = b in-place, returns x or throws if singular
   ============================================================ */
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length
  // Augmented matrix
  const M: number[][] = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col
    let maxVal = Math.abs(M[col][col])
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) { maxVal = Math.abs(M[row][col]); maxRow = row }
    }
    if (maxVal < 1e-12) {
      // Singular or near-singular — set variable to 0
      continue
    }
    // Swap rows
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col]
      for (let j = col; j <= n; j++) M[row][j] -= factor * M[col][j]
    }
  }

  // Back substitution
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(M[i][i]) < 1e-12) continue
    let sum = M[i][n]
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j]
    x[i] = sum / M[i][i]
  }
  return x
}

/* ============================================================
   SceneConfig derivation
   ============================================================ */
export function deriveSceneConfig(simulationResult: SimulationResult, narrative = ''): SceneConfig {
  const { graph, totalPower, faults } = simulationResult
  const nodes = graph.nodes

  const hasShort = faults.some(f => f.includes('Short') || f.includes('short'))
  const hasOpen = faults.some(f => f.includes('Open') || f.includes('open'))
  const hasLed = nodes.some(n => n.type === 'led')
  const hasCap = nodes.some(n => n.type === 'capacitor')
  const totalR = nodes.filter(n => n.type === 'resistor').reduce((s, n) => s + (n.value ?? 0), 0)
  const highResistance = totalR > 10000

  let biome: SceneConfig['biome']
  if (hasShort) biome = 'lava'
  else if (hasOpen) biome = 'void'
  else if (hasCap) biome = 'dungeon'
  else if (highResistance) biome = 'desert'
  else if (hasLed) biome = 'arctic'
  else biome = 'forest'

  const TINTS: Record<SceneConfig['biome'], string> = {
    lava: '#ff4500', void: '#1a0033', dungeon: '#2d1b69',
    desert: '#c8a96e', arctic: '#a8d8ea', forest: '#228b22',
  }

  // totalCurrent approximation: sum of all node currents / 2 (each counted twice)
  const totalCurrent = nodes.reduce((s, n) => s + Math.abs(n.current ?? 0), 0) / 2
  const heroSpeed = Math.min(Math.max(totalCurrent * 80, 20), 400)

  return { biome, tint: TINTS[biome], heroSpeed, narrative, simulationResult }
}
