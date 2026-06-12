import { Router, Request, Response } from 'express'

const router = Router()

// POST /api/narrate
// Accepts { commentary: string }, returns a placeholder audioUrl
router.post('/', (req: Request, res: Response) => {
  const { commentary } = req.body

  if (!commentary || typeof commentary !== 'string') {
    res.status(400).json({ error: 'commentary string is required' })
    return
  }

  // TODO: implement ElevenLabs TTS integration (feature/ai-pipeline)
  res.json({ audioUrl: '' })
})

export default router
