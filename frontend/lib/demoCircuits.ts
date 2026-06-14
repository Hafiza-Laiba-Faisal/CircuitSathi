import { CircuitGraph } from '../../shared/types'

export interface DemoCircuit {
  id: string
  name: string
  description: string
  category: 'basic' | 'intermediate' | 'advanced'
  graph: CircuitGraph
}

// Fallback circuit loaded when Gemini Vision fails to parse an uploaded image
export const FALLBACK_CIRCUIT: CircuitGraph = {
  components: [
    { id: 'fb_bat', type: 'battery', label: 'B1', value: 9, position: { x: 0, y: 120 } },
    { id: 'fb_r1', type: 'resistor', label: 'R1', value: 100, position: { x: 200, y: 120 } },
    { id: 'fb_r2', type: 'resistor', label: 'R2', value: 220, position: { x: 400, y: 120 } },
    { id: 'fb_r3', type: 'resistor', label: 'R3', value: 330, position: { x: 600, y: 120 } },
    { id: 'fb_r4', type: 'resistor', label: 'R4', value: 470, position: { x: 800, y: 120 } },
    { id: 'fb_gnd', type: 'ground', label: 'GND', position: { x: 1000, y: 120 } },
  ],
  edges: [
    { id: 'fbe1', sourceId: 'fb_bat', targetId: 'fb_r1' },
    { id: 'fbe2', sourceId: 'fb_r1', targetId: 'fb_r2' },
    { id: 'fbe3', sourceId: 'fb_r2', targetId: 'fb_r3' },
    { id: 'fbe4', sourceId: 'fb_r3', targetId: 'fb_r4' },
    { id: 'fbe5', sourceId: 'fb_r4', targetId: 'fb_gnd' },
  ],
}

