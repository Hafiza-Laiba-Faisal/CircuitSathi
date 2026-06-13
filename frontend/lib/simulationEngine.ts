import {
  CircuitGraph,
  CircuitComponent,
  SimulationState,
  ComponentState,
  FaultType,
} from '../../shared/types'

export function simulate(graph: CircuitGraph): SimulationState {
  const { components, edges } = graph

  if (components.length === 0) {
    return { isValid: true, componentStates: [], faults: [], commentary: 'Empty. Add components to start.' }
  }

  const batteries = components.filter(c => c.type === 'battery')
  const grounds = components.filter(c => c.type === 'ground')
  const faults: { componentId: string; fault: FaultType; message: string }[] = []

  // 1. Basic Validation
  if (batteries.length === 0) {
    return {
      isValid: false,
      componentStates: components.map(c => ({ componentId: c.id, powered: false, currentFlow: 0, fault: 'open_circuit' as FaultType })),
      faults: [{ componentId: 'circuit', fault: 'open_circuit', message: 'No power source — add a battery.' }],
      commentary: 'The city has no power plant. Without a battery, nothing can run.',
    }
  }

  if (grounds.length === 0) {
    return {
      isValid: false,
      componentStates: components.map(c => ({ componentId: c.id, powered: false, currentFlow: 0, fault: 'floating_ground' as FaultType })),
      faults: [{ componentId: 'circuit', fault: 'floating_ground', message: 'No ground reference — add a ground.' }],
      commentary: 'No return path. Current needs a ground to flow back.',
    }
  }

  // 2. Physics Constants
  const vBat = batteries[0]?.value || 9
  const openSwitchIds = new Set(components.filter(s => s.type === 'switch' && s.value === 0).map(s => s.id))
  
  // 3. Connectivity Analysis (Battery-First BFS)
  const adj = new Map<string, Set<string>>()
  for (const comp of components) adj.set(comp.id, new Set())
  for (const edge of edges) {
    if (openSwitchIds.has(edge.sourceId) || openSwitchIds.has(edge.targetId)) continue
    adj.get(edge.sourceId)?.add(edge.targetId)
    adj.get(edge.targetId)?.add(edge.sourceId)
  }

  const reachableFromBattery = new Set<string>()
  const batteryQueue = batteries.map(b => b.id)
  batteryQueue.forEach(id => reachableFromBattery.add(id))
  
  let head = 0
  while (head < batteryQueue.length) {
    const cur = batteryQueue[head++]
    adj.get(cur)?.forEach(nb => {
      if (!reachableFromBattery.has(nb)) {
        reachableFromBattery.add(nb)
        batteryQueue.push(nb)
      }
    })
  }

  const poweredIds = new Set<string>()
  const groundIds = new Set(grounds.map(g => g.id))
  const isCircuitClosed = Array.from(reachableFromBattery).some(id => groundIds.has(id))

  if (isCircuitClosed) {
    reachableFromBattery.forEach(id => poweredIds.add(id))
  }

  // 4. Electrical Math (Simplification: Series-Primary)
  const loadComponents = components.filter(c => poweredIds.has(c.id) && c.type !== 'battery' && c.type !== 'ground' && c.type !== 'wire')
  const rTotal = loadComponents.reduce((sum, c) => sum + (c.type === 'resistor' || c.type === 'led' || c.type === 'potentiometer' ? (c.value || 220) : 10), 0) || 1
  const iTotal = vBat / rTotal

  // 5. Component Logic & Faults
  const componentStates: ComponentState[] = components.map(comp => {
    const powered = poweredIds.has(comp.id)
    const resistance = comp.type === 'resistor' || comp.type === 'potentiometer' ? (comp.value || 220) : (comp.type === 'led' ? 20 : 0.1)
    const voltage = powered ? (resistance / rTotal) * vBat : 0
    const current = powered ? iTotal : 0
    const power = voltage * current

    // LED Overload (30mA threshold)
    if (comp.type === 'led' && current > 0.03) {
      faults.push({ componentId: comp.id, fault: 'overload', message: 'LED overloaded (>30mA). Use a resistor!' })
    }

    // Ammeter Check (Must be in series: deg >= 2)
    if (comp.type === 'ammeter' && powered) {
        const degree = adj.get(comp.id)?.size || 0
        if (degree < 2) faults.push({ componentId: comp.id, fault: 'open_circuit', message: 'Ammeter not in series.' })
    }

    // Voltmeter Check (Across component: deg == 2)
    if (comp.type === 'voltmeter' && powered) {
        const degree = adj.get(comp.id)?.size || 0
        if (degree !== 2) faults.push({ componentId: comp.id, fault: 'open_circuit', message: 'Voltmeter must be across a load.' })
    }

    return {
      componentId: comp.id,
      powered,
      currentFlow: powered ? Math.min(current * 10, 1) : 0,
      voltage,
      current,
      resistance: powered ? resistance : undefined,
      power,
      fault: faults.find(f => f.componentId === comp.id)?.fault
    }
  })

  // 6. Final State
  return {
    isValid: faults.length === 0 && isCircuitClosed,
    componentStates,
    faults,
    vBat,
    iTotal,
    rTotal,
    commentary: buildCommentary(vBat, iTotal, rTotal, componentStates, faults, isCircuitClosed)
  }
}

function buildCommentary(v: number, i: number, r: number, states: ComponentState[], faults: any[], closed: boolean): string {
  if (!closed) return "Circuit is open. No complete path from Battery to Ground."
  
  const lines = [
    `⚡ System Report:`,
    `- Battery: ${v.toFixed(1)}V`,
    `- Total Resistance: ${r >= 1000 ? (r/1000).toFixed(2)+'k' : r.toFixed(0)}Ω`,
    `- Total Current: ${(i*1000).toFixed(1)}mA`,
    ``
  ]

  if (faults.length > 0) {
    lines.push(`⚠️ Faults Detected:`)
    faults.forEach(f => lines.push(`- ${f.message}`))
  } else {
    lines.push(`✅ All systems operational.`)
    const leds = states.filter(s => s.powered && s.componentId.includes('led')) // simplified check
    if (leds.length > 0) lines.push(`- City districts are illuminated.`)
  }

  return lines.join('\n')
}

/** BFS from battery following only wires — returns true if ground is reachable without a load. */
function hasDirectPathToGround(
  batteryId: string,
  adj: Map<string, Set<string>>,
  compMap: Map<string, CircuitComponent>,
  groundIds: Set<string>,
): boolean {
  const visited = new Set<string>([batteryId])
  const queue = [batteryId]

  while (queue.length > 0) {
    const cur = queue.shift()!
    const neighbors = adj.get(cur)
    const nbs = neighbors ? Array.from(neighbors) : []
    for (const nb of nbs) {
      if (visited.has(nb)) continue
      visited.add(nb)
      if (groundIds.has(nb)) return true
      const comp = compMap.get(nb)
      if (comp && (comp.type === 'wire' || (comp.type === 'switch' && comp.value !== 0))) {
        queue.push(nb)
      }
    }
  }
  return false
}

