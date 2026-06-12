'use client'

import { useCallback, useRef, useState, DragEvent } from 'react'
import { CircuitGraph } from '../../shared/types'
import { parseCircuitFile, ACCEPTED_EXTENSIONS, FORMAT_DESCRIPTIONS, detectFormat } from '../lib/parsers'
import { FALLBACK_CIRCUIT } from '../lib/demoCircuits'

interface Props {
  onParsed: (graph: CircuitGraph, filename: string) => void
}

export default function UploadZone({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [lastFile, setLastFile] = useState<string | null>(null)
  const [parsingMode, setParsingMode] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    setWarning(null)
    setLoading(true)
    setLastFile(file.name)

    const format = detectFormat(file.name)
    setParsingMode(
      format === 'image' ? 'Scanning schematic with Gemini Vision...'
      : format === 'cddx' ? 'Parsing CDDX document...'
      : format === 'spice' ? 'Parsing SPICE netlist...'
      : 'Analysing file...'
    )

    try {
      const graph = await parseCircuitFile(file)
      const components = graph?.components
      if (!components || !Array.isArray(components) || components.length === 0) {
        // Gemini returned nothing useful — load fallback
        setWarning('Gemini could not extract components from the image. Loaded a default circuit instead.')
        onParsed(FALLBACK_CIRCUIT, file.name)
        return
      }
      onParsed(graph, file.name)
    } catch (err) {
      // Any parse / network / Gemini error — load fallback so the user isn't stuck
      const msg = err instanceof Error ? err.message : 'Failed to parse file.'
      setWarning(`Could not parse "${file.name}" (${msg}). Loaded a default circuit instead.`)
      onParsed(FALLBACK_CIRCUIT, file.name)
    } finally {
      setLoading(false)
      setParsingMode(null)
    }
  }, [onParsed])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFile])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const onDragLeave = useCallback(() => setDragging(false), [])

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Dropzone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`flex-1 min-h-[140px] rounded-lg border-2 border-dashed cursor-pointer
          flex flex-col items-center justify-center gap-3 p-4 transition-colors
          ${dragging
            ? 'border-cyan-400 bg-cyan-950/30'
            : 'border-gray-600 bg-gray-900/60 hover:border-gray-500 hover:bg-gray-900/80'
          }`}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs text-cyan-300 font-medium">{parsingMode}</span>
            <span className="text-[10px] text-gray-500">{lastFile}</span>
          </div>
        ) : (
          <>
            <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-300">
                {dragging ? 'Drop file here' : 'Drop a schematic image or circuit file'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, CDDX, or SPICE netlist
              </p>
            </div>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {/* Hard error (non-image formats only) */}
      {error && (
        <div className="bg-red-950/50 border border-red-800/60 rounded-lg px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Soft warning — fallback circuit was loaded */}
      {warning && (
        <div className="bg-yellow-950/50 border border-yellow-700/60 rounded-lg px-3 py-2 text-xs text-yellow-300 leading-relaxed">
          ⚠️ {warning}
        </div>
      )}

      {/* Success */}
      {lastFile && !loading && !error && (
        <div className="bg-green-950/40 border border-green-800/50 rounded-lg px-3 py-2 text-xs text-green-300">
          Loaded <span className="font-medium">{lastFile}</span> — circuit is on the canvas.
        </div>
      )}

      {/* Supported formats */}
      <div className="bg-gray-800/60 rounded-lg p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
          Supported Formats
        </h4>
        <ul className="space-y-1.5">
          {FORMAT_DESCRIPTIONS.map(f => (
            <li key={f.format} className="text-xs text-gray-400 flex justify-between">
              <span className={`font-medium ${f.format === 'image' ? 'text-cyan-400' : 'text-gray-300'}`}>
                {f.label}
              </span>
              <span className="text-gray-500">{f.extensions}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
