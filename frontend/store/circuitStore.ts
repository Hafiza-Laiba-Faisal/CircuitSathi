import { create } from 'zustand'
import { CircuitGraph, SimulationState, CircuitComponent, CircuitEdge, ComponentType, TutorialStep } from '../../shared/types'
import { simulate } from '../lib/simulationEngine'
import type { Node as RFNode, Edge as RFEdge } from 'reactflow'
import { LEVELS } from '../lib/levels'

type ActiveMode = 'build' | 'upload' | 'learn' | 'debug' | 'challenge'
export type CanvasStatus = 'idle' | 'drawing' | 'simulating' | 'updated' | 'incomplete' | 'fault'

const TYPE_MAP: Record<string, ComponentType> = {
  inductor: 'resistor',
  diode: 'led',
  voltage_source: 'battery',
  current_source: 'battery',
}

interface CircuitStore {
  activeMode: ActiveMode
  circuitGraph: CircuitGraph
  simulationState: SimulationState | null
  selectedComponentId: string | null
  isNarrating: boolean
  pendingLoad: CircuitGraph | null
  projectId: string | null
  projectName: string | null
  currentNarration: string | null

  // Canvas
  canvasNodes: RFNode[]
  canvasEdges: RFEdge[]
  isDirty: boolean
  canvasStatus: CanvasStatus
  
  // Progression
  xp: number
  unlockedLevels: number[]
  currentLevelId: number
  currentMissionId: string
  
  // Tutorial Mode
  tutorialSteps: TutorialStep[]
  activeStepIdx: number
  isTutorialMode: boolean
  manualText: string | null

  setActiveMode: (mode: ActiveMode) => void
  setCircuitGraph: (graph: CircuitGraph) => void
  setSimulationState: (state: SimulationState | null) => void
  setSelectedComponentId: (id: string | null) => void
  setIsNarrating: (value: boolean) => void
  setCurrentNarration: (text: string | null) => void
  requestCircuitLoad: (graph: CircuitGraph) => void
  clearPendingLoad: () => void
  setProjectMeta: (id: string | null, name: string | null) => void
  clearCircuit: () => void

  setCanvasNodes: (nodes: RFNode[]) => void
  setCanvasEdges: (edges: RFEdge[]) => void
  setIsDirty: (dirty: boolean) => void
  setCanvasStatus: (status: CanvasStatus) => void
  canvasToCircuitGraph: () => CircuitGraph
  completeMission: (missionId: string, reward: number) => void

  // Tutorial Actions
  setTutorialSteps: (steps: TutorialStep[]) => void
  setActiveStepIdx: (idx: number) => void
  setIsTutorialMode: (active: boolean) => void
  setManualText: (text: string | null) => void
  loadStepSolution: (idx: number) => void
}

const emptyGraph: CircuitGraph = { components: [], edges: [] }

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  activeMode: 'build',
  circuitGraph: emptyGraph,
  simulationState: null,
  selectedComponentId: null,
  isNarrating: false,
  pendingLoad: null,
  projectId: null,
  projectName: null,
  currentNarration: null,

  canvasNodes: [],
  canvasEdges: [],
  isDirty: false,
  canvasStatus: 'idle',
  
  xp: 0,
  unlockedLevels: [1],
  currentLevelId: 1,
  currentMissionId: 'ohm_1',

  tutorialSteps: [],
  activeStepIdx: 0,
  isTutorialMode: false,
  manualText: null,

  setActiveMode: (mode) => set({ activeMode: mode }),

  setCircuitGraph: (graph) => {
    const sim = simulate(graph)
    set({ circuitGraph: graph, simulationState: sim })
  },

  setSimulationState: (state) => set({ simulationState: state }),
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),
  setIsNarrating: (value) => set({ isNarrating: value }),
  setCurrentNarration: (text) => set({ currentNarration: text }),
  requestCircuitLoad: (graph) => set({ pendingLoad: graph }),
  clearPendingLoad: () => set({ pendingLoad: null }),
  setProjectMeta: (id, name) => set({ projectId: id, projectName: name }),

  clearCircuit: () => {
    const sim = simulate(emptyGraph)
    set({
      circuitGraph: emptyGraph,
      simulationState: sim,
      selectedComponentId: null,
      projectId: null,
      projectName: null,
      pendingLoad: emptyGraph,
    })
  },

  setCanvasNodes: (nodes) => set({ canvasNodes: nodes }),
  setCanvasEdges: (edges) => set({ canvasEdges: edges }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setCanvasStatus: (status) => set({ canvasStatus: status }),

  completeMission: (missionId, reward) => {
    const { xp, currentLevelId, unlockedLevels } = get()
    const newXP = xp + reward
    const nextLevel = LEVELS.find(l => l.unlocksAt <= newXP && l.id > currentLevelId)
    
    if (nextLevel && !unlockedLevels.includes(nextLevel.id)) {
        set({ 
            xp: newXP, 
            currentLevelId: nextLevel.id, 
            unlockedLevels: [...unlockedLevels, nextLevel.id],
            currentMissionId: nextLevel.missions[0].id 
        })
    } else {
        set({ xp: newXP })
    }
  },

  canvasToCircuitGraph: (): CircuitGraph => {
    const { canvasNodes, canvasEdges } = get()
    const components: CircuitComponent[] = canvasNodes.map((node) => {
      const rawType = (node.data?.componentType as string) ?? 'wire'
      const mappedType = (TYPE_MAP[rawType] ?? rawType) as ComponentType
      const validTypes: ComponentType[] = ['battery', 'wire', 'resistor', 'led', 'capacitor', 'switch', 'ground', 'motor']
      const finalType: ComponentType = validTypes.includes(mappedType) ? mappedType : 'wire'
      return {
        id: node.id,
        type: finalType,
        label: (node.data?.label as string) ?? rawType,
        position: { x: node.position.x, y: node.position.y },
        value: node.data?.value as number | undefined,
      }
    })
    const edges: CircuitEdge[] = canvasEdges.map((edge) => ({
      id: edge.id, sourceId: edge.source, targetId: edge.target,
    }))
    return { components, edges }
  },

  setTutorialSteps: (steps) => set({ tutorialSteps: steps }),
  setActiveStepIdx: (idx) => set({ activeStepIdx: idx }),
  setIsTutorialMode: (active) => set({ isTutorialMode: active }),
  setManualText: (text) => set({ manualText: text }),
  loadStepSolution: (idx) => {
    const { tutorialSteps } = get()
    const step = tutorialSteps[idx]
    if (step?.initialGraph) {
      set({ pendingLoad: step.initialGraph })
    }
  },
}))
