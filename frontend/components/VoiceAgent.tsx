'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useConversation } from '@elevenlabs/react'
import { useCircuitStore } from '../store/circuitStore'

const DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB' // ElevenLabs Adam voice
const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_8401kkrgjbe0ezsrrdefnawm3ymc'

export default function VoiceAgent() {
  const [apiKey, setApiKey] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [autoNarrate, setAutoNarrate] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)

  const { circuitGraph, simulationState, currentNarration } = useCircuitStore()

  // Load saved settings from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('elevenlabs_api_key') || ''
    const savedAutoNarrate = localStorage.getItem('elevenlabs_auto_narrate')
    setApiKey(savedKey)
    // Default to ON unless the user explicitly turned it off
    if (savedAutoNarrate !== null) setAutoNarrate(savedAutoNarrate === 'true')
    audioRef.current = new Audio()
    audioRef.current.onended = () => {
      setIsSpeaking(false)
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
        currentAudioUrlRef.current = null
      }
    }
  }, [])

  // Build circuit context string
  const buildContext = useCallback((): string => {
    const comps = circuitGraph.components
    if (comps.length === 0) {
      return 'The circuit is currently empty. The user is about to start building an electronic circuit simulation called "Ground Wire". You are an educational physics AI guide helping them understand electronics.'
    }

    const compList = comps.map(c => {
      const val = c.value !== undefined
        ? ` (${c.type === 'battery' ? c.value + 'V' : c.type === 'resistor' ? c.value + 'Ω' : c.type === 'capacitor' ? c.value + 'μF' : c.value})`
        : ''
      return `${c.label ?? c.type}${val}`
    }).join(', ')

    const faultList = simulationState?.faults.length
      ? simulationState.faults.map(f => f.message).join('; ')
      : 'No faults — circuit is healthy'

    const validStr = simulationState?.isValid
      ? 'The circuit is valid and operating correctly.'
      : 'The circuit has issues that need to be resolved.'

    const battery = comps.find(c => c.type === 'battery')
    const resistors = comps.filter(c => c.type === 'resistor')
    const rTotal = resistors.reduce((s, r) => s + (r.value ?? 0), 0)
    const current = (battery?.value && rTotal > 0) ? (battery.value / rTotal).toFixed(4) : null
    const physicsLine = current
      ? `\nCalculated series current: I = V/R = ${battery?.value}V / ${rTotal}Ω = ${current}A (${(parseFloat(current) * 1000).toFixed(1)}mA)`
      : ''

    return `You are an educational electronics physics guide in "Ground Wire" simulation game. The user is exploring a circuit containing: ${compList}. ${validStr} Circuit status: ${faultList}.${physicsLine}

Help the user understand the physics concepts behind their circuit. Explain Ohm's Law (V=IR), Kirchhoff's laws, power dissipation (P=IV=I²R), component behavior, and anything else they ask about. Be enthusiastic, educational, and relate concepts to the visual circuit they're building. Keep responses concise but accurate.`
  }, [circuitGraph, simulationState])

  // ─── ElevenLabs Conversational AI (WebRTC) ───────────────────────────────────
  // Track whether we need to send the initial context on first connect
  const sendInitialContextRef = useRef(false)
  const buildContextRef = useRef(buildContext)
  useEffect(() => { buildContextRef.current = buildContext }, [buildContext])

  const conversation = useConversation({
    onConnect: () => console.log('[GroundWire] Agent connected'),
    onDisconnect: () => console.log('[GroundWire] Agent disconnected'),
    onError: (err) => console.error('[GroundWire] Agent error:', err),
    onModeChange: (mode) => console.log('[GroundWire] Mode:', mode),
  })

  // Send initial circuit context once the connection is established
  useEffect(() => {
    if (conversation.status === 'connected' && sendInitialContextRef.current) {
      sendInitialContextRef.current = false
      const ctx = buildContextRef.current()
      prevContextRef.current = ctx
      setTimeout(() => {
        try { conversation.sendContextualUpdate(ctx) } catch (_) {}
      }, 400)
    }
  }, [conversation.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const isAgentActive = conversation.status === 'connected' || conversation.status === 'connecting'

  const startAgent = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      alert('Microphone access is required to use the voice agent.\nPlease allow microphone access and try again.')
      return
    }

    try {
      sendInitialContextRef.current = true
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc',
      })
    } catch (err) {
      console.error('[GroundWire] Failed to start agent:', err)
      sendInitialContextRef.current = false
    }
  }, [conversation])

  const stopAgent = useCallback(async () => {
    try { await conversation.endSession() } catch (_) {}
  }, [conversation])

  // Send circuit context update whenever the circuit changes while agent is active
  const prevContextRef = useRef<string>('')
  useEffect(() => {
    if (conversation.status !== 'connected') return
    const ctx = buildContext()
    if (ctx === prevContextRef.current) return
    prevContextRef.current = ctx
    try {
      conversation.sendContextualUpdate(
        `Circuit update: ${circuitGraph.components.length} components. ${ctx}`
      )
    } catch (_) {}
  }, [circuitGraph, simulationState, conversation, buildContext])

  // ─── TTS ─────────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    if (!apiKey || isSpeaking) return
    const cleanText = text
      .replace(/[^\x00-\x7F]/g, ' ')
      .replace(/[⚡🔥💡🔋🚪⏚⚙️⚠️🔌📍🗺️⏸▶]/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 600)

    if (!cleanText) return
    setIsSpeaking(true)

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      })

      if (!res.ok) {
        console.error('TTS API error:', res.status, await res.text())
        setIsSpeaking(false)
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      currentAudioUrlRef.current = url
      if (audioRef.current) {
        audioRef.current.src = url
        await audioRef.current.play()
      } else {
        setIsSpeaking(false)
      }
    } catch (err) {
      console.error('TTS error:', err)
      setIsSpeaking(false)
    }
  }, [apiKey, isSpeaking])

  const stopSpeak = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsSpeaking(false)
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current)
      currentAudioUrlRef.current = null
    }
  }, [])

  // Auto-narrate: speak every new story step automatically
  const lastNarrationRef = useRef<string | null>(null)
  useEffect(() => {
    if (!autoNarrate || !apiKey || !currentNarration) return
    if (currentNarration === lastNarrationRef.current) return
    lastNarrationRef.current = currentNarration
    // Stop any currently playing audio so the new step starts immediately
    if (isSpeaking) stopSpeak()
    speak(currentNarration)
  }, [currentNarration, autoNarrate, apiKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Agent status colors ──────────────────────────────────────────────────────
  const STATUS_COLOR: Record<string, string> = {
    disconnected: '#64748b',
    connecting: '#f59e0b',
    connected: conversation.isSpeaking ? '#3b82f6' : '#22c55e',
  }
  const STATUS_LABEL: Record<string, string> = {
    disconnected: 'IDLE',
    connecting: 'CONNECTING...',
    connected: conversation.isSpeaking ? 'SPEAKING' : 'LISTENING',
  }
  const statusColor = STATUS_COLOR[conversation.status] ?? '#64748b'
  const statusLabel = STATUS_LABEL[conversation.status] ?? 'IDLE'

  return (
    <div style={{
      position: 'absolute',
      bottom: 12,
      right: 12,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
    }}>
      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          background: '#0f172a',
          border: '2px solid #334155',
          borderRadius: 8,
          padding: '14px 16px',
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: '#ffd700', marginBottom: 4 }}>
            VOICE SETTINGS
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>ElevenLabs API Key (for TTS)</span>
            <input
              type="password"
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); localStorage.setItem('elevenlabs_api_key', e.target.value) }}
              placeholder="xi-..."
              style={{
                background: '#1e293b', border: '1px solid #475569', color: '#f8fafc',
                fontFamily: 'monospace', fontSize: 10, padding: '5px 8px', borderRadius: 4, width: '100%',
              }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>Auto-narrate stories</span>
            <button
              onClick={() => setAutoNarrate(a => {
                const next = !a
                localStorage.setItem('elevenlabs_auto_narrate', String(next))
                return next
              })}
              style={{
                background: autoNarrate ? 'rgba(34,197,94,0.15)' : '#1e293b',
                border: `2px solid ${autoNarrate ? '#22c55e' : '#475569'}`,
                color: autoNarrate ? '#22c55e' : '#64748b',
                fontFamily: "'Press Start 2P', monospace", fontSize: 6,
                padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              }}
            >
              {autoNarrate ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{
            background: '#0a0e1a', border: '1px solid #1e293b',
            borderRadius: 4, padding: '6px 8px',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', marginBottom: 4 }}>VOICE AGENT</div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
              Ground Wire Agent (WebRTC)<br />
              {circuitGraph.components.length} components &bull; {simulationState?.faults.length ?? 0} fault(s)
            </div>
          </div>
        </div>
      )}

      {/* Agent Status Indicator */}
      {isAgentActive && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.92)',
          border: `2px solid ${statusColor}`,
          borderRadius: 6,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: `0 0 16px ${statusColor}44`,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColor,
            display: 'inline-block',
            boxShadow: `0 0 8px ${statusColor}`,
          }} />
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: '#e2e8f0' }}>
            {statusLabel}
          </span>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Settings toggle */}
        <button
          onClick={() => setShowSettings(s => !s)}
          title="Voice settings"
          style={{
            background: showSettings ? '#1a1500' : 'rgba(15,23,42,0.88)',
            border: `2px solid ${showSettings ? '#ffd700' : '#334155'}`,
            borderRadius: 6,
            color: showSettings ? '#ffd700' : '#64748b',
            fontSize: 14,
            padding: '6px 10px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          ⚙️
        </button>

        {/* TTS: Speak now / Stop */}
        {isSpeaking ? (
          <button
            onClick={stopSpeak}
            title="Stop narration"
            style={{
              background: 'rgba(59,130,246,0.15)',
              border: '2px solid #3b82f6',
              borderRadius: 6,
              color: '#3b82f6',
              fontSize: 14,
              padding: '6px 10px',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(59,130,246,0.3)',
              transition: 'all 0.15s',
            }}
          >
            ⏸
          </button>
        ) : (
          <button
            onClick={() => currentNarration && speak(currentNarration)}
            disabled={!apiKey || !currentNarration}
            title={!apiKey ? 'Add API key in settings' : !currentNarration ? 'No story to narrate' : 'Narrate current story'}
            style={{
              background: 'rgba(15,23,42,0.88)',
              border: `2px solid ${!apiKey || !currentNarration ? '#1e293b' : '#334155'}`,
              borderRadius: 6,
              color: !apiKey || !currentNarration ? '#334155' : '#94a3b8',
              fontSize: 14,
              padding: '6px 10px',
              cursor: !apiKey || !currentNarration ? 'not-allowed' : 'pointer',
              opacity: !apiKey || !currentNarration ? 0.4 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (apiKey && currentNarration) e.currentTarget.style.borderColor = '#60a5fa' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = !apiKey || !currentNarration ? '#1e293b' : '#334155' }}
          >
            🔊
          </button>
        )}

        {/* Voice Agent toggle */}
        <button
          onClick={isAgentActive ? stopAgent : startAgent}
          title={isAgentActive ? 'End voice session' : 'Start Ground Wire voice agent'}
          style={{
            background: isAgentActive ? 'rgba(139,92,246,0.15)' : 'rgba(15,23,42,0.88)',
            border: `2px solid ${isAgentActive ? '#8b5cf6' : '#334155'}`,
            borderRadius: 6,
            color: isAgentActive ? '#8b5cf6' : '#94a3b8',
            fontSize: 14,
            padding: '6px 10px',
            cursor: 'pointer',
            boxShadow: isAgentActive ? '0 0 16px rgba(139,92,246,0.4)' : 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!isAgentActive) e.currentTarget.style.borderColor = '#8b5cf6' }}
          onMouseLeave={e => { if (!isAgentActive) e.currentTarget.style.borderColor = '#334155' }}
        >
          {isAgentActive ? '🛑' : '🎙️'}
        </button>
      </div>

      {/* Auto-narrate indicator */}
      {autoNarrate && !showSettings && (
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 5,
          color: '#22c55e',
          textAlign: 'right',
          opacity: 0.7,
        }}>
          AUTO-NARRATE ON
        </div>
      )}
    </div>
  )
}
