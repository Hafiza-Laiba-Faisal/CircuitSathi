'use client'

import dynamic from 'next/dynamic'
import { useCircuitStore } from '../store/circuitStore'
import TopNav from '../components/TopNav'
import SchematicBuilder from '../components/SchematicBuilder'

const QuestView = dynamic(() => import('../components/QuestView'), { ssr: false })
const VoiceAgent = dynamic(() => import('../components/VoiceAgent'), { ssr: false })
const TutorPanel = dynamic(() => import('../components/TutorPanel'), { ssr: false })

export default function Home() {
  const { activeMode, simulationState, isTutorialMode } = useCircuitStore()

  return (
    <div className="flex flex-col h-screen text-white overflow-hidden bg-[#0a0e1a]">
      {/* Top Navigation */}
      <TopNav />

      {/* AI Tutor Panel (Overlay when active) */}
      <TutorPanel />

      {/* Main Two-Panel Layout */}
      <main className="flex flex-1 overflow-hidden p-3 gap-3">
        {/* Left Panel — Schematic Builder (30%) */}
        <section className="w-[30%] flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl relative group">
          <div className="px-5 py-4 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold text-slate-400 tracking-[0.15em] uppercase">
                Schematic Editor
              </h2>
              <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-wider">Drag & Drop Lab</p>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-800" />
              <span className="w-2 h-2 rounded-full bg-slate-800" />
              <span className="w-2 h-2 rounded-full bg-slate-800" />
            </div>
          </div>
          <div className="flex-1 overflow-hidden bg-black/20">
            <SchematicBuilder />
          </div>
        </section>

        {/* Right Panel — Quest View (70%) */}
        <section className="w-[70%] flex flex-col relative glass-panel rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-5 py-4 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-amber-400 rounded-full" />
              <div>
                <h2 className="text-xs font-bold text-slate-200 tracking-[0.15em] uppercase">
                  Quest Simulation
                </h2>
                <p className="text-[10px] text-amber-400/70 mt-1 uppercase tracking-wider">Real-time Visualization Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
              <span>FPS: 60</span>
              <span className="text-slate-800">|</span>
              <span className="text-emerald-500">Render: PixiJS v8</span>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <QuestView />
            
            {/* Overlay Elements can go here if needed, but they are already inside QuestView */}
            <div className="absolute top-0 right-0 w-48 h-full pointer-events-none bg-gradient-to-l from-black/20 to-transparent" />
            
            <VoiceAgent />
          </div>
        </section>
      </main>

      {/* Bottom Status Bar */}
      <footer className="flex items-center justify-between bg-[#0a0e1a]/80 backdrop-blur-xl border-t border-white/5 px-6 py-2 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <span className="text-[10px] font-bold tracking-widest text-emerald-500 uppercase">System Ready</span>
          </div>
          
          <div className="flex items-center gap-4 text-[10px] font-medium text-slate-500 tracking-wider">
            <span>Uptime: 0h 42m</span>
            <span className="w-1 h-1 rounded-full bg-slate-800" />
            <span>Region: EDU-US-01</span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Active Mode</span>
             <span className="px-3 py-1 rounded bg-amber-400/10 border border-amber-400/20 text-amber-400 font-bold text-[9px] uppercase tracking-widest">
               {activeMode}
             </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Diagnostic</span>
            <span className={`px-3 py-1 rounded font-bold text-[9px] uppercase tracking-widest border transition-all ${
              simulationState?.faults?.length 
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
            }`}>
              {simulationState?.faults?.length
                ? `${simulationState.faults.length} Critical Fault${simulationState.faults.length > 1 ? 's' : ''}`
                : 'Circuit Optimized'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
