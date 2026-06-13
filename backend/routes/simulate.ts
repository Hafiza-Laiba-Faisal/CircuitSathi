import { Router, Request, Response } from 'express'
import { CircuitGraph, CircuitComponent, CircuitEdge, SimulationState, ComponentState, FaultType } from '../../shared/types'
import { llm } from '../lib/ai'

const router = Router()

// POST /api/simulate
router.post('/', async (req: Request, res: Response) => {
  const { circuitGraph } = req.body as { circuitGraph: CircuitGraph }
  
  if (!circuitGraph || !Array.isArray(circuitGraph.components)) {
    res.status(400).json({ error: 'Body must contain circuitGraph: { components, edges }' })
    return
  }

  try {
    const simulationResult = runMNA(circuitGraph)
    
    // Generate AI Narration (Sathi Voice)
    const systemPrompt = `You are "Sathi", an AI tutor for a circuit simulator. 
Based on the provided MNA simulation results (voltages, currents, faults), explain the circuit's behavior in a friendly, 1-2 sentence bilingual (mix of English and simple Urdu/Hindi) narration.
Focus on the practical meaning (e.g., "The LED is glowing because current is flowing" or "Short circuit ki wajah se battery garam ho rahi hai").`
    
    const prompt = `Simulation Results: ${JSON.stringify(simulationResult.componentStates.map(s => ({ id: s.componentId, powered: s.powered, i: s.currentFlow, f: s.fault })))} \nFaults: ${simulationResult.faults.map(f => f.message).join(', ')}`
    
    const commentary = await llm(prompt, systemPrompt)
    
    res.json({ 
      simulationResult: { 
        ...simulationResult, 
        commentary: commentary || "Circuit updated successfully." 
      } 
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(400).json({ error: msg })
  }
})

export default router

/* ============================================================
   MNA — Modified Nodal Analysis
   ============================================================ */

interface BranchVS {
  nodePos: number
  nodeNeg: number
  voltage: number
  componentId: string
}

function runMNA(graph: CircuitGraph): SimulationState {
  const { components, edges } = graph

  // 1. Identify ground node
  const groundNode = components.find(n => n.type === 'ground')
  const gndId = groundNode?.id ?? null

  // 2. Union-Find to collapse wire/switch paths into electrical nets
  const parent = new Map<string, string>()
  for (const c of components) parent.set(c.id, c.id)

  function find(x: string): string {
    while (parent.get(x) !== x) {
      const p = parent.get(x)!
      parent.set(x, parent.get(p) ?? p)
      x = p
    }
    return x
  }
  function union(a: string, b: string) { parent.set(find(a), find(b)) }

  for (const edge of edges) {
    const fromComp = components.find(c => c.id === edge.sourceId)
    const toComp = components.find(c => c.id === edge.targetId)
    if (!fromComp || !toComp) continue
    
    if (fromComp.type === 'wire' || toComp.type === 'wire') {
      union(edge.sourceId, edge.targetId)
    }
    // Simple switch handle (if value > 0 it's closed)
    if (fromComp.type === 'switch' && (fromComp.value ?? 1) > 0) {
      union(edge.sourceId, edge.targetId)
    }
  }

  const allNets = new Set<string>()
  for (const c of components) allNets.add(find(c.id))
  const nets = Array.from(allNets)
  
  const gndNet = gndId ? find(gndId) : null
  const nonGndNets = nets.filter(n => n !== gndNet)
  const netIndexMap = new Map<string, number>()
  nonGndNets.forEach((net, i) => netIndexMap.set(net, i))
  
  const n = nonGndNets.length // Number of nodal equations
  
  function getMnaNode(id: string): number {
    const net = find(id)
    return net === gndNet ? -1 : (netIndexMap.get(net) ?? -1)
  }

  // 3. Stamps
  const voltageSources: BranchVS[] = []
  const G = Array.from({ length: n }, () => new Array(n).fill(0))
  const Ivec = new Array(n).fill(0)

  // Adjacency for multi-terminal components (we assume 2 terminals for now)
  const compToNets = new Map<string, string[]>()
  for (const c of components) compToNets.set(c.id, [])
  for (const e of edges) {
    compToNets.get(e.sourceId)?.push(find(e.targetId))
    compToNets.get(e.targetId)?.push(find(e.sourceId))
  }

  for (const c of components) {
    const connectedNets = [...new Set(compToNets.get(c.id) ?? [])]
    if (connectedNets.length < 1) continue // floating

    // Node A is the net the component is part of, Node B is the other side of an edge
    const idxA = getMnaNode(c.id)
    const idxB = connectedNets.length > 0 ? (connectedNets[0] === gndNet ? -1 : (netIndexMap.get(connectedNets[0]) ?? -1)) : -1

    if (idxA === -1 && idxB === -1) continue

    switch (c.type) {
      case 'resistor': {
        const r = c.value || 1000
        const g = 1 / r
        stampResistor(G, idxA, idxB, g)
        break
      }
      case 'battery': {
        voltageSources.push({ nodePos: idxA, nodeNeg: idxB, voltage: c.value || 9, componentId: c.id })
        break
      }
      case 'led': {
        // Model: 2V drop + 100 ohm internal resistance
        voltageSources.push({ nodePos: idxA, nodeNeg: idxB, voltage: 2.0, componentId: c.id })
        stampResistor(G, idxA, idxB, 1/100)
        break
      }
      case 'motor': {
        stampResistor(G, idxA, idxB, 1/50) // 50 ohm motor
        break
      }
    }
  }

  const m = voltageSources.length
  const size = n + m
  if (size === 0) return { isValid: true, componentStates: [], faults: [] }

  const Mat = Array.from({ length: size }, (_, i) => 
    Array.from({ length: size }, (__, j) => (i < n && j < n ? G[i][j] : 0))
  )
  const bVec = [...Ivec, ...voltageSources.map(vs => vs.voltage)]

  for (let k = 0; k < m; k++) {
    const vs = voltageSources[k]
    if (vs.nodePos >= 0) { Mat[vs.nodePos][n + k] += 1; Mat[n + k][vs.nodePos] += 1 }
    if (vs.nodeNeg >= 0) { Mat[vs.nodeNeg][n + k] -= 1; Mat[n + k][vs.nodeNeg] -= 1 }
  }

  const solution = gaussianElimination(Mat, bVec)
  const voltages = solution.slice(0, n)
  const currents = solution.slice(n)

  // 4. Results
  const componentStates: ComponentState[] = components.map(c => {
    const net = find(c.id)
    const v = net === gndNet ? 0 : (voltages[netIndexMap.get(net) ?? -1] ?? 0)
    
    // Simplistic power/current for visual
    const vsIdx = voltageSources.findIndex(vs => vs.componentId === c.id)
    let currentFlow = 0
    if (vsIdx >= 0) currentFlow = Math.abs(currents[vsIdx])
    else currentFlow = Math.abs(v) / (c.value || 1000)

    return {
      componentId: c.id,
      powered: Math.abs(v) > 0.1 || currentFlow > 0.001,
      currentFlow: Math.min(1, currentFlow * 10), // Normalized
    }
  })

  return {
    isValid: true,
    componentStates,
    faults: [], // Fault logic can be added/refined
  }
}

function stampResistor(G: number[][], a: number, b: number, g: number) {
  if (a >= 0) G[a][a] += g
  if (b >= 0) G[b][b] += g
  if (a >= 0 && b >= 0) { G[a][b] -= g; G[b][a] -= g}
}

function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let max = col
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[max][col])) max = row
    ;[M[col], M[max]] = [M[max], M[col]]
    if (Math.abs(M[col][col]) < 1e-12) continue
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n]
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j]
    x[i] = M[i][i] === 0 ? 0 : sum / M[i][i]
  }
  return x
}
