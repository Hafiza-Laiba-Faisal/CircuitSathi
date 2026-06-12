'use client'

import { memo } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import type { CanvasStatus } from '../store/circuitStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanvasToolbarProps {
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onExport: () => void
  onSimulate: () => void
  onSave: () => void
  canUndo: boolean
  canRedo: boolean
}

// ─── Status pill ─────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  bg: string
  text: string
  pulse?: boolean
}

const STATUS_MAP: Record<CanvasStatus, StatusConfig> = {
  idle: { label: 'Ready', bg: '#374151', text: '#9ca3af' },
  drawing: { label: 'Drawing...', bg: '#1e3a5f', text: '#60a5fa' },
  simulating: { label: 'Simulating...', bg: '#451a03', text: '#fbbf24', pulse: true },
  updated: { label: 'Quest updated!', bg: '#14532d', text: '#4ade80' },
  incomplete: { label: 'Circuit incomplete', bg: '#431407', text: '#fb923c' },
  fault: { label: 'Fault detected', bg: '#450a0a', text: '#f87171' },
}

// ─── Icon buttons ────────────────────────────────────────────────────────────

interface IconButtonProps {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'primary' | 'success'
}

function IconButton({ onClick, disabled, title, children, variant = 'default' }: IconButtonProps) {
  const colors = {
    default: { bg: '#1f2937', hover: '#374151', text: '#d1d5db', border: '#374151' },
    danger: { bg: '#1f2937', hover: '#3f1414', text: '#f87171', border: '#374151' },
    primary: { bg: '#1e3a5f', hover: '#1d4ed8', text: '#93c5fd', border: '#1d4ed8' },
    success: { bg: '#14532d', hover: '#15803d', text: '#4ade80', border: '#166534' },
  }[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: disabled ? '#111827' : colors.bg,
        border: `1px solid ${disabled ? '#1f2937' : colors.border}`,
        borderRadius: 5,
        color: disabled ? '#4b5563' : colors.text,
        fontSize: 11,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s ease',
        fontFamily: 'monospace',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = colors.hover
      }}
      onMouseLeave={e => {
        if (!disabled) e.currentTarget.style.background = colors.bg
      }}
    >
      {children}
    </button>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function CanvasToolbar({
  onUndo,
  onRedo,
  onClear,
  onExport,
  onSimulate,
  onSave,
  canUndo,
  canRedo,
}: CanvasToolbarProps) {
  const canvasStatus = useCircuitStore(s => s.canvasStatus)
  const statusCfg = STATUS_MAP[canvasStatus]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 10px',
        background: '#0f172a',
        borderBottom: '1px solid #1f2937',
        height: 36,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Left: Undo / Redo */}
      <div style={{ display: 'flex', gap: 4 }}>
        <IconButton onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          {/* Undo icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 7v6h6" />
            <path d="M3 13C5 8 9.5 5 15 5c5.5 0 9 3.5 9 9s-3.5 9-9 9" />
          </svg>
          <span>Undo</span>
        </IconButton>
        <IconButton onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          {/* Redo icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 7v6h-6" />
            <path d="M21 13C19 8 14.5 5 9 5c-5.5 0-9 3.5-9 9s3.5 9 9 9" />
          </svg>
          <span>Redo</span>
        </IconButton>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: '#374151' }} />

      {/* Center: Status pill */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 10px',
            background: statusCfg.bg,
            color: statusCfg.text,
            borderRadius: 12,
            fontSize: 10,
            fontFamily: 'monospace',
            fontWeight: 600,
            letterSpacing: '0.03em',
            animation: statusCfg.pulse ? 'toolbarPulse 1s ease-in-out infinite' : undefined,
            transition: 'all 0.3s ease',
          }}
        >
          {/* Status dot */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusCfg.text,
              display: 'inline-block',
            }}
          />
          {statusCfg.label}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: '#374151' }} />

      {/* Right: action buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        <IconButton onClick={onClear} title="Clear canvas" variant="danger">
          {/* Trash icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          <span>Clear</span>
        </IconButton>

        <IconButton onClick={onExport} title="Export as JSON">
          {/* Download icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>Export</span>
        </IconButton>

        <IconButton onClick={onSimulate} title="Run simulation" variant="primary">
          {/* Play icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Simulate</span>
        </IconButton>

        <IconButton onClick={onSave} title="Save to MongoDB" variant="success">
          {/* Save icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>Save</span>
        </IconButton>
      </div>

      <style>{`
        @keyframes toolbarPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default memo(CanvasToolbar)
