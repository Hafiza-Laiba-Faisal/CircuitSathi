// A single component in the circuit
export type ComponentType =
  // Level 1 — Beginner
  | 'battery' | 'ground' | 'resistor' | 'led' | 'capacitor' | 'switch' | 'motor' | 'wire'
  // Level 2 — Passive & Measurement
  | 'inductor' | 'potentiometer'
  | 'voltmeter' | 'ammeter' | 'multimeter' | 'oscilloscope' | 'probe'
  // Level 3 — Semiconductors
  | 'diode' | 'transistor' | 'mosfet'
  // Sensors
  | 'ldr' | 'thermistor'
  // Output
  | 'buzzer' | 'relay'
  // Digital
  | 'and_gate' | 'or_gate' | 'not_gate' | 'xor_gate' | 'clock'
  // AC
  | 'ac_source' | 'transformer'

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
  currentFlow: number // 0.0 to 1.0 normalised for visuals
  
  // Realistic Electrical Parameters
  voltage?: number    // in Volts
  current?: number    // in Amperes
  resistance?: number // in Ohms
  power?: number      // in Watts
  fault?: FaultType
}

export interface SimulationState {
  isValid: boolean
  componentStates: ComponentState[]
  faults: { componentId: string; fault: FaultType; message: string }[]
  commentary?: string 
  
  // Global Circuit Specs
  vBat?: number
  iTotal?: number
  rTotal?: number
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
export interface TutorialStep {
  id: string
  title: string
  instruction: string
  explanation: string
  goalCriteria: {
    requiredComponents: ComponentType[]
    minVoltage?: number
    powered?: boolean
  }
  initialGraph?: CircuitGraph
}

export interface TutorialProgress {
  activeStepIdx: number
  isComplete: boolean
  manualText?: string
}
