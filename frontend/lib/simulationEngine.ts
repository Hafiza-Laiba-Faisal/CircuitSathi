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
    return {
      isValid: true,
      componentStates: [],
      faults: [],
      commentary: 'Empty circuit. Drag components from the palette to start building.',
    }
  }

  const batteries = components.filter(c => c.type === 'battery')
  const grounds = components.filter(c => c.type === 'ground')
  const leds = components.filter(c => c.type === 'led')
  const resistors = components.filter(c => c.type === 'resistor')
  const switches = components.filter(c => c.type === 'switch')
  const faults: { componentId: string; fault: FaultType; message: string }[] = []

  if (batteries.length === 0) {
    return {
      isValid: false,
      componentStates: components.map(c => ({
        componentId: c.id, powered: false, currentFlow: 0, fault: 'open_circuit' as FaultType,
      })),
      faults: [{ componentId: 'circuit', fault: 'open_circuit', message: 'No power source — add a battery.' }],
      commentary: 'The city has no power plant. Without a battery, nothing can run.',
    }
  }

  if (grounds.length === 0) {
    return {
      isValid: false,
      componentStates: components.map(c => ({
        componentId: c.id, powered: false, currentFlow: 0, fault: 'floating_ground' as FaultType,
      })),
      faults: [{ componentId: 'circuit', fault: 'floating_ground', message: 'No ground reference — add a ground.' }],
      commentary: 'The city has no return network. Without a ground, current has nowhere to flow back.',
    }
  }

  // Open switches break paths through them
  const openSwitchIds = new Set(switches.filter(s => s.value === 0).map(s => s.id))

  const activeEdges = edges.filter(
    e => !openSwitchIds.has(e.sourceId) && !openSwitchIds.has(e.targetId),
  )

  // Build undirected adjacency list
  const adj = new Map<string, Set<string>>()
  for (const comp of components) adj.set(comp.id, new Set())
  for (const edge of activeEdges) {
    adj.get(edge.sourceId)?.add(edge.targetId)
    adj.get(edge.targetId)?.add(edge.sourceId)
  }

  // BFS to find connected components
  const visited = new Set<string>()
  const groups: Set<string>[] = []

  for (const comp of components) {
    if (visited.has(comp.id)) continue
    const group = new Set<string>()
    const queue = [comp.id]
    visited.add(comp.id)
    while (queue.length > 0) {
      const cur = queue.shift()!
      group.add(cur)
      const neighbors = adj.get(cur)
      const nbs = neighbors ? Array.from(neighbors) : []
      for (const nb of nbs) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
      }
    }
    groups.push(group)
  }

  const compMap = new Map(components.map(c => [c.id, c]))
  const groundIds = new Set(grounds.map(g => g.id))
  const poweredIds = new Set<string>()
  const completeGroups: Set<string>[] = []

  for (const group of groups) {
    const hasBat = batteries.some(b => group.has(b.id))
    const hasGnd = grounds.some(g => group.has(g.id))
    if (hasBat && hasGnd) {
      Array.from(group).forEach(id => poweredIds.add(id))
      completeGroups.push(group)
    }
  }

  // --- Short-circuit check ---
  for (const group of completeGroups) {
    for (const bat of batteries.filter(b => group.has(b.id))) {
      if (hasDirectPathToGround(bat.id, adj, compMap, groundIds)) {
        faults.push({
          componentId: bat.id,
          fault: 'short_circuit',
          message: `Short circuit! ${bat.label || 'Battery'} connects directly to ground with no load.`,
        })
      }
    }
  }

  // --- Missing-resistor check for LEDs ---
  for (const led of leds) {
    if (!poweredIds.has(led.id)) continue
    const ledGroup = completeGroups.find(g => g.has(led.id))
    if (ledGroup && !resistors.some(r => ledGroup.has(r.id))) {
      faults.push({
        componentId: led.id,
        fault: 'missing_resistor',
        message: `${led.label || 'LED'} has no current-limiting resistor — risk of burnout.`,
      })
    }
  }

  // --- Open-circuit faults for unpowered components ---
  for (const comp of components) {
    if (poweredIds.has(comp.id)) continue
    if (comp.type === 'wire') continue
    if (openSwitchIds.has(comp.id)) continue
    const nb = adj.get(comp.id)
    faults.push({
      componentId: comp.id,
      fault: 'open_circuit',
      message: nb && nb.size > 0
        ? `${comp.label || comp.type} is not on a complete circuit path.`
        : `${comp.label || comp.type} is not connected to anything.`,
    })
  }

  // --- Open switch notes ---
  for (const sw of switches.filter(s => s.value === 0)) {
    faults.push({
      componentId: sw.id,
      fault: 'open_circuit',
      message: `${sw.label || 'Switch'} is open — path is broken.`,
    })
  }

  const hasShort = faults.some(f => f.fault === 'short_circuit')

  const componentStates: ComponentState[] = components.map(comp => {
    const powered = poweredIds.has(comp.id)
    const cFaults = faults.filter(f => f.componentId === comp.id)
    const isShorted = cFaults.some(f => f.fault === 'short_circuit')
    const isMissingRes = cFaults.some(f => f.fault === 'missing_resistor')

    let currentFlow = 0
    if (powered) {
      if (isShorted) currentFlow = 1.0
      else if (isMissingRes) currentFlow = 0.9
      else if (hasShort && comp.type !== 'battery' && comp.type !== 'ground') currentFlow = 0.1
      else {
        const flowMap: Record<string, number> = {
          battery: 0.8, resistor: 0.5, led: 0.6,
          capacitor: 0.4, motor: 0.7, ground: 0.8,
          switch: 0.7, wire: 0.8,
          inductor: 0.5, potentiometer: 0.5,
          diode: 0.55, transistor: 0.6, mosfet: 0.6,
          ldr: 0.45, thermistor: 0.45,
          voltmeter: 0.1, ammeter: 0.8, multimeter: 0.1,
          oscilloscope: 0.1, probe: 0.05,
          buzzer: 0.65, relay: 0.6,
          and_gate: 0.3, or_gate: 0.3, not_gate: 0.3,
          xor_gate: 0.3, clock: 0.3,
          ac_source: 0.8, transformer: 0.7,
        }
        currentFlow = flowMap[comp.type] ?? 0.6
      }
    }

    return {
      componentId: comp.id,
      powered,
      currentFlow,
      fault: cFaults.length > 0 ? cFaults[0].fault : undefined,
    }
  })

  return {
    isValid: faults.length === 0,
    componentStates,
    faults,
    commentary: buildCommentary(components, componentStates, faults, poweredIds),
  }
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

