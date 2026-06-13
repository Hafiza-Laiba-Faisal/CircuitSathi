import express from 'express'
import multer from 'multer'
const pdf = require('pdf-parse')
import mammoth from 'mammoth'
import { llm, llmWithTools, SATHI_TOOLS } from '../lib/ai'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/parse', upload.single('manualFile'), async (req, res) => {
  let manualText = req.body.manualText || ''
  const file = req.file

  if (file) {
    try {
      if (file.mimetype === 'application/pdf') {
        const data = await pdf(file.buffer)
        manualText = data.text
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: file.buffer })
        manualText = result.value
      } else {
        manualText = file.buffer.toString('utf-8')
      }
    } catch (err) {
      console.error('File Parsing Error:', err)
      return res.status(500).json({ error: 'Failed to parse the uploaded file' })
    }
  }

  console.log(`[Tutor] Parsing request. Text length: ${manualText?.length || 0}`)

  if (!manualText || manualText.trim().length === 0) {
    return res.status(400).json({ error: 'Manual text or file is required' })
  }

  // ─── System Prompt: Instructs Sathi HOW to use its tools ───────────────────
  const systemPrompt = `You are CircuitSathi, an expert AI Physics & Electronics Tutor.
  
  FOR EVERY USER REQUEST:
  1. Detect input language (English/Urdu).
  2. Explain the concept clearly.
  3. Create 3-5 interactive learning steps.
  4. Create a complete, functional circuit schematic.
  5. Return ONLY the "generate_tutorial" tool call.
  
  IF USER UPLOADS A LAB MANUAL:
  - Read experiment objective and explain theory.
  - Extract the circuit and convert it into editor components.
  - Generate corresponding tutorial steps.
  
  NEVER ANSWER IN PLAIN TEXT. ALWAYS USE THE TOOL.`

  const prompt = `Student's topic or lab manual content:\n\n${manualText}`

  // ─── Phase 1: Try the Advanced Agentic Agent ────────────────────────────
  let result = await llmWithTools(prompt, systemPrompt, SATHI_TOOLS)

  // ─── Phase 2: Fallback to Structured JSON if Agent fails ────────────────
  if (!result) {
    console.warn('\x1b[33m[Tutor] Phase 1 (Agentic) failed. Triggering Phase 2 (Structured JSON Fallback)...\x1b[0m')
    const fallbackPrompt = `TOPIC: ${manualText}
    
    CRITICAL: Provide the tutorial steps as a VALID JSON object ONLY. 
    DO NOT include conversational filler.
    
    SCHEMA:
    {
      "steps": [
        {
          "title": "Short title",
          "instruction": "Action for student",
          "explanation": "Scientific explanation"
        }
      ]
    }`
    
    const fallbackResult = await llm(fallbackPrompt, 'You are an AI Physics Tutor. You MUST output VALID JSON ONLY. No markdown blocks.', true)
    
    if (fallbackResult) {
      try {
        const parsed = JSON.parse(fallbackResult)
        result = {
          steps: parsed.steps.map((s: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            ...s,
            goalCriteria: { requiredComponents: [], powered: true }
          })),
          finalMessage: 'Structured lesson loaded.',
          circuits: []
        }
      } catch (e) {
        console.error('[Tutor] Fallback JSON also failed.')
      }
    }
  }

  if (!result || result.steps.length === 0) {
    return res.status(500).json({ error: 'AI is currently overloaded. Please try a simpler topic.' })
  }

  console.log(`[Tutor] Generated ${result.steps.length} steps.`)

  return res.json({
    steps: result.steps,
    summary: result.finalMessage
  })
})

export default router