export const DEMO_CIRCUITS: DemoCircuit[] = [
  {
    id: 'series_resistors',
    name: 'Series Resistors',
    description: 'Two resistors in series — Ohm\'s Law demo. Total R = R1 + R2.',
    category: 'basic',
    graph: {
      components: [
        { id: 'bat1', type: 'battery', label: '9V Battery', value: 9, position: { x: 0, y: 120 } },
        { id: 'r1', type: 'resistor', label: 'R1', value: 220, position: { x: 200, y: 120 } },
        { id: 'r2', type: 'resistor', label: 'R2', value: 330, position: { x: 400, y: 120 } },
        { id: 'gnd1', type: 'ground', label: 'GND', position: { x: 600, y: 120 } },
      ],
      edges: [
        { id: 'e1', sourceId: 'bat1', targetId: 'r1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e2', sourceId: 'r1', targetId: 'r2', sourcePin: 'right', targetPin: 'left' },
        { id: 'e3', sourceId: 'r2', targetId: 'gnd1', sourcePin: 'right', targetPin: 'left' },
      ],
    },
  },
  {
    id: 'led_resistor',
    name: 'LED + Resistor',
    description: 'Current-limiting resistor protects the LED from burning out.',
    category: 'basic',
    graph: {
      components: [
        { id: 'bat1', type: 'battery', label: '9V Battery', value: 9, position: { x: 0, y: 120 } },
        { id: 'r1', type: 'resistor', label: 'R1 220Ω', value: 220, position: { x: 200, y: 120 } },
        { id: 'led1', type: 'led', label: 'LED', position: { x: 400, y: 120 } },
        { id: 'gnd1', type: 'ground', label: 'GND', position: { x: 600, y: 120 } },
      ],
      edges: [
        { id: 'e1', sourceId: 'bat1', targetId: 'r1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e2', sourceId: 'r1', targetId: 'led1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e3', sourceId: 'led1', targetId: 'gnd1', sourcePin: 'right', targetPin: 'left' },
      ],
    },
  },
  {
    id: 'rc_circuit',
    name: 'RC Circuit',
    description: 'Resistor-capacitor pair — demonstrates charging and discharging.',
    category: 'intermediate',
    graph: {
      components: [
        { id: 'bat1', type: 'battery', label: '5V Battery', value: 5, position: { x: 0, y: 120 } },
        { id: 'r1', type: 'resistor', label: 'R 1kΩ', value: 1000, position: { x: 200, y: 120 } },
        { id: 'c1', type: 'capacitor', label: 'C 100µF', value: 100, position: { x: 400, y: 120 } },
        { id: 'gnd1', type: 'ground', label: 'GND', position: { x: 600, y: 120 } },
      ],
      edges: [
        { id: 'e1', sourceId: 'bat1', targetId: 'r1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e2', sourceId: 'r1', targetId: 'c1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e3', sourceId: 'c1', targetId: 'gnd1', sourcePin: 'right', targetPin: 'left' },
      ],
    },
  },
  {
    id: 'voltage_divider',
    name: 'Voltage Divider',
    description: 'Two resistors split voltage — Vout = Vin × R2/(R1+R2).',
    category: 'intermediate',
    graph: {
      components: [
        { id: 'bat1', type: 'battery', label: '12V Battery', value: 12, position: { x: 0, y: 0 } },
        { id: 'r1', type: 'resistor', label: 'R1 1kΩ', value: 1000, position: { x: 200, y: 0 } },
        { id: 'wire1', type: 'wire', label: 'Vout', position: { x: 400, y: 0 } },
        { id: 'r2', type: 'resistor', label: 'R2 2.2kΩ', value: 2200, position: { x: 400, y: 160 } },
        { id: 'gnd1', type: 'ground', label: 'GND', position: { x: 400, y: 300 } },
      ],
      edges: [
        { id: 'e1', sourceId: 'bat1', targetId: 'r1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e2', sourceId: 'r1', targetId: 'wire1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e3', sourceId: 'wire1', targetId: 'r2', sourcePin: 'bottom', targetPin: 'top' },
        { id: 'e4', sourceId: 'r2', targetId: 'gnd1', sourcePin: 'bottom', targetPin: 'top' },
      ],
    },
  },
  {
    id: 'switch_led',
    name: 'Switch-Controlled LED',
    description: 'Toggle the switch to turn the LED on/off. Double-click the switch!',
    category: 'basic',
    graph: {
      components: [
        { id: 'bat1', type: 'battery', label: '9V Battery', value: 9, position: { x: 0, y: 120 } },
        { id: 'sw1', type: 'switch', label: 'SW1', value: 0, position: { x: 160, y: 120 } },
        { id: 'r1', type: 'resistor', label: 'R1 220Ω', value: 220, position: { x: 320, y: 120 } },
        { id: 'led1', type: 'led', label: 'LED', position: { x: 480, y: 120 } },
        { id: 'gnd1', type: 'ground', label: 'GND', position: { x: 640, y: 120 } },
      ],
      edges: [
        { id: 'e1', sourceId: 'bat1', targetId: 'sw1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e2', sourceId: 'sw1', targetId: 'r1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e3', sourceId: 'r1', targetId: 'led1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e4', sourceId: 'led1', targetId: 'gnd1', sourcePin: 'right', targetPin: 'left' },
      ],
    },
  },
  {
    id: 'motor_circuit',
    name: 'Motor Circuit',
    description: 'Battery drives a DC motor through a switch — basic actuator circuit.',
    category: 'basic',
    graph: {
      components: [
        { id: 'bat1', type: 'battery', label: '9V Battery', value: 9, position: { x: 0, y: 120 } },
        { id: 'sw1', type: 'switch', label: 'SW1', value: 1, position: { x: 200, y: 120 } },
        { id: 'mot1', type: 'motor', label: 'Motor', position: { x: 400, y: 120 } },
        { id: 'gnd1', type: 'ground', label: 'GND', position: { x: 600, y: 120 } },
      ],
      edges: [
        { id: 'e1', sourceId: 'bat1', targetId: 'sw1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e2', sourceId: 'sw1', targetId: 'mot1', sourcePin: 'right', targetPin: 'left' },
        { id: 'e3', sourceId: 'mot1', targetId: 'gnd1', sourcePin: 'right', targetPin: 'left' },
      ],
    },
  },
]
