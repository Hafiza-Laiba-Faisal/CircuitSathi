'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useCircuitStore } from '../store/circuitStore'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function VoiceAgent() {
  const [showSettings, setShowSettings] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [agentReply, setAgentReply] = useState('')

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentAudioUrlRef = useRef<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const { circuitGraph, simulationState, currentNarration, voiceEnabled, setVoiceEnabled } = useCircuitStore()

  // Initialize audio and restore voice preference from localStorage
  useEffect(() => {
    const savedAutoNarrate = localStorage.getItem('cambai_auto_narrate')
    if (savedAutoNarrate !== null) setVoiceEnabled(savedAutoNarrate === 'true')
    audioRef.current = new Audio()
    audioRef.current.onended = () => {
      setIsSpeaking(false)
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current)
        currentAudioUrlRef.current = null
      }
    }
  }, [])

  // ─── Build context for AI understanding ────────────────────────────────────
  const buildContext = useCallback((): string => {
    const comps = circuitGraph.components
    if (comps.length === 0) {
      return 'The circuit is currently empty. The user is about to start building an electronic circuit simulation called "Circuit Sathi". You are an educational physics AI guide helping them understand electronics.'
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

    return `You are an educational electronics physics guide in "Circuit Sathi" simulation. The user is exploring a circuit containing: ${compList}. ${validStr} Circuit status: ${faultList}.${physicsLine}

Help the user understand the physics concepts behind their circuit. Explain Ohm's Law (V=IR), Kirchhoff's laws, power dissipation (P=IV=I²R), component behavior, and anything else they ask about. Be enthusiastic, educational, and relate concepts to the visual circuit they're building. Keep responses concise but accurate.`
  }, [circuitGraph, simulationState])

  // ─── Camb.AI TTS via Backend ──────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    if (isSpeaking) return
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
      const res = await fetch(`${API_BASE}/api/narrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      })

      if (!res.ok) {
        console.error('Camb.AI TTS error:', res.status, await res.text())
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
  }, [isSpeaking])

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

  // ─── Voice Input via Web Speech API + AI Response via Tutor + Camb.AI TTS ─
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
      setAgentReply('')
    }

    recognition.onresult = async (event: any) => {
      const speechText = event.results[0][0].transcript
      setTranscript(speechText)
      setIsListening(false)

      // Send to AI tutor for a response, with circuit context
      try {
        const context = buildContext()
        const fullPrompt = `${context}\n\nStudent's question (spoken): "${speechText}"\n\nRespond in 2-3 sentences, educational and friendly.`

        const res = await fetch(`${API_BASE}/api/tutor/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manualText: fullPrompt }),
        })

        if (res.ok) {
          const data = await res.json()
          const reply = data.summary || data.steps?.[0]?.explanation || 'I understood your question. Let me help you with that circuit!'
          setAgentReply(reply)
          // Speak the reply via Camb.AI TTS
          speak(reply)
        } else {
          const fallback = 'Sorry, I could not process that. Please try again.'
          setAgentReply(fallback)
          speak(fallback)
        }
      } catch (err) {
        console.error('Voice agent error:', err)
        const fallback = 'There was an error processing your question.'
        setAgentReply(fallback)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [buildContext, speak])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }, [])

  // Auto-narrate: speak every new story step automatically
  const lastNarrationRef = useRef<string | null>(null)
  useEffect(() => {
    if (!voiceEnabled || !currentNarration) return
    if (currentNarration === lastNarrationRef.current) return
    lastNarrationRef.current = currentNarration
    if (isSpeaking) stopSpeak()
    speak(currentNarration)
  }, [currentNarration, voiceEnabled, speak, isSpeaking, stopSpeak])

  // ─── Status ──────────────────────────────────────────────────────────────────
  const agentStatus = isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle'

  const STATUS_COLOR: Record<string, string> = {
    idle: '#64748b',
    listening: '#22c55e',
    speaking: '#3b82f6',
  }
  const STATUS_LABEL: Record<string, string> = {
    idle: 'IDLE',
    listening: 'LISTENING...',
    speaking: 'SPEAKING',
  }
  const statusColor = STATUS_COLOR[agentStatus]
  const statusLabel = STATUS_LABEL[agentStatus]

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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8' }}>Auto-narrate stories</span>
            <button
              onClick={() => {
                const next = !voiceEnabled
                localStorage.setItem('cambai_auto_narrate', String(next))
                setVoiceEnabled(next)
              }}
              style={{
                background: voiceEnabled ? 'rgba(34,197,94,0.15)' : '#1e293b',
                border: `2px solid ${voiceEnabled ? '#22c55e' : '#475569'}`,
                color: voiceEnabled ? '#22c55e' : '#64748b',
                fontFamily: "'Press Start 2P', monospace", fontSize: 6,
                padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              }}
            >
              {voiceEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div style={{
            background: '#0a0e1a', border: '1px solid #1e293b',
            borderRadius: 4, padding: '6px 8px',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#475569', marginBottom: 4 }}>VOICE ENGINE</div>
            <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#64748b', lineHeight: 1.6 }}>
              Camb.AI TTS (mars-8.1-flash-beta)<br />
              {circuitGraph.components.length} components &bull; {simulationState?.faults.length ?? 0} fault(s)
            </div>
          </div>

          {/* Transcript display */}
          {(transcript || agentReply) && (
            <div style={{
              background: '#0a0e1a', border: '1px solid #1e293b',
              borderRadius: 4, padding: '6px 8px', maxHeight: 120, overflowY: 'auto',
            }}>
              {transcript && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>
                  🎤 You: {transcript}
                </div>
              )}
              {agentReply && (
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#60a5fa', marginTop: 4 }}>
                  🤖 Sathi: {agentReply.slice(0, 200)}{agentReply.length > 200 ? '...' : ''}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Agent Status Indicator */}
      {agentStatus !== 'idle' && (
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
            animation: isListening ? 'pulse 1s infinite' : 'none',
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
            disabled={!currentNarration}
            title={!currentNarration ? 'No story to narrate' : 'Narrate current story'}
            style={{
              background: 'rgba(15,23,42,0.88)',
              border: `2px solid ${!currentNarration ? '#1e293b' : '#334155'}`,
              borderRadius: 6,
              color: !currentNarration ? '#334155' : '#94a3b8',
              fontSize: 14,
              padding: '6px 10px',
              cursor: !currentNarration ? 'not-allowed' : 'pointer',
              opacity: !currentNarration ? 0.4 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (currentNarration) e.currentTarget.style.borderColor = '#60a5fa' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = !currentNarration ? '#1e293b' : '#334155' }}
          >
            🔊
          </button>
        )}

        {/* Voice Agent toggle — uses Web Speech API + Camb.AI TTS */}
        <button
          onClick={isListening ? stopListening : startListening}
          title={isListening ? 'Stop listening' : 'Ask Sathi (voice)'}
          style={{
            background: isListening ? 'rgba(34,197,94,0.15)' : 'rgba(15,23,42,0.88)',
            border: `2px solid ${isListening ? '#22c55e' : '#334155'}`,
            borderRadius: 6,
            color: isListening ? '#22c55e' : '#94a3b8',
            fontSize: 14,
            padding: '6px 10px',
            cursor: 'pointer',
            boxShadow: isListening ? '0 0 16px rgba(34,197,94,0.4)' : 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!isListening) e.currentTarget.style.borderColor = '#22c55e' }}
          onMouseLeave={e => { if (!isListening) e.currentTarget.style.borderColor = '#334155' }}
        >
          {isListening ? '🛑' : '🎙️'}
        </button>
      </div>

      {/* Auto-narrate indicator */}
      {voiceEnabled && !showSettings && (
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
