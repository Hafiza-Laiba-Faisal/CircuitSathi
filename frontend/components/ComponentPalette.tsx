'use client'

import { memo, useState } from 'react'

// ─── Component catalogue ─────────────────────────────────────────────────────

export type CanvasComponentType =
  | 'battery'
  | 'voltage_source'
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'led'
  | 'diode'
  | 'switch'
  | 'ground'
  | 'motor'
  | 'current_source'
  | 'wire'

export const COMPONENT_CONFIGS: Record<
  CanvasComponentType,
  {
    label: string
    rpgName: string
    biomeColor: string
    defaultValue?: number
    unit?: string
  }
> = {
  battery: { label: 'Battery', rpgName: 'Spawn Throne', biomeColor: '#f59e0b', defaultValue: 9, unit: 'V' },
  voltage_source: { label: 'V Source', rpgName: 'Spawn Throne', biomeColor: '#f59e0b', defaultValue: 5, unit: 'V' },
  resistor: { label: 'Resistor', rpgName: 'Swamp', biomeColor: '#a16207', defaultValue: 220, unit: 'Ω' },
  capacitor: { label: 'Capacitor', rpgName: 'Dungeon', biomeColor: '#4338ca', defaultValue: 100, unit: 'µF' },
  inductor: { label: 'Inductor', rpgName: 'Cave', biomeColor: '#0369a1', defaultValue: 10, unit: 'mH' },
  led: { label: 'LED', rpgName: 'Bonfire', biomeColor: '#f97316' },
  diode: { label: 'Diode', rpgName: 'Gate', biomeColor: '#f97316' },
  switch: { label: 'Switch', rpgName: 'Drawbridge', biomeColor: '#6b7280', defaultValue: 0 },
  ground: { label: 'Ground', rpgName: 'Exit Portal', biomeColor: '#7c3aed' },
  motor: { label: 'Motor', rpgName: 'Factory', biomeColor: '#8b5cf6' },
  current_source: { label: 'I Source', rpgName: 'River', biomeColor: '#ec4899', defaultValue: 0.1, unit: 'A' },
  wire: { label: 'Junction', rpgName: 'Crossroads', biomeColor: '#22c55e' },
}

const PALETTE_ORDER: CanvasComponentType[] = [
  'voltage_source',
  'battery',
  'resistor',
  'capacitor',
  'inductor',
  'led',
  'diode',
  'current_source',
  'switch',
  'ground',
  'motor',
  'wire',
]

// ─── Inline SVG symbols (32×32 viewBox) ─────────────────────────────────────

