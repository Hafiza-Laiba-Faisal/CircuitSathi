'use client'

import { useState } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import { DEBUG_PRESETS } from '../lib/debugPresets'

export default function ExplanationPanel() {
  const {
    simulationState,
    isNarrating,
    activeMode,
    selectedComponentId,
    circuitGraph,
    requestCircuitLoad,
    setActiveMode,
  } = useCircuitStore()

  if (activeMode === 'debug') return <DebugPanel />

  const selectedComp = circuitGraph.components.find(c => c.id === selectedComponentId)
  const selectedState = simulationState?.componentStates.find(
    cs => cs.componentId === selectedComponentId,
  )

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      {/* Selected component detail */}
      {selectedComp && (
        <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Selected Component
          </h3>
          <p className="text-sm font-medium text-white">{selectedComp.label || selectedComp.type}</p>
          <p className="text-xs text-gray-400 capitalize">Type: {selectedComp.type}</p>
          {selectedComp.value !== undefined && (
            <p className="text-xs text-gray-400">
              Value: {selectedComp.type === 'battery' || selectedComp.type === 'resistor'
                ? Number(selectedComp.value).toFixed(1)
                : selectedComp.value}
              {selectedComp.type === 'battery' ? ' V' : selectedComp.type === 'resistor' ? ' Ω' : selectedComp.type === 'capacitor' ? ' µF' : ''}
            </p>
          )}
          {selectedState && (
            <>
              <p className={`text-xs mt-1 ${selectedState.powered ? 'text-green-400' : 'text-red-400'}`}>
                {selectedState.powered ? 'Powered' : 'Unpowered'}
              </p>
              {selectedState.fault && (
                <p className="text-xs text-red-400 mt-0.5">Fault: {selectedState.fault.replace(/_/g, ' ')}</p>
              )}
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Current flow</span>
                <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${(selectedState.currentFlow * 100).toFixed(0)}%`,
                      backgroundColor:
                        selectedState.currentFlow > 0.85 ? '#ef4444' :
                        selectedState.currentFlow > 0.5 ? '#f59e0b' : '#22c55e',
                    }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 w-8 text-right">
                  {(selectedState.currentFlow * 100).toFixed(0)}%
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Faults list */}
      {simulationState && simulationState.faults.length > 0 && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
            Faults ({simulationState.faults.length})
          </h3>
          <ul className="space-y-1.5">
            {simulationState.faults.map((f, i) => (
              <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Commentary */}
      <div className="flex-1 bg-gray-800 rounded-lg p-4 text-gray-300 text-sm overflow-y-auto whitespace-pre-wrap">
        {simulationState?.commentary ? (
          <p>{simulationState.commentary}</p>
        ) : (
          <p className="text-gray-500 italic">
            Build a circuit to see the simulation analysis here.
          </p>
        )}
      </div>

      {/* Circuit stats */}
      {circuitGraph.components.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-white">{circuitGraph.components.length}</div>
            <div className="text-[10px] text-gray-400 uppercase">Parts</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{circuitGraph.edges.length}</div>
            <div className="text-[10px] text-gray-400 uppercase">Wires</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${simulationState?.isValid ? 'text-green-400' : 'text-red-400'}`}>
              {simulationState?.isValid ? 'OK' : simulationState?.faults.length ?? '?'}
            </div>
            <div className="text-[10px] text-gray-400 uppercase">
              {simulationState?.isValid ? 'Status' : 'Faults'}
            </div>
          </div>
        </div>
      )}

      {/* Audio player placeholder */}
      <div className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
        <button
          disabled={!isNarrating}
          className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-400 cursor-not-allowed"
          aria-label="Play narration"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div className="flex-1 bg-gray-700 rounded-full h-1.5">
          <div className="bg-gray-500 h-1.5 rounded-full w-0" />
        </div>
        <span className="text-xs text-gray-500">0:00</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Debug mode panel                                                   */
/* ------------------------------------------------------------------ */

function DebugPanel() {
  const { requestCircuitLoad, simulationState } = useCircuitStore()
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const currentPreset = DEBUG_PRESETS.find(p => p.id === activePreset)

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-2">
          Debug Challenges
        </h3>
        <p className="text-xs text-gray-400 mb-3">
          Load a broken circuit and diagnose the fault. Can you find what is wrong?
        </p>
        <div className="space-y-1.5">
          {DEBUG_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => {
                setActivePreset(preset.id)
                requestCircuitLoad(preset.graph)
              }}
              className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-colors ${
                activePreset === preset.id
                  ? 'bg-cyan-900/50 border border-cyan-700 text-cyan-300'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {currentPreset && (
        <>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <h4 className="text-xs font-semibold text-gray-300 mb-1">{currentPreset.name}</h4>
            <p className="text-xs text-gray-400">{currentPreset.description}</p>
          </div>
          <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-amber-400 mb-1">Hint</h4>
            <p className="text-xs text-amber-300/80">{currentPreset.hint}</p>
          </div>
        </>
      )}

      {simulationState && simulationState.faults.length > 0 && (
        <div className="bg-red-950/40 border border-red-900/60 rounded-lg p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
            Detected Faults
          </h3>
          <ul className="space-y-1.5">
            {simulationState.faults.map((f, i) => (
              <li key={i} className="text-xs text-red-300 flex items-start gap-1.5">
                <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {simulationState?.commentary && (
        <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap">
          {simulationState.commentary}
        </div>
      )}
    </div>
  )
}
