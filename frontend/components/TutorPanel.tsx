'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import axios from 'axios'

interface TutorPanelProps {
  variant?: 'floating' | 'docked'
}

export default function TutorPanel({ variant = 'floating' }: TutorPanelProps) {
  const {
    isTutorialMode,
    tutorialSteps,
    activeStepIdx,
    setIsTutorialMode,
    setTutorialSteps,
    setActiveStepIdx,
    manualText,
    setManualText,
    setTutorLayout,
  } = useCircuitStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [learningTopic, setLearningTopic] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const loadStepSolution = useCircuitStore(s => s.loadStepSolution)
  const voiceEnabled = useCircuitStore(s => s.voiceEnabled)
  const setVoiceEnabled = useCircuitStore(s => s.setVoiceEnabled)
  const isDocked = variant === 'docked'
  
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)

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
      // Replace any currently loaded demo with the generated AI tutorial content.
      useCircuitStore.getState().clearCircuit()
      setTutorLayout('bottom')
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

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.onended = () => {
      setIsSpeaking(false)
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
        currentAudioUrlRef.current = null
      }
    }
  }, [])

  // Voice synthesis function
  const speak = useCallback(async (text: string) => {
    if (isSpeaking) return
    const cleanText = text
      .replace(/[^\x00-\x7F]/g, ' ')
      .replace(/[⚡🔥💡🔋🚪⏚⚙️⚠️🔌📍🗺️⏸▶]/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600)

    if (!cleanText) return
    setIsSpeaking(true)

    try {
      const res = await fetch('http://localhost:3001/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      })

      if (!res.ok) {
        console.error('TTS API error:', res.status, await res.text())
        setIsSpeaking(false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      currentAudioUrlRef.current = url
      if (audioRef.current) {
        audioRef.current.src = url
        await audioRef.current.play()
      } else {
        setIsSpeaking(false)
      }
    } catch (err) {
      console.error('TTS error:', err)
      setIsSpeaking(false)
    }
  }, [isSpeaking])

  const stopSpeak = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsSpeaking(false)
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
  }, [])

  const currentStep = tutorialSteps[activeStepIdx]

  // Tutorial Mode - Responsive Layout
  if (isTutorialMode) {
    // Guard: ensure we have valid step data
    if (!currentStep || !tutorialSteps.length) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-[#080c16]/95">
          <div className="text-center p-6">
            <p className="text-sm text-slate-400">Loading tutorial...</p>
          </div>
        </div>
      )
    }

    if (isDocked) {
      // Docked: Use 3-column layout for large screens
      return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#080c16]/95">
          <div className="grid w-full gap-6 p-4 sm:p-6 xl:grid-cols-3">
            {/* Left: Concept & Summary */}
            <div className="xl:border-r xl:border-white/5 p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-4 h-1 bg-amber-400 rounded-full" />
                <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.3em] uppercase">Concept</h2>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white mb-4 tracking-tight leading-tight">{currentStep?.title || 'Step ' + (activeStepIdx + 1)}</h2>
              <div className="bg-amber-400/5 border border-amber-400/10 p-4 rounded-xl mb-4">
                <p className="text-xs sm:text-sm text-amber-200/80 leading-relaxed font-medium italic">
                  "{currentStep?.explanation || 'Learn the concepts for this step.'}"
                </p>
              </div>
              <button
                onClick={() => currentStep?.explanation && speak(currentStep.explanation)}
                disabled={!currentStep?.explanation}
                className={`w-full py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                  isSpeaking
                    ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                    : 'bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:border-amber-500 hover:bg-amber-500/20'
                }`}
              >
                {isSpeaking ? '⏸ Stop' : '🔊 Explain'}
              </button>
            </div>

            {/* Middle: Steps & Tasks */}
            <div className="xl:border-r xl:border-white/5 p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-6 gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-1 bg-emerald-400 rounded-full" />
                  <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.3em] uppercase">Execution</h2>
                </div>
                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest whitespace-nowrap">Step {activeStepIdx + 1}/{tutorialSteps.length}</span>
              </div>
              
              <div className="space-y-4">
                <div className="glass-panel-light p-4 rounded-xl border border-white/5 bg-white/5">
                  <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-3">Live Instruction</span>
                  <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed mb-3">{currentStep?.instruction || 'Complete this step.'}</p>
                  <button
                    onClick={() => currentStep?.instruction && speak(currentStep.instruction)}
                    disabled={!currentStep?.instruction}
                    className={`w-full py-2 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                      isSpeaking
                        ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                        : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/20'
                    }`}
                  >
                    {isSpeaking ? '⏸ Stop' : '🔊 Read'}
                  </button>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setActiveStepIdx(Math.max(0, activeStepIdx - 1))}
                    className="flex-1 py-2 sm:py-3 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-all border border-white/5 rounded-lg"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setActiveStepIdx(Math.min(tutorialSteps.length - 1, activeStepIdx + 1))}
                    className="flex-[2] py-2 sm:py-3 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Goal Criteria */}
            <div className="p-4 sm:p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-4 h-1 bg-blue-400 rounded-full" />
                <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.3em] uppercase">Goals</h2>
              </div>
              
              <div className="space-y-3">
                {/* Required Components */}
                {currentStep?.goalCriteria?.requiredComponents && currentStep.goalCriteria.requiredComponents.length > 0 && (
                  <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col justify-center">
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                      Components Needed
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {currentStep.goalCriteria.requiredComponents.map((comp, i) => (
                        <span key={i} className="text-[8px] px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Powered Goal */}
                {currentStep?.goalCriteria?.powered !== undefined && (
                  <div className={`border rounded-xl p-4 flex flex-col justify-center ${currentStep.goalCriteria.powered ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                    <span className={`text-[9px] font-bold uppercase tracking-widest block ${currentStep.goalCriteria.powered ? 'text-green-400' : 'text-amber-400'}`}>
                      {currentStep.goalCriteria.powered ? '✓ Must be Powered' : 'Can be Unpowered'}
                    </span>
                  </div>
                )}

                {/* Min Voltage */}
                {currentStep?.goalCriteria?.minVoltage !== undefined && (
                  <div className="bg-slate-500/5 border border-slate-500/20 rounded-xl p-3 flex flex-col justify-center">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Min Voltage: {currentStep.goalCriteria.minVoltage}V</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    } else {
      // Floating: Compact layout
      return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-black/40 backdrop-blur-md animate-in fade-in duration-700 rounded-2xl border border-white/10">
          <div className="flex-shrink-0 border-b border-white/5 p-4 bg-white/[0.02]">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest">{currentStep?.title || 'Step ' + (activeStepIdx + 1)}</h3>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Step {activeStepIdx + 1} of {tutorialSteps.length}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            <div className="bg-amber-400/5 border border-amber-400/10 p-3 rounded-lg">
              <p className="text-xs text-amber-200/80 leading-relaxed font-medium italic">{currentStep?.explanation || 'Learn the concepts.'}</p>
            </div>
            
            <div className="bg-white/5 border border-white/5 p-4 rounded-lg">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-2">Instruction</span>
              <p className="text-xs font-medium text-slate-200 leading-relaxed">{currentStep?.instruction || 'Complete this step.'}</p>
            </div>
            
            {currentStep?.goalCriteria && (
              <div className="bg-black/20 border border-white/5 p-3 rounded-lg">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mb-2">Goal Criteria</span>
                {currentStep.goalCriteria.requiredComponents && currentStep.goalCriteria.requiredComponents.length > 0 && (
                  <p className="text-xs text-slate-300 mb-2">Components: {currentStep.goalCriteria.requiredComponents.join(', ')}</p>
                )}
                {currentStep.goalCriteria.powered !== undefined && (
                  <p className="text-xs text-slate-300">{currentStep.goalCriteria.powered ? '✓ Must be powered' : 'Can be unpowered'}</p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-shrink-0 flex gap-2 p-4 border-t border-white/5 bg-white/[0.02]">
            <button
              onClick={() => setActiveStepIdx(Math.max(0, activeStepIdx - 1))}
              className="flex-1 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-all border border-white/5 rounded-lg hover:bg-white/5"
            >
              Back
            </button>
            <button
              onClick={() => setActiveStepIdx(Math.min(tutorialSteps.length - 1, activeStepIdx + 1))}
              className="flex-1 py-2 bg-white text-black font-bold text-[9px] uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )
    }
  }

  if (!isTutorialMode) {
    if (isDocked) {
      return (
        <div className="h-full w-full overflow-y-auto custom-scrollbar bg-[#080c16]/95">
          <div className="grid min-h-full gap-4 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl border border-white/8 bg-black/30 p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest">AI Sathi Tutor</h3>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-500">Quick learn or manual import</p>
                </div>
                <button
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm transition-all ${voiceEnabled ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}
                  title={voiceEnabled ? 'Voice Mode On' : 'Voice Mode Off'}
                >
                  {voiceEnabled ? '🎧' : '🔇'}
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-amber-400/80">Quick Learn (Any Topic)</label>
                  <input
                    type="text"
                    className="mb-3 w-full rounded-lg border border-amber-500/20 bg-black/40 p-3 text-xs text-slate-200 focus:border-amber-400/50 focus:outline-none"
                    placeholder="e.g. Series Circuits, Ohm's Law..."
                    value={learningTopic}
                    onChange={(e) => setLearningTopic(e.target.value)}
                  />
                  <button
                    onClick={() => handleStartTutorial('topic')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 text-[10px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-amber-400"
                  >
                    {loading ? <span className="animate-spin text-lg">◌</span> : 'Start Learning'}
                  </button>
                </div>

                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <div className="mb-3 text-[9px] uppercase font-bold tracking-[0.25em] text-slate-600">Upload Manual</div>
                  <label className="flex min-h-[112px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 p-4 text-center transition-all hover:border-amber-400/30 hover:bg-white/[0.04]">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {selectedFile ? selectedFile.name : 'Choose Manual File'}
                      </span>
                      <p className="mt-1 text-[9px] text-slate-600">PDF, DOCX, or Raw Text</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                  <div className="relative flex justify-center bg-[#0a0e1a] px-2 text-[9px] font-bold uppercase italic tracking-[0.25em] text-slate-700">OR PASTE MANUAL TEXT</div>
                </div>
                <textarea
                  className="mb-3 h-28 w-full rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-slate-200 transition-colors focus:border-amber-400/50 focus:outline-none custom-scrollbar"
                  placeholder="Paste manual content here..."
                  value={manualText || ''}
                  onChange={(e) => {
                    setManualText(e.target.value)
                    if (e.target.value) setSelectedFile(null)
                  }}
                />
                {error && <p className="mb-2 text-[10px] font-medium text-rose-500">{error}</p>}
                <button
                  onClick={() => handleStartTutorial('manual')}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:border-white/20 hover:bg-white/10"
                >
                  {loading ? <span className="animate-spin text-lg">◌</span> : 'Parse Lab Manual'}
                </button>
              </div>
            </section>

            <aside className="rounded-2xl border border-white/8 bg-black/20 p-4 sm:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <h4 className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Tutor Notes</h4>
              </div>
              <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                <p>Use this panel to start a lesson from a topic or manual. It stays docked and scrollable, so it won't hide off-screen at startup.</p>
                <p className="text-slate-500 text-xs">If you want, I can also make this into a compact bottom drawer with tabs for Learn, Manual, and Voice.</p>
              </div>
            </aside>
          </div>
        </div>
      )
    }

    // Floating: Compact input panel
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
}
