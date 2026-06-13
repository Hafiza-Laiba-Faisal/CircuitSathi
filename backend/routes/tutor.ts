import express from 'express'
import { llm } from '../lib/ai'

const router = express.Router()

router.post('/parse', async (req, res) => {
  const { manualText } = req.body

  if (!manualText) {
    return res.status(400).json({ error: 'Manual text is required' })
  }

  const systemPrompt = `You are an AI Physics Tutor (Sathi/Dost). 
Your goal is to parse a lab manual and convert it into a structured tutorial for a 2D circuit simulator.

Output EXACTLY a JSON object with a "steps" array. Each step MUST have:
- "id": string
- "title": short title (e.g., "Ohm's Law Phase 1")
- "instruction": clear instruction for the student.
- "explanation": a friendly bilingual explanation (English + Urdu/Hindi) of the physics concept.
- "goalCriteria": { 
    "requiredComponents": ["battery", "resistor", etc.], 
    "minVoltage": number (optional), 
    "powered": boolean 
  }

Keep it to 3-5 clear steps. Use a friendly "Sathi" tone.`

  const prompt = `Convert this experiment into steps: \n\n${manualText}`

  const result = await llm(prompt, systemPrompt, true)
  
  if (!result) {
    return res.status(500).json({ error: 'AI failed to parse the manual' })
  }

  try {
    const json = JSON.parse(result)
    res.json(json)
  } catch (e) {
    res.status(500).json({ error: 'Invalid JSON response from AI' })
  }
})

export default router
