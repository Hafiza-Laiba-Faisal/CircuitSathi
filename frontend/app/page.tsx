'use client'

import dynamic from 'next/dynamic'
import { useCircuitStore } from '../store/circuitStore'
import TopNav from '../components/TopNav'
import SchematicBuilder from '../components/SchematicBuilder'

const QuestView = dynamic(() => import('../components/QuestView'), { ssr: false })
const VoiceAgent = dynamic(() => import('../components/VoiceAgent'), { ssr: false })

export default function Home() {
  const { activeMode, simulationState } = useCircuitStore()

  return (
    <div className="flex flex-col h-screen text-white overflow-hidden" style={{ background: '#0a0e1a' }}>
      {/* Top Navigation */}
      <TopNav />

      {/* Main Two-Panel Layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Panel — Schematic Builder (30%) */}
        <section className="w-[30%] flex flex-col" style={{ borderRight: '2px solid #1e293b' }}>
          <div style={{
            padding: '6px 12px',
            background: '#0f172a',
            borderBottom: '2px solid #1e293b',
          }}>
            <h2 style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              color: '#64748b',
              letterSpacing: '0.1em',
            }}>
              🔧 SCHEMATIC BUILDER
            </h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <SchematicBuilder />
          </div>
        </section>

        {/* Right Panel — Quest View (70%) */}
        <section className="w-[70%] flex flex-col relative">
          <div style={{
            padding: '6px 12px',
            background: '#0f172a',
            borderBottom: '2px solid #1e293b',
          }}>
            <h2 style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              color: '#64748b',
              letterSpacing: '0.1em',
            }}>
              🗺️ QUEST WORLD
            </h2>
          </div>
          <div className="flex-1 overflow-hidden relative" style={{ background: '#0F0E17' }}>
            <QuestView />
            <VoiceAgent />
          </div>
        </section>
      </main>

      {/* Bottom Status Bar */}
      <footer style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0a0e1a',
        borderTop: '2px solid #1e293b',
        padding: '4px 16px',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 7,
        color: '#475569',
        boxShadow: '0 -2px 0 #000',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e', display: 'inline-block',
            boxShadow: '0 0 4px #22c55e',
          }} />
          <span>ONLINE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>
            MODE:{' '}
            <span style={{ color: '#ffd700', textTransform: 'uppercase' }}>
              {activeMode}
            </span>
          </span>
          <span style={{ color: '#1e293b' }}>│</span>
          <span style={{ color: simulationState?.faults?.length ? '#ef4444' : '#22c55e' }}>
            {simulationState?.faults?.length
              ? `${simulationState.faults.length} FAULT${simulationState.faults.length > 1 ? 'S' : ''}`
              : 'ALL CLEAR'}
          </span>
        </div>
      </footer>
    </div>
  )
}
