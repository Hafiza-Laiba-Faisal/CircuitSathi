'use client'

import { useState } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import { saveProject, fetchProjects } from '../lib/api'
import { CircuitProject } from '../../shared/types'

type Mode = 'build' | 'upload' | 'learn' | 'debug' | 'challenge'

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: 'build', label: 'Manual Build', icon: '⚡' },
  { id: 'upload', label: 'AI Upload', icon: '📤' },
]

export default function TopNav() {
  const {
    activeMode,
    setActiveMode,
    circuitGraph,
    simulationState,
    requestCircuitLoad,
    setProjectMeta,
    clearCircuit,
    projectName,
    tutorLayout,
    setTutorLayout,
    schematicWidthPct,
    setSchematicWidthPct,
  } = useCircuitStore()

  const [saving, setSaving] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [projects, setProjects] = useState<CircuitProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  const handleSave = async () => {
    const name = window.prompt('Project name:', projectName || 'My Circuit')
    if (!name) return
    setSaving(true)
    try {
      const saved = await saveProject(name, circuitGraph, simulationState)
      setProjectMeta(saved._id ?? null, name)
    } finally {
      setSaving(false)
    }
  }

  const handleLoadToggle = async () => {
    if (loadOpen) { setLoadOpen(false); return }
    setLoadingProjects(true)
    try {
      const list = await fetchProjects()
      setProjects(list)
      setLoadOpen(true)
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleLoadProject = (proj: CircuitProject) => {
    requestCircuitLoad(proj.graph)
    setProjectMeta(proj._id ?? null, proj.name)
    setLoadOpen(false)
  }

  return (
    <nav className="relative flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur-md z-50">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 to-amber-300 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)]">
          <span className="text-2xl">⚡</span>
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
            CIRCUIT <span className="text-amber-400">SATHI</span>
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">AI x STEM Education Platform</p>
        </div>
      </div>

      {/* Layout Controls */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-6">
        
        {/* Tutor Position */}
        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest px-3 font-bold">Tutor</span>
          {['bottom', 'right', 'hidden'].map((layout) => (
            <button
              key={layout}
              onClick={() => setTutorLayout(layout as any)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                tutorLayout === layout 
                ? 'bg-amber-400 text-black shadow-[0_0_15px_rgba(251,191,36,0.2)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {layout}
            </button>
          ))}
        </div>

        {/* Schematic Width */}
        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest px-3 font-bold">Schematic</span>
          {[30, 50, 70].map((pct) => (
            <button
              key={pct}
              onClick={() => setSchematicWidthPct(pct)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                schematicWidthPct === pct 
                ? 'bg-slate-700 text-white' 
                : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={clearCircuit}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleLoadToggle}
          disabled={loadingProjects}
          className="px-5 py-2 text-sm font-semibold rounded-lg bg-slate-800 border border-white/10 hover:border-white/20 transition-all"
        >
          {loadingProjects ? '...' : 'Open Project'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || circuitGraph.components.length === 0}
          className="px-5 py-2 text-sm font-semibold rounded-lg bg-white text-black hover:bg-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Work'}
        </button>
      </div>

      {/* Project Dropdown */}
      {loadOpen && (
        <div className="absolute right-6 top-full mt-2 w-80 glass-panel rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-white/5 bg-white/5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved Projects</h3>
          </div>
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm italic">No projects yet</div>
            ) : (
              projects.map(proj => (
                <button
                  key={proj._id}
                  onClick={() => handleLoadProject(proj)}
                  className="w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors uppercase text-xs tracking-wider">
                      {proj.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex gap-2">
                    <span>{proj.graph.components.length} components</span>
                    <span>•</span>
                    <span className="text-emerald-500/80">V {proj.graph.components.find(c => c.type === 'battery')?.value ?? 0}V</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
