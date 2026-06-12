// A single component in the circuit
export type ComponentType =
  | 'battery'
  | 'wire'
  | 'resistor'
  | 'led'
  | 'capacitor'
  | 'switch'
  | 'ground'
  | 'motor'

export interface CircuitComponent {
  id: string
  type: ComponentType
  label?: string
  value?: number // e.g. resistance in ohms, voltage in volts
  position: { x: number; y: number }
}

// A connection between two component pins
export interface CircuitEdge {
  id: string
  sourceId: string
  targetId: string
  sourcePin?: string
  targetPin?: string
}

// The full circuit graph
export interface CircuitGraph {
  components: CircuitComponent[]
  edges: CircuitEdge[]
}

// Output of the simulation engine
export type FaultType =
  | 'open_circuit'
  | 'short_circuit'
  | 'overload'
  | 'missing_resistor'
  | 'floating_ground'

export interface ComponentState {
  componentId: string
  powered: boolean
  currentFlow: number // 0.0 to 1.0 normalised
  fault?: FaultType
}

export interface SimulationState {
  isValid: boolean
  componentStates: ComponentState[]
  faults: { componentId: string; fault: FaultType; message: string }[]
  commentary?: string // Gemini-generated plain English explanation
}

export interface FaultHistoryEntry {
  timestamp: string
  faults: { componentId: string; fault: FaultType; message: string }[]
}

// A saved circuit project stored in MongoDB
export interface CircuitProject {
  _id?: string
  name: string
  graph: CircuitGraph
  simulationState?: SimulationState
  faultHistory?: FaultHistoryEntry[]
  createdAt: Date
  updatedAt: Date
}
