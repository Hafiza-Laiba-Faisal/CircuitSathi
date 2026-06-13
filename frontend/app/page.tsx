'use client'

import dynamic from 'next/dynamic'
import { useCircuitStore } from '../store/circuitStore'
import TopNav from '../components/TopNav'
import SchematicBuilder from '../components/SchematicBuilder'

const QuestView = dynamic(() => import('../components/QuestView'), { ssr: false })
const VoiceAgent = dynamic(() => import('../components/VoiceAgent'), { ssr: false })
const TutorPanel = dynamic(() => import('../components/TutorPanel'), { ssr: false })

export default function Home() {
  const { activeMode, isTutorialMode } = useCircuitStore()

  return (
    <div className="flex flex-col h-screen text-white overflow-hidden bg-[#0a0e1a]">
      {/* 1. TOP BAR */}
      <TopNav />

      {/* 2. MIDDLE SECTION: SPLIT EDITOR & SIM */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Left: Schematic Editor */}
        <section className="w-1/2 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl relative group border border-white/5 bg-black/20">
          <div className="px-5 py-3 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">Schematic Editor</h2>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <SchematicBuilder />
          </div>
        </section>

        {/* Right: Simulation View */}
        <section className="w-1/2 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl relative border border-white/5 bg-black/20">
          <div className="px-5 py-3 border-b border-white/5 bg-white/[0.03] flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-amber-400/80 tracking-[0.2em] uppercase">Simulation View</h2>
            <div className="text-[9px] font-mono text-slate-500">60 FPS | REAL-TIME</div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <QuestView />
            <VoiceAgent />
          </div>
        </section>
      </main>

      {/* 3. BOTTOM SECTION: AI LEARNING CONSOLE */}
      <footer className={`h-[35%] min-h-[250px] transition-all duration-500 ease-in-out border-t border-white/10 bg-[#0c1222] shadow-[0_-10px_50px_rgba(0,0,0,0.5)] z-40 ${isTutorialMode ? 'opacity-100 translate-y-0' : 'opacity-90'}`}>
        <TutorPanel />
      </footer>
    </div>
  )
}
