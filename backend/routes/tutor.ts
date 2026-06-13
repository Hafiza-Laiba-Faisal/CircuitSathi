import express from 'express'
import multer from 'multer'
const pdf = require('pdf-parse')
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

  console.log(`[Tutor] Parsing manual. Text length: ${manualText?.length || 0}`)

  if (!manualText || manualText.trim().length === 0) {
    return res.status(400).json({ error: 'Manual text or file is required' })
  }

  const systemPrompt = `You are an AI Physics Tutor (Sathi/Dost). 
Your goal is to parse a lab manual OR a general topic and convert it into a structured tutorial.

REQUIRED JSON OUTPUT FORMAT:
{
  "steps": [
    {
      "id": "string",
      "title": "short title",
      "instruction": "clear construction task",
      "explanation": "bilingual explanation (English + Urdu/Hindi)",
      "goalCriteria": { "requiredComponents": ["battery", "resistor", etc], "powered": true },
      "initialGraph": { 
        "components": [
          { "id": "c1", "type": "battery", "label": "B1", "value": 9, "position": {"x": 100, "y": 100} },
          ...
        ],
        "edges": [
          { "id": "e1", "sourceId": "c1", "targetId": "c2", "sourcePin": "positive", "targetPin": "a" },
          ...
        ]
      }
    }
  ]
}

RULES:
1. "initialGraph" should be a COMPLETE, functional solution for that specific step.
2. If the user input is a simple topic (e.g., "Ohm's Law"), create a logical 3-step progression from basic to advanced.
3. Coordinates for components should be spaced out (approx 150-200 units apart).
4. Use a friendly, encouraging Sathi tone. Use Urdu/Hindi script for the Urdu parts.`

  const prompt = `Topic or Manual Content: \n\n${manualText}`

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
