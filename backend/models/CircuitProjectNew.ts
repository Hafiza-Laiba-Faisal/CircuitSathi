import mongoose, { Schema, Document } from 'mongoose'
import { CircuitGraph, SimulationResult, SceneConfig } from '../../shared/types/circuit'

export interface ICircuitProject {
  name: string
  circuitGraph: CircuitGraph
  sceneConfig?: SceneConfig
  createdAt: Date
  updatedAt: Date
}

export interface CircuitProjectDocument extends ICircuitProject, Document {}

const CircuitNodeSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['resistor', 'capacitor', 'inductor', 'led', 'diode', 'voltageSource', 'currentSource', 'switch', 'ground', 'wire'],
    },
    value: { type: Number },
    isOn: { type: Boolean },
    position: { x: { type: Number }, y: { type: Number } },
    voltage: { type: Number },
    current: { type: Number },
    power: { type: Number },
    fault: { type: String, enum: ['open', 'short', 'overcurrent', null] },
  },
  { _id: false },
)

const CircuitEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    current: { type: Number },
  },
  { _id: false },
)

const CircuitGraphSchema = new Schema(
  {
    nodes: [CircuitNodeSchema],
    edges: [CircuitEdgeSchema],
  },
  { _id: false },
)

const SimulationResultSchema = new Schema(
  {
    graph: CircuitGraphSchema,
    totalPower: { type: Number },
    faults: [{ type: String }],
  },
  { _id: false },
)

const SceneConfigSchema = new Schema(
  {
    biome: { type: String, enum: ['forest', 'dungeon', 'desert', 'arctic', 'lava', 'void'] },
    tint: { type: String },
    heroSpeed: { type: Number },
    narrative: { type: String },
    audioUrl: { type: String },
    simulationResult: SimulationResultSchema,
  },
  { _id: false },
)

const CircuitProjectSchema = new Schema<CircuitProjectDocument>(
  {
    name: { type: String, required: true },
    circuitGraph: { type: CircuitGraphSchema, required: true },
    sceneConfig: SceneConfigSchema,
  },
  { timestamps: true },
)

export const CircuitProjectNewModel = mongoose.model<CircuitProjectDocument>(
  'CircuitProjectNew',
  CircuitProjectSchema,
)
