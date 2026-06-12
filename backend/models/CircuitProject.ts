import mongoose, { Schema, Document } from 'mongoose'
import { CircuitProject as ICircuitProject } from '../../shared/types'

export interface CircuitProjectDocument extends Omit<ICircuitProject, '_id'>, Document {}

const ComponentStateSchema = new Schema(
  {
    componentId: { type: String, required: true },
    powered: { type: Boolean, required: true },
    currentFlow: { type: Number, required: true },
    fault: { type: String, enum: ['open_circuit', 'short_circuit', 'overload', 'missing_resistor', 'floating_ground'] },
  },
  { _id: false },
)

const FaultSchema = new Schema(
  {
    componentId: { type: String, required: true },
    fault: {
      type: String,
      required: true,
      enum: ['open_circuit', 'short_circuit', 'overload', 'missing_resistor', 'floating_ground'],
    },
    message: { type: String, required: true },
  },
  { _id: false },
)

const SimulationStateSchema = new Schema(
  {
    isValid: { type: Boolean, required: true },
    componentStates: [ComponentStateSchema],
    faults: [FaultSchema],
    commentary: { type: String },
  },
  { _id: false },
)

const FaultHistoryEntrySchema = new Schema(
  {
    timestamp: { type: String, required: true },
    faults: [FaultSchema],
  },
  { _id: false },
)

const CircuitComponentSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['battery', 'wire', 'resistor', 'led', 'capacitor', 'switch', 'ground', 'motor'],
    },
    label: { type: String },
    value: { type: Number },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
  },
  { _id: false },
)

const CircuitEdgeSchema = new Schema(
  {
    id: { type: String, required: true },
    sourceId: { type: String, required: true },
    targetId: { type: String, required: true },
    sourcePin: { type: String },
    targetPin: { type: String },
  },
  { _id: false },
)

const CircuitProjectSchema = new Schema<CircuitProjectDocument>(
  {
    name: { type: String, required: true },
    graph: {
      components: [CircuitComponentSchema],
      edges: [CircuitEdgeSchema],
    },
    simulationState: SimulationStateSchema,
    faultHistory: [FaultHistoryEntrySchema],
  },
  { timestamps: true },
)

export const CircuitProjectModel = mongoose.model<CircuitProjectDocument>(
  'CircuitProject',
  CircuitProjectSchema,
)