function buildCommentary(
  components: CircuitComponent[],
  states: ComponentState[],
  faults: { componentId: string; fault: FaultType; message: string }[],
  poweredIds: Set<string>,
): string {
  const lines: string[] = []

  if (faults.length === 0) {
    const poweredCount = states.filter(s => s.powered).length
    lines.push(`Circuit is valid — ${poweredCount} component(s) powered and running.`)

    const litLeds = components.filter(c => c.type === 'led' && poweredIds.has(c.id))
    if (litLeds.length) lines.push(`${litLeds.length} LED(s) lit — city districts are glowing.`)

    const runningMotors = components.filter(c => c.type === 'motor' && poweredIds.has(c.id))
    if (runningMotors.length) lines.push(`${runningMotors.length} motor(s) running — factories operational.`)

    const activeResistors = components.filter(c => c.type === 'resistor' && poweredIds.has(c.id))
    if (activeResistors.length) lines.push(`${activeResistors.length} resistor(s) controlling flow — traffic managed through bottleneck roads.`)

    const caps = components.filter(c => c.type === 'capacitor' && poweredIds.has(c.id))
    if (caps.length) lines.push(`${caps.length} capacitor(s) stabilising supply — reservoir buffering active.`)
  } else {
    lines.push(`${faults.length} fault(s) detected:`)
    for (const f of faults) {
      const tag =
        f.fault === 'short_circuit' ? '[SHORT]' :
        f.fault === 'open_circuit' ? '[OPEN]' :
        f.fault === 'missing_resistor' ? '[OVERLOAD RISK]' :
        f.fault === 'floating_ground' ? '[NO GROUND]' :
        f.fault === 'overload' ? '[OVERLOAD]' : '[FAULT]'
      lines.push(`  ${tag} ${f.message}`)
    }
    const p = states.filter(s => s.powered).length
    lines.push(`${p}/${states.length} components powered.`)
  }

  return lines.join('\n')
}
