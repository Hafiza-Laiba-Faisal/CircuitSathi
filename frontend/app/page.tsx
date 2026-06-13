'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useCircuitStore } from '../store/circuitStore'
import TopNav from '../components/TopNav'
import SchematicBuilder from '../components/SchematicBuilder'

const QuestView = dynamic(() => import('../components/QuestView'), { ssr: false })
const VoiceAgent = dynamic(() => import('../components/VoiceAgent'), { ssr: false })
const TutorPanel = dynamic(() => import('../components/TutorPanel'), { ssr: false })

export default function Home() {
  const { isTutorialMode, tutorLayout, schematicWidthPct, setSchematicWidthPct } = useCircuitStore()
  const [isDragging, setIsDragging] = useState(false)

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
    <div className={`flex flex-col min-h-screen text-white overflow-y-auto overflow-x-hidden bg-[#050810] selection:bg-amber-400/30 ${isDragging ? 'select-none cursor-col-resize' : ''}`}>
      {/* 1. TOP BAR - Fixed Height */}
      <header className="h-[72px] flex-shrink-0">
        <TopNav />
      </header>

      {/* 2. DYNAMIC WORKSPACE */}
      <div className="flex flex-1 flex-col sm:flex-row">
        
        {/* Left/Middle Column: Labs & Bottom Tutor */}
        <div className="flex flex-col flex-1 transition-all duration-500">
          
          <main className="flex-1 flex p-3 gap-3 min-h-[500px]">
            {/* Schematic Editor */}
            <section 
              style={{ width: `${schematicWidthPct}%` }}
              className="flex flex-col glass-panel rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] relative group border border-white/5 bg-black/40 transition-all duration-500 ease-in-out"
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

            {/* Draggable Splitter */}
            <div 
              className="w-3 flex flex-col justify-center items-center cursor-col-resize hover:bg-white/10 active:bg-white/20 rounded-full transition-colors z-50 group"
              onMouseDown={(e) => { e.preventDefault(); setIsDragging(true) }}
            >
               <div className={`w-1 h-12 rounded-full transition-colors ${isDragging ? 'bg-amber-400' : 'bg-slate-700 group-hover:bg-amber-400/50'}`} />
            </div>

            {/* Simulation View */}
            <section 
              style={{ width: `calc(${100 - schematicWidthPct}% - 12px)` }}
              className="flex flex-col glass-panel rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.3)] relative border border-white/5 bg-black/40 transition-all duration-500 ease-in-out"
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
            <footer className={`${isTutorialMode ? 'h-[32%]' : 'h-[250px]'} flex-shrink-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] border-t border-white/10 bg-[#080c16]/95 backdrop-blur-3xl shadow-[0_-20px_60px_rgba(0,0,0,0.8)] z-[60]`}>
              <TutorPanel />
            </footer>
          )}
        </div>

        {/* Right AI Tutor (if active) */}
        {tutorLayout === 'right' && (
          <aside className={`${isTutorialMode ? 'w-[450px]' : 'w-[400px]'} flex-shrink-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] border-l border-white/10 bg-[#080c16]/95 backdrop-blur-3xl shadow-[-20px_0_60px_rgba(0,0,0,0.8)] z-[60]`}>
             <TutorPanel />
          </aside>
        )}
        
      </div>
    </div>
  )
}
