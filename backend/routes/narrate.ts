import express from 'express'
import { tts } from '../lib/ai'

const router = express.Router()

router.post('/', async (req, res) => {
  const { text } = req.body

  if (!text) {
    return res.status(400).json({ error: 'Text is required for narration' })
  }

  const audioBuffer = await tts(text) as Buffer | null

  if (!audioBuffer) {
    return res.status(500).json({ error: 'TTS generation failed' })
  }

  res.set({
    'Content-Type': 'audio/wav',
    'Content-Length': audioBuffer.length,
  })

  res.send(audioBuffer)
})

export default router