function PaletteSymbol({ type, color }: { type: CanvasComponentType; color: string }) {
  const props = {
    viewBox: '0 0 32 32',
    width: 32,
    height: 32,
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.8,
  }

  switch (type) {
    case 'battery':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="8" y2="16" />
          <line x1="8" y1="11" x2="8" y2="21" strokeWidth={2.5} />
          <line x1="12" y1="13" x2="12" y2="19" />
          <line x1="16" y1="11" x2="16" y2="21" strokeWidth={2.5} />
          <line x1="20" y1="13" x2="20" y2="19" />
          <line x1="24" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'voltage_source':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="9" y2="16" />
          <circle cx="16" cy="16" r="7" />
          <text x="16" y="20" fontSize="8" fill={color} stroke="none" textAnchor="middle" fontWeight="bold">V</text>
          <line x1="23" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'resistor':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="7" y2="16" />
          <rect x="7" y="12" width="18" height="8" rx="1.5" />
          <line x1="25" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'capacitor':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="13" y2="16" />
          <line x1="13" y1="9" x2="13" y2="23" strokeWidth={2.5} />
          <line x1="19" y1="9" x2="19" y2="23" strokeWidth={2.5} />
          <line x1="19" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'inductor':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="6" y2="16" />
          <path d="M6 16 Q9 10 12 16 Q15 10 18 16 Q21 10 24 16 Q27 10 30 16" fill="none" />
        </svg>
      )
    case 'led':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="9" y2="16" />
          <polygon points="9,10 9,22 20,16" />
          <line x1="20" y1="10" x2="20" y2="22" />
          <line x1="20" y1="16" x2="29" y2="16" />
          <line x1="22" y1="8" x2="26" y2="4" strokeWidth={1.2} />
          <line x1="25" y1="11" x2="29" y2="7" strokeWidth={1.2} />
        </svg>
      )
    case 'diode':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="9" y2="16" />
          <polygon points="9,10 9,22 20,16" />
          <line x1="20" y1="10" x2="20" y2="22" />
          <line x1="20" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'switch':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="10" y2="16" />
          <circle cx="10" cy="16" r="1.5" fill={color} />
          <circle cx="22" cy="16" r="1.5" fill={color} />
          {/* Open by default */}
          <line x1="10" y1="16" x2="21" y2="10" />
          <line x1="22" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'ground':
      return (
        <svg {...props}>
          <line x1="16" y1="3" x2="16" y2="13" />
          <line x1="8" y1="13" x2="24" y2="13" strokeWidth={2.5} />
          <line x1="11" y1="17" x2="21" y2="17" />
          <line x1="14" y1="21" x2="18" y2="21" />
          <line x1="15.5" y1="25" x2="16.5" y2="25" />
        </svg>
      )
    case 'motor':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="9" y2="16" />
          <circle cx="16" cy="16" r="7" />
          <text x="16" y="20" fontSize="8" fill={color} stroke="none" textAnchor="middle" fontWeight="bold">M</text>
          <line x1="23" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'current_source':
      return (
        <svg {...props}>
          <line x1="3" y1="16" x2="9" y2="16" />
          <circle cx="16" cy="16" r="7" />
          <line x1="13" y1="16" x2="19" y2="16" />
          <polyline points="16,12 20,16 16,20" fill="none" />
          <line x1="23" y1="16" x2="29" y2="16" />
        </svg>
      )
    case 'wire':
    default:
      return (
        <svg {...props}>
          <circle cx="16" cy="16" r="4" fill={color} />
          <line x1="3" y1="16" x2="12" y2="16" />
          <line x1="20" y1="16" x2="29" y2="16" />
        </svg>
      )
  }
}

// ─── Palette Item ─────────────────────────────────────────────────────────────

interface PaletteItemProps {
  type: CanvasComponentType
}

function PaletteItem({ type }: PaletteItemProps) {
  const config = COMPONENT_CONFIGS[type]
  const [hovered, setHovered] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/canvascomponent', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        draggable
        onDragStart={handleDragStart}
        onMouseEnter={() => { setHovered(true); setShowTooltip(true) }}
        onMouseLeave={() => { setHovered(false); setShowTooltip(false) }}
        style={{
          width: 48,
          padding: '6px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          cursor: 'grab',
          borderRadius: 6,
          border: `1px solid ${hovered ? config.biomeColor : '#374151'}`,
          background: hovered ? `${config.biomeColor}18` : '#1f2937',
          transition: 'all 0.15s ease',
          filter: hovered ? 'brightness(1.15)' : undefined,
          userSelect: 'none',
        }}
        title={`${config.label} = ${config.rpgName}`}
      >
        <PaletteSymbol type={type} color={hovered ? config.biomeColor : '#6b7280'} />
        <span
          style={{
            fontSize: 8,
            color: hovered ? config.biomeColor : '#9ca3af',
            fontFamily: 'monospace',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: 44,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {config.label}
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            left: 54,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#111827',
            border: `1px solid ${config.biomeColor}`,
            borderRadius: 6,
            padding: '4px 8px',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 10, color: '#f9fafb', fontWeight: 600 }}>{config.label}</div>
          <div style={{ fontSize: 9, color: config.biomeColor, marginTop: 1 }}>
            {config.rpgName}
          </div>
          {config.defaultValue !== undefined && (
            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>
              Default: {config.defaultValue}{config.unit ?? ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Palette ─────────────────────────────────────────────────────────────────

function ComponentPalette() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 4px',
        background: '#111827',
        borderRight: '1px solid #374151',
        overflowY: 'auto',
        alignItems: 'center',
        width: 56,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          fontSize: 8,
          color: '#4b5563',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 2,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        Parts
      </div>
      {PALETTE_ORDER.map(type => (
        <PaletteItem key={type} type={type} />
      ))}
    </div>
  )
}

export default memo(ComponentPalette)
