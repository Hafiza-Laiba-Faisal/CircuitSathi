'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useCircuitStore } from '../store/circuitStore'
import TopNav from '../components/TopNav'
import SchematicBuilder from '../components/SchematicBuilder'
import { DEMO_CIRCUITS } from '../lib/demoCircuits'

const QuestView = dynamic(() => import('../components/QuestView'), { ssr: false })
const VoiceAgent = dynamic(() => import('../components/VoiceAgent'), { ssr: false })
const TutorPanel = dynamic(() => import('../components/TutorPanel'), { ssr: false })

export default function Home() {
  const { isTutorialMode, tutorLayout, schematicWidthPct, tutorPanelWidth, setSchematicWidthPct, setTutorPanelWidth, requestCircuitLoad, setTutorLayout, circuitGraph } = useCircuitStore()
  const [isDragging, setIsDragging] = useState(false)
  const [isTutorDragging, setIsTutorDragging] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isCompiling, setIsCompiling] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCompiling(false)
    }, 5000) // Exactly 5 seconds
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const seen = window.localStorage.getItem('circuitsathi_seen_onboarding') === 'true'
    if (!seen && circuitGraph.components.length === 0) {
      setShowOnboarding(true)
    }
  }, [circuitGraph.components.length])

  const dismissOnboarding = () => {
    window.localStorage.setItem('circuitsathi_seen_onboarding', 'true')
    setShowOnboarding(false)
  }

  const startDemo = () => {
    requestCircuitLoad(DEMO_CIRCUITS[0].graph)
    setTutorLayout('bottom')
    dismissOnboarding()
  }

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth
      // Subtract left sidebar or adjustments if there were any, but window width is fine here.
      let pct = (e.clientX / w) * 100
      if (pct < 10) pct = 10
      if (pct > 90) pct = 90
      setSchematicWidthPct(pct)
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, setSchematicWidthPct])

  useEffect(() => {
    if (!isTutorDragging) return
    const handleTutorResize = (e: MouseEvent) => {
      const maxWidth = Math.min(window.innerWidth * 0.5, 620)
      const minWidth = 320
      const width = Math.max(minWidth, Math.min(maxWidth, window.innerWidth - e.clientX))
      setTutorPanelWidth(width)
    }
    const handleTutorUp = () => setIsTutorDragging(false)
    window.addEventListener('mousemove', handleTutorResize)
    window.addEventListener('mouseup', handleTutorUp)
    return () => {
      window.removeEventListener('mousemove', handleTutorResize)
      window.removeEventListener('mouseup', handleTutorUp)
    }
  }, [isTutorDragging, setTutorPanelWidth])

  return (
    <div className={`flex min-h-screen flex-col text-white bg-[#050810] selection:bg-amber-400/30 ${isDragging ? 'select-none cursor-col-resize' : ''}`}>
      {/* 1. TOP BAR - Fixed Height */}
      <header className="flex-shrink-0">
        <TopNav />
      </header>

      {/* 2. DYNAMIC WORKSPACE */}
      <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-visible" style={{ '--pct': schematicWidthPct } as any}>
        
        {/* Main Content: Labs & Bottom Tutor */}
        <div className="flex flex-1 min-h-0 flex-col transition-all duration-500 overflow-visible">
          {tutorLayout === 'top' && (
            <section className="flex-shrink-0 h-[320px] w-full overflow-hidden rounded-b-3xl border-b border-white/10 bg-[#080c16]/95 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-3xl">
              <div className="h-full overflow-y-auto custom-scrollbar p-3">
                <TutorPanel variant="docked" />
              </div>
            </section>
          )}

          <main className="flex flex-1 min-h-0 flex-col gap-3 p-3 lg:min-h-0 lg:flex-row overflow-hidden">
            {/* Schematic Editor */}
            <section 
              style={{ flexBasis: `var(--desk-w)` } as any}
              className="lg:[--desk-w:calc(var(--pct)*1%)] flex h-[42vh] w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out lg:h-auto lg:w-auto"
            >
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <h2 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">Schematic Editor</h2>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-500/5 border border-slate-500/20">
                  <span className="text-[9px] font-mono text-slate-400 tracking-widest uppercase">Build</span>
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <SchematicBuilder />
              </div>
            </section>

            {/* Draggable Splitter - Enhanced for better UX */}
            <div 
              className="hidden lg:flex w-1.5 flex-col justify-center items-center cursor-col-resize hover:bg-amber-400/30 active:bg-amber-400/50 rounded-full transition-colors z-50 group relative"
              onMouseDown={(e) => { e.preventDefault(); setIsDragging(true) }}
              title="Drag to resize"
            >
               <div className={`absolute w-8 h-12 rounded-full transition-all ${isDragging ? 'bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.8)]' : 'bg-slate-700 group-hover:bg-amber-400/80'}`} />
            </div>

            {/* Simulation View */}
            <section 
              style={{ flexBasis: `var(--desk-w)` } as any}
              className="lg:[--desk-w:calc((100-var(--pct))*1%-12px)] flex h-[42vh] w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out lg:h-auto lg:w-auto"
            >
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-[10px] font-bold text-amber-400/80 tracking-[0.2em] uppercase">Simulation Engine</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[9px] font-mono text-amber-300/80 tracking-widest uppercase">Live</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <QuestView />
                <VoiceAgent />
              </div>
            </section>
          </main>

          {/* Bottom AI Tutor (if active) - Improved layout */}
          {tutorLayout === 'bottom' && (
            <footer className={`${isTutorialMode ? 'h-[320px]' : 'h-[280px]'} relative flex-shrink-0 border-t border-white/10 bg-[#080c16]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] backdrop-blur-3xl z-[60] max-sm:h-[220px] overflow-hidden`}>
              <div className="h-full overflow-y-auto custom-scrollbar">
                <TutorPanel variant="docked" />
              </div>
            </footer>
          )}
        </div>

        {/* Right AI Tutor (if active) - Improved layout */}
        {tutorLayout === 'right' && (
          <>
            <div 
              className="hidden lg:flex w-1.5 flex-col justify-center items-center cursor-col-resize hover:bg-amber-400/30 active:bg-amber-400/50 rounded-full transition-colors z-50 group relative"
              onMouseDown={(e) => { e.preventDefault(); setIsTutorDragging(true) }}
              title="Drag to resize tutor panel"
            >
              <div className="absolute w-8 h-12 rounded-full bg-slate-700 group-hover:bg-amber-400/80" />
            </div>

            <aside
              style={{ width: tutorPanelWidth }}
              className="relative flex-shrink-0 border-l border-white/10 bg-[#080c16]/95 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] backdrop-blur-3xl z-[60] max-sm:w-full max-sm:border-l-0 max-sm:border-t overflow-hidden"
            >
              <div className="h-full overflow-y-auto custom-scrollbar">
                <TutorPanel variant="docked" />
              </div>
            </aside>
          </>
        )}
        
      </div>

      {isCompiling && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0b1426] overflow-hidden">
          {/* Scanline Effect Overlay */}
          <div className="scanline-overlay" />
          <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.5)] opacity-50 animate-[scanline_3s_linear_infinite]" />

          <div className="relative z-10 flex flex-col items-center">
            {/* EXTRA LARGE LOGO IN WHITE ROUNDED SQUARE BLOCK */}
            <div className="relative mb-16 flex items-center justify-center animate-iris-in">
              <div className="animate-float p-8 sm:p-12 bg-white rounded-[40px] sm:rounded-[80px] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                <img 
                  src="/logo.png" 
                  alt="Circuit Sathi Logo" 
                  className="relative z-20 w-48 h-48 sm:w-[380px] sm:h-[380px] object-contain" 
                />
              </div>
            </div>

            <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-1000 delay-500">
              <div className="flex gap-2 mb-8">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div 
                    key={i}
                    className="h-1 w-10 bg-white/20 rounded-full overflow-hidden relative"
                  >
                    <div 
                      className="absolute inset-0 bg-white shadow-[0_0_10px_#fff]"
                      style={{ animation: `pulse 1.5s infinite ${i * 0.1}s` }}
                    />
                  </div>
                ))}
              </div>

              <div className="font-['VT323'] text-3xl text-white/80 tracking-[0.6em] uppercase flex items-center gap-4">
                <span className="w-8 h-px bg-white/20" />
                Initializing Circuit Ecosystem
                <span className="w-8 h-px bg-white/20" />
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-12 right-12 font-['VT323'] text-cyan-500/40 text-sm tracking-[0.3em] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            V2.0.0-PRO // ENCRYPTED_BOOT_SEQUENCE
          </div>
          
          <div className="absolute bottom-12 left-12 font-['VT323'] text-slate-700 text-[10px] tracking-widest uppercase">
            &copy; 2026 Circuit Sathi Systems // All Rights Reserved
          </div>
        </div>
      )}

      {showOnboarding && !isCompiling && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md">
          <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#08101d] shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">
                  Start here
                </div>
                <h2 className="max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Welcome. You do not need to learn every control at once.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
                  The fastest path is simple: load a demo circuit, inspect the simulation, then start editing from the palette on the left.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { title: '1. Load a demo', text: 'Start with a working circuit so the UI immediately makes sense.' },
                    { title: '2. Drag parts', text: 'Pull batteries, resistors, and LEDs from the left palette onto the canvas.' },
                    { title: '3. Ask the tutor', text: 'Use the tutor at the bottom for guided help and explanations.' },
                  ].map((step) => (
                    <div key={step.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/90">{step.title}</div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">{step.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={startDemo}
                    className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-amber-300"
                  >
                    Start with example circuit
                  </button>
                  <button
                    onClick={() => { setTutorLayout('bottom'); dismissOnboarding() }}
                    className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                  >
                    Open tutor and continue
                  </button>
                  <button
                    onClick={dismissOnboarding}
                    className="rounded-xl border border-transparent px-5 py-3 text-sm font-bold text-slate-400 transition-colors hover:text-white"
                  >
                    Skip tips
                  </button>
                </div>
              </div>

              <div className="border-t border-white/8 bg-[#060b14] p-6 sm:p-8 lg:border-l lg:border-t-0">
                <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">What to expect</div>
                  <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
                    <p>Left side = parts library. Drag components into the schematic.</p>
                    <p>Right side = live simulation. It updates as your circuit changes.</p>
                    <p>Bottom panel = AI tutor. It explains what the circuit is doing in plain language.</p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
                  <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Recommended first action</div>
                  <div className="mt-3 text-lg font-semibold text-white">Use the example circuit</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">It gives you a working reference so the palette, canvas, and tutor all make sense together.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
