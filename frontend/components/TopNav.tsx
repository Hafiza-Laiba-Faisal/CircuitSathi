'use client'

import { useState } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import { saveProject, fetchProjects } from '../lib/api'
import { CircuitProject } from '../../shared/types'

type Mode = 'build' | 'upload' | 'learn' | 'debug' | 'challenge'

const MODES: { id: Mode; label: string }[] = [
  { id: 'build', label: '⚡ Build' },
  { id: 'upload', label: '📤 Upload' },
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
    } catch (err) {
      console.error('Save failed:', err)
      window.alert('Failed to save — is the backend running?')
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
    } catch {
      window.alert('Failed to load projects — is the backend running?')
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
    <nav className="relative flex items-center justify-between text-white px-4 py-2"
      style={{
        background: '#0a0e1a',
        borderBottom: '2px solid #1e293b',
        boxShadow: '0 2px 0 #000',
      }}
    >
      <h1
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 12,
          color: '#ffd700',
          letterSpacing: '0.05em',
          textShadow: '2px 2px 0 #4a3500',
        }}
      >
        ⚡ GROUND WIRE
      </h1>

      {/* mode tabs */}
      <div className="flex gap-1">
        {MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => setActiveMode(mode.id)}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 8,
              padding: '6px 10px',
              border: activeMode === mode.id ? '2px solid #ffd700' : '2px solid #334155',
              borderRadius: 2,
              background: activeMode === mode.id ? '#1a1500' : '#0f172a',
              color: activeMode === mode.id ? '#ffd700' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s',
              textShadow: activeMode === mode.id ? '0 0 6px #ffd700' : 'none',
            }}
            onMouseEnter={e => {
              if (activeMode !== mode.id) {
                e.currentTarget.style.borderColor = '#64748b'
                e.currentTarget.style.color = '#e2e8f0'
              }
            }}
            onMouseLeave={e => {
              if (activeMode !== mode.id) {
                e.currentTarget.style.borderColor = '#334155'
                e.currentTarget.style.color = '#94a3b8'
              }
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* project actions */}
      <div className="flex items-center gap-1">
        {[
          { label: '🆕 New', onClick: clearCircuit, disabled: false },
          { label: '💾 Save', onClick: handleSave, disabled: saving || circuitGraph.components.length === 0 },
          { label: saving ? '⏳...' : '📂 Load', onClick: handleLoadToggle, disabled: loadingProjects },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.onClick}
            disabled={btn.disabled}
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 7,
              padding: '5px 8px',
              border: '2px solid #334155',
              borderRadius: 2,
              background: '#0f172a',
              color: btn.disabled ? '#475569' : '#94a3b8',
              cursor: btn.disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!btn.disabled) { e.currentTarget.style.color = '#ffd700'; e.currentTarget.style.borderColor = '#ffd700' } }}
            onMouseLeave={e => { e.currentTarget.style.color = btn.disabled ? '#475569' : '#94a3b8'; e.currentTarget.style.borderColor = '#334155' }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* load dropdown */}
      {loadOpen && (
        <div
          className="absolute right-4 top-full mt-1 w-72 z-50 max-h-64 overflow-y-auto"
          style={{
            background: '#0f172a',
            border: '2px solid #334155',
            borderRadius: 4,
            boxShadow: '4px 4px 0 rgba(0,0,0,0.5)',
          }}
        >
          {projects.length === 0 ? (
            <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: '#64748b', padding: 12, textAlign: 'center' }}>
              NO SAVED PROJECTS
            </p>
          ) : (
            projects.map(proj => (
              <button
                key={proj._id}
                onClick={() => handleLoadProject(proj)}
                className="w-full text-left transition-colors"
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #1e293b',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: '#e2e8f0' }}>
                  {proj.name}
                </span>
                <span style={{ display: 'block', fontFamily: "'VT323', monospace", fontSize: 14, color: '#64748b', marginTop: 2 }}>
                  {proj.graph.components.length} components &middot;{' '}
                  {new Date(proj.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </nav>
  )
}
