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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [learningTopic, setLearningTopic] = useState('')
  const loadStepSolution = useCircuitStore(s => s.loadStepSolution)

  const handleStartTutorial = async (mode: 'manual' | 'topic') => {
    if (mode === 'manual' && !manualText && !selectedFile) return
    if (mode === 'topic' && !learningTopic) return

    setLoading(true)
    setError(null)
    
    const formData = new FormData()
    if (mode === 'manual') {
      if (selectedFile) formData.append('manualFile', selectedFile)
      else if (manualText) formData.append('manualText', manualText)
    } else {
      formData.append('manualText', `Create a tutorial about this topic: ${learningTopic}`)
    }

    try {
      const response = await axios.post<{ steps: any[] }>('http://localhost:3001/api/tutor/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setTutorialSteps(response.data.steps)
      setIsTutorialMode(true)
      setActiveStepIdx(0)
    } catch (err) {
      console.error(err)
      setError('AI failed to generate tutorial. Try again!' as any)
    } finally {
      setLoading(false)
    }
  }

  const currentStep = tutorialSteps[activeStepIdx]

  if (!isTutorialMode) {
    return (
      <div className="absolute top-20 right-6 w-80 glass-panel rounded-2xl p-6 shadow-2xl z-40 animate-in fade-in slide-in-from-right-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
        <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-4">AI Sathi Tutor</h3>
        
        {/* Quick Learn Mode */}
        <div className="mb-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <label className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest mb-2 block">Quick Learn (Any Topic)</label>
          <input 
            type="text"
            className="w-full bg-black/40 border border-amber-500/20 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-400/50 mb-3"
            placeholder="e.g. Series Circuits, Ohm's Law..."
            value={learningTopic}
            onChange={(e) => setLearningTopic(e.target.value)}
          />
          <button
            onClick={() => handleStartTutorial('topic')}
            className="w-full py-2 rounded-lg bg-amber-500 text-black font-bold text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <span className="animate-spin text-lg">◌</span> : 'Start Learning'}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
          <div className="relative flex justify-center text-[9px] uppercase font-bold text-slate-700 bg-[#0a0e1a] px-2 font-mono italic">OR UPLOAD MANUAL</div>
        </div>

        {/* File Upload Section */}
        <div className="mb-4">
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/5 hover:border-amber-400/30 transition-all">
            <div className="flex flex-col items-center justify-center pt-2 pb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {selectedFile ? selectedFile.name : 'Choose Manual File'}
              </span>
              <p className="text-[9px] text-slate-600 mt-1">PDF, DOCX, or Raw Text</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.docx,.txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <textarea
          className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400/50 transition-colors custom-scrollbar mb-4"
          placeholder="Paste manual content here..."
          value={manualText || ''}
          onChange={(e) => {
            setManualText(e.target.value)
            if (e.target.value) setSelectedFile(null)
          }}
        />
        {error && <p className="text-[10px] text-rose-500 mb-2 font-medium">{error}</p>}
        <button
          onClick={() => handleStartTutorial('manual')}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <span className="animate-spin text-lg">◌</span> : 'Parse Lab Manual'}
        </button>
      </div>
    )
  }

  return (
    <div className="absolute top-20 right-6 w-85 glass-panel rounded-2xl p-6 shadow-2xl z-40 border border-amber-400/20 animate-in fade-in slide-in-from-right-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-[0.2em]">Step {activeStepIdx + 1}/{tutorialSteps.length}</h3>
        <button 
          onClick={() => setIsTutorialMode(false)}
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
