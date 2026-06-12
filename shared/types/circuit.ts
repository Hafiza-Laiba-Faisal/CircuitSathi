export type ComponentType =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'led'
  | 'diode'
  | 'voltageSource'
  | 'currentSource'
  | 'switch'
  | 'ground'
  | 'wire';

export interface CircuitNode {
  id: string;
  type: ComponentType;
  value?: number; // Ohms, Farads, Henries, Volts, Amps
  isOn?: boolean; // for switches
  position?: { x: number; y: number };
  voltage?: number; // populated after simulation
  current?: number;
  power?: number;
  fault?: 'open' | 'short' | 'overcurrent' | null;
}

export interface CircuitEdge {
  id: string;
  from: string;
  to: string;
  current?: number;
}

export interface CircuitGraph {
  nodes: CircuitNode[];
  edges: CircuitEdge[];
}

export interface SimulationResult {
  graph: CircuitGraph; // annotated with voltages, currents, power, faults
  totalPower: number;
  faults: string[]; // human-readable fault descriptions
}

export interface SceneConfig {
  biome: 'forest' | 'dungeon' | 'desert' | 'arctic' | 'lava' | 'void';
  tint: string; // hex
  heroSpeed: number; // px/sec — proportional to total current
  narrative: string; // Gemini-generated quest text
  audioUrl?: string;
  simulationResult: SimulationResult;
}
