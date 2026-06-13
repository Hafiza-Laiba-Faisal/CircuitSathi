'use client'

import { useState } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import axios from 'axios'

export default function TutorPanel() {
  const {
    isTutorialMode,
    tutorialSteps,
    activeStepIdx,
    setIsTutorialMode,
    setTutorialSteps,
    setActiveStepIdx,
    manualText,
    setManualText,
  } = useCircuitStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleStartTutorial = async () => {
    if (!manualText) return
    setLoading(true)
    setError(null)
    try {
      const response = await axios.post<{ steps: any[] }>('http://localhost:3001/api/tutor/parse', {
        manualText,
      })
      setTutorialSteps(response.data.steps)
      setIsTutorialMode(true)
      setActiveStepIdx(0)
    } catch (err) {
      console.error(err)
      setError('AI failed to parse manual. Try a different text.' as any)
    } finally {
      setLoading(false)
    }
  }

  const currentStep = tutorialSteps[activeStepIdx]

  if (!isTutorialMode) {
    return (
      <div className="absolute top-20 right-6 w-80 glass-panel rounded-2xl p-6 shadow-2xl z-40 animate-in fade-in slide-in-from-right-4">
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">AI Sathi Tutor</h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Paste your lab experiment or manual below, and I'll guide you through it!
        </p>
        <textarea
          className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 transition-colors custom-scrollbar"
          placeholder="Paste manual content here..."
          value={manualText || ''}
          onChange={(e) => setManualText(e.target.value)}
        />
        {error && <p className="text-[10px] text-rose-500 mt-2 font-medium">{error}</p>}
        <button
          onClick={handleStartTutorial}
          disabled={loading || !manualText}
          className="w-full mt-4 py-3 bg-white text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? 'AI is Thinking...' : 'Start Guided Lab'}
        </button>
      </div>
    )
  }

  if (!currentStep) return null

  return (
    <div className="absolute top-20 right-6 w-80 glass-panel rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-right-4">
      {/* Header */}
      <div className="bg-amber-400 px-5 py-3 flex justify-between items-center">
        <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Mission Active</span>
        <button 
          onClick={() => setIsTutorialMode(false)}
          className="text-black hover:scale-110 transition-transform"
        >
          ✕
        </button>
      </div>

      <div className="p-6">
        {/* Step Progress */}
        <div className="flex gap-1.5 mb-4">
          {tutorialSteps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full flex-1 transition-all duration-300 ${
                i <= activeStepIdx ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'bg-slate-800'
              }`}
            />
          ))}
        </div>

        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Step {activeStepIdx + 1}</h4>
        <h3 className="text-base font-bold text-white mb-4 leading-tight">{currentStep.title}</h3>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 mb-4">
          <p className="text-[11px] text-amber-200/90 leading-relaxed italic">
            "{currentStep.explanation}"
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Instructions</span>
            <p className="text-xs text-slate-200 leading-relaxed">
              {currentStep.instruction}
            </p>
          </div>

          <div className="pt-4 border-t border-white/5">
             <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Requirements</span>
             </div>
             <div className="flex flex-wrap gap-2">
                {currentStep.goalCriteria.requiredComponents.map((comp, idx) => (
                  <span key={idx} className="px-2 py-1 bg-slate-800 border border-white/5 rounded text-[9px] uppercase font-bold text-slate-400">
                    {comp}
                  </span>
                ))}
             </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={() => setActiveStepIdx(Math.max(0, activeStepIdx - 1))}
            disabled={activeStepIdx === 0}
            className="flex-1 py-3 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-30"
          >
            Prev
          </button>
          <button
            onClick={() => setActiveStepIdx(Math.min(tutorialSteps.length - 1, activeStepIdx + 1))}
            className="flex-[2] py-3 bg-amber-400 text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-300 transition-all shadow-lg shadow-amber-400/20"
          >
            {activeStepIdx === tutorialSteps.length - 1 ? 'Finish' : 'Next Step'}
          </button>
        </div>
      </div>
    </div>
  )
}
