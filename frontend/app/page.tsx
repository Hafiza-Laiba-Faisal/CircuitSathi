'use client'

import dynamic from 'next/dynamic'
import { useCircuitStore } from '../store/circuitStore'
import TopNav from '../components/TopNav'
import SchematicBuilder from '../components/SchematicBuilder'

const QuestView = dynamic(() => import('../components/QuestView'), { ssr: false })
const VoiceAgent = dynamic(() => import('../components/VoiceAgent'), { ssr: false })
const TutorPanel = dynamic(() => import('../components/TutorPanel'), { ssr: false })

export default function Home() {
  const { isTutorialMode } = useCircuitStore()

  return (
    <div className="flex flex-col h-screen text-white overflow-hidden bg-[#050810] selection:bg-amber-400/30">
      {/* 1. TOP BAR - Fixed Height */}
      <header className="h-[72px] flex-shrink-0">
        <TopNav />
      </header>

      {/* 2. MIDDLE SECTION: SPLIT EDITOR & SIM (Flexible Growth) */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left: Schematic Editor */}
        <section className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] relative group border border-white/5 bg-black/40">
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

        {/* Right: Simulation View */}
        <section className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] relative border border-white/5 bg-black/40">
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

      {/* 3. BOTTOM SECTION: AI SATHI LEARNING CONSOLE (Adaptive Height) */}
      <footer className={`${isTutorialMode ? 'h-[32%]' : 'h-[250px]'} flex-shrink-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] border-t border-white/10 bg-[#080c16]/95 backdrop-blur-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] z-[60]`}>
        <TutorPanel />
      </footer>
    </div>
  )
}
