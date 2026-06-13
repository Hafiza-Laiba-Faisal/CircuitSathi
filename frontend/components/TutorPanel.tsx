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
  const voiceEnabled = useCircuitStore(s => s.voiceEnabled)
  const setVoiceEnabled = useCircuitStore(s => s.setVoiceEnabled)

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
      const steps = response.data.steps
      setTutorialSteps(steps)
      setIsTutorialMode(true)
      setActiveStepIdx(0)
      
      // Auto-load the first step's circuit if it exists
      if (steps[0]?.initialGraph) {
        console.log('[Tutor] Starting animated circuit build sequence...')
        useCircuitStore.getState().animateCircuitBuild(steps[0].initialGraph)
      }
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest">AI Sathi Tutor</h3>
          <button 
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-full transition-all ${voiceEnabled ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
            title={voiceEnabled ? 'Voice Mode On' : 'Voice Mode Off'}
          >
            {voiceEnabled ? '🎧' : '🔇'}
          </button>
        </div>
        
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

  if (!isTutorialMode) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-700">
        <div className="max-w-4xl w-full grid grid-cols-2 gap-12 p-12">
          {/* Left: Quick Start */}
          <div className="space-y-6">
             <div className="flex items-center gap-4 mb-2">
                <div className="w-1 h-8 bg-amber-400 rounded-full" />
                <h2 className="text-xl font-bold tracking-tight text-white">AI Sathi Learning Console</h2>
             </div>
             <p className="text-xs text-slate-400 leading-relaxed uppercase tracking-wider">Describe a topic or upload your laboratory manual to begin the interactive demonstration.</p>
             
             <div className="space-y-4 pt-4">
                <div className="relative group">
                  <input 
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400/50 transition-all"
                    placeholder="e.g. Logic Gates, Full Wave Rectifier..."
                    value={learningTopic}
                    onChange={(e) => setLearningTopic(e.target.value)}
                  />
                  <button
                    onClick={() => handleStartTutorial('topic')}
                    className="absolute right-2 top-2 px-6 py-2 rounded-lg bg-amber-400 text-black font-bold text-[10px] uppercase tracking-widest hover:bg-amber-300 transition-all shadow-xl shadow-amber-400/10"
                  >
                    {loading ? '...' : 'Explore'}
                  </button>
                </div>
             </div>
          </div>

          {/* Right: Manual Upload */}
          <div className="flex flex-col justify-center border-l border-white/5 pl-12 space-y-4">
             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.25em]">Laboratory Integration</span>
             <label className="group flex items-center gap-4 p-4 border border-white/5 bg-white/[0.02] rounded-xl cursor-pointer hover:bg-white/[0.04] transition-all">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📤</div>
                <div>
                   <h3 className="text-xs font-bold text-slate-300 group-hover:text-amber-400 transition-colors uppercase tracking-wider">
                     {selectedFile ? selectedFile.name : 'Upload Lab Manual'}
                   </h3>
                   <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-mono">PDF / DOC / TXT</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
             </label>
             <button
               onClick={() => handleStartTutorial('manual')}
               className="w-full py-4 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-[0.3em] transition-all border border-white/10 rounded-xl hover:border-white/30"
             >
               {loading ? 'Analyzing...' : 'Parse Manual'}
             </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* 1. LEFT: Concept & Summary */}
      <div className="w-1/3 border-r border-white/5 p-8 flex flex-col justify-center overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-4 h-1 bg-amber-400 rounded-full" />
          <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.3em] uppercase">Phase 01: Concept</h2>
        </div>
        <h2 className="text-2xl font-bold text-white mb-4 tracking-tight leading-tight">{currentStep.title}</h2>
        <div className="bg-amber-400/5 border border-amber-400/10 p-5 rounded-2xl">
          <p className="text-xs text-amber-200/80 leading-relaxed font-medium italic">
            "{currentStep.explanation}"
          </p>
        </div>
      </div>

      {/* 2. MIDDLE: Steps & Tasks */}
      <div className="w-1/3 border-r border-white/5 p-8 flex flex-col justify-center bg-black/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <span className="w-4 h-1 bg-emerald-400 rounded-full" />
             <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.3em] uppercase">Phase 02: Execution</h2>
          </div>
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">Step {activeStepIdx + 1} of {tutorialSteps.length}</span>
        </div>
        
        <div className="space-y-6">
           <div className="glass-panel-light p-6 rounded-2xl border border-white/5 bg-white/5">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-3">Live Instruction</span>
              <p className="text-sm font-medium text-slate-200 leading-relaxed">{currentStep.instruction}</p>
           </div>
           
           <div className="flex gap-4">
              <button
                onClick={() => setActiveStepIdx(Math.max(0, activeStepIdx - 1))}
                className="flex-1 py-4 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-all border border-white/5 rounded-xl"
              >
                Previous
              </button>
              <button
                onClick={() => setActiveStepIdx(Math.min(tutorialSteps.length - 1, activeStepIdx + 1))}
                className="flex-[2] py-4 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all shadow-2xl shadow-white/5"
              >
                Next Procedure
              </button>
           </div>
        </div>
      </div>

      {/* 3. RIGHT: Hints & Quiz */}
      <div className="w-1/3 p-8 flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-6">
           <span className="w-4 h-1 bg-blue-400 rounded-full" />
           <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.3em] uppercase">Phase 03: Validation</h2>
        </div>
        
        <div className="grid grid-rows-2 gap-4 h-full py-4">
           {/* Hint Section */}
           <div className="bg-black/20 border border-white/5 rounded-2xl p-6 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="animate-pulse">💡</span> Learning Hint
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Connect the components as shown in the schematic above. Watch for the electron flow indicators in the simulation view.
              </p>
           </div>

           {/* Quiz/Challenge Section */}
           <div className="bg-amber-400/5 border border-dashed border-amber-400/20 rounded-2xl p-6 flex flex-col justify-center group cursor-pointer hover:bg-amber-400/10 transition-all">
              <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-3">Knowledge Check</span>
              <p className="text-[11px] text-slate-300 font-medium group-hover:text-white">What happens to the current if the resistance is doubled in this configuration?</p>
              <div className="mt-4 flex gap-2">
                 <span className="px-2 py-1 bg-black/40 rounded text-[8px] font-bold text-slate-500 hover:text-amber-400 transition-colors uppercase border border-white/5">Option A</span>
                 <span className="px-2 py-1 bg-black/40 rounded text-[8px] font-bold text-slate-500 hover:text-amber-400 transition-colors uppercase border border-white/5">Option B</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
