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
  const { isTutorialMode, tutorLayout, schematicWidthPct, setSchematicWidthPct, requestCircuitLoad, setTutorLayout, circuitGraph } = useCircuitStore()
  const [isDragging, setIsDragging] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

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

  return (
    <div className={`flex min-h-screen flex-col text-white overflow-y-auto overflow-x-hidden bg-[#050810] selection:bg-amber-400/30 ${isDragging ? 'select-none cursor-col-resize' : ''}`}>
      {/* 1. TOP BAR - Fixed Height */}
      <header className="flex-shrink-0">
        <TopNav />
      </header>

      {/* 2. DYNAMIC WORKSPACE */}
      <div className="flex flex-1 min-h-0 flex-col sm:flex-row" style={{ '--pct': schematicWidthPct } as any}>
        
        {/* Left/Middle Column: Labs & Bottom Tutor */}
        <div className="flex flex-1 min-h-0 flex-col transition-all duration-500">
          
          <main className="flex flex-1 min-h-0 flex-col gap-3 p-3 lg:min-h-[500px] lg:flex-row">
            {/* Schematic Editor */}
            <section 
              style={{ flexBasis: `var(--desk-w)` } as any}
              className="lg:[--desk-w:calc(var(--pct)*1%)] [--pct:50] flex h-[42vh] w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out lg:h-auto lg:w-auto"
            >
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <h2 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">Engineering Schematic</h2>
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <SchematicBuilder />
              </div>
            </section>

            {/* Draggable Splitter (Hidden on mobile) */}
            <div 
              className="hidden lg:flex w-3 flex-col justify-center items-center cursor-col-resize hover:bg-white/10 active:bg-white/20 rounded-full transition-colors z-50 group"
              onMouseDown={(e) => { e.preventDefault(); setIsDragging(true) }}
            >
               <div className={`w-1 h-12 rounded-full transition-colors ${isDragging ? 'bg-amber-400' : 'bg-slate-700 group-hover:bg-amber-400/50'}`} />
            </div>

            {/* Simulation View */}
            <section 
              style={{ flexBasis: `var(--desk-w)` } as any}
              className="lg:[--desk-w:calc((100-var(--pct))*1%-12px)] [--pct:50] flex h-[42vh] w-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-[0_0_50px_rgba(0,0,0,0.3)] transition-all duration-500 ease-in-out lg:h-auto lg:w-auto"
            >
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-[10px] font-bold text-amber-400/80 tracking-[0.2em] uppercase">Interactive Simulation</h2>
                </div>
                <div className="text-[9px] font-mono text-slate-600 tracking-widest uppercase">Live Engine Active</div>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <QuestView />
                <VoiceAgent />
              </div>
            </section>
          </main>

          {/* Bottom AI Tutor (if active) */}
          {tutorLayout === 'bottom' && (
            <footer className={`${isTutorialMode ? 'h-[320px]' : 'h-[250px]'} relative flex-shrink-0 overflow-hidden border-t border-white/10 bg-[#080c16]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] backdrop-blur-3xl z-[60] max-sm:h-[220px]`}>
              <div className="h-full overflow-y-auto custom-scrollbar">
                <TutorPanel variant="docked" />
              </div>
            </footer>
          )}
        </div>

        {/* Right AI Tutor (if active) */}
        {tutorLayout === 'right' && (
          <aside className={`${isTutorialMode ? 'w-[450px]' : 'w-[400px]'} relative flex-shrink-0 border-l border-white/10 bg-[#080c16]/95 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] backdrop-blur-3xl z-[60] max-sm:w-full max-sm:border-l-0 max-sm:border-t`}>
             <TutorPanel variant="docked" />
          </aside>
        )}
        
      </div>

      {showOnboarding && (
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
