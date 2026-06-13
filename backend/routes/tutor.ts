import express from 'express'
import multer from 'multer'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import { llm } from '../lib/ai'

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

  if (!manualText || manualText.trim().length === 0) {
    return res.status(400).json({ error: 'Manual text or file is required' })
  }

  const systemPrompt = `You are an AI Physics Tutor (Sathi/Dost). 
Your goal is to parse a lab manual and convert it into a structured tutorial for a 2D circuit simulator.

Output EXACTLY a JSON object with a "steps" array. Each step MUST have:
- "id": string
- "title": short title (e.g., "Ohm's Law Phase 1")
- "instruction": clear instruction for the student.
- "explanation": a friendly bilingual explanation (English + Urdu/Hindi) of the physics concept.
- "goalCriteria": { 
    "requiredComponents": ["battery", "resistor", "led", "switch", "capacitor", "motor", "ground"], 
    "minVoltage": number (optional), 
    "powered": boolean 
  }

Keep it to 3-5 clear steps. Use a friendly "Sathi" tone.`

  const prompt = `Convert this experiment into steps: \n\n${manualText}`

  const result = await llm(prompt, systemPrompt, true)
  
  if (!result) {
    return res.status(500).json({ error: 'AI failed to parse the manual content' })
  }

  try {
    const json = JSON.parse(result)
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: 'Invalid JSON response from AI. Please try again with clear text.' })
  }
})

export default router
