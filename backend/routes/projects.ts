import { Router, Request, Response } from 'express'
import { CircuitProjectNewModel } from '../models/CircuitProjectNew'
import { CircuitGraph, SceneConfig } from '../../shared/types/circuit'

const router = Router()

// GET /api/projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await CircuitProjectNewModel.find().sort({ updatedAt: -1 })
    res.json(projects)
  } catch {
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, circuitGraph, sceneConfig } = req.body as {
      name: string
      circuitGraph: CircuitGraph
      sceneConfig?: SceneConfig
    }
    if (!name) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    if (!circuitGraph || !Array.isArray(circuitGraph.nodes)) {
      res.status(400).json({ error: 'circuitGraph with nodes array is required' })
      return
    }
    const project = new CircuitProjectNewModel({ name, circuitGraph, sceneConfig })
    const saved = await project.save()
    res.status(201).json(saved)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(400).json({ error: `Failed to create project: ${msg}` })
  }
})

// GET /api/projects/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await CircuitProjectNewModel.findById(req.params.id)
    if (!project) { res.status(404).json({ error: 'Project not found' }); return }
    res.json(project)
  } catch {
    res.status(404).json({ error: 'Project not found' })
  }
})

// DELETE /api/projects/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await CircuitProjectNewModel.findByIdAndDelete(req.params.id)
    if (!result) { res.status(404).json({ error: 'Project not found' }); return }
    res.json({ deleted: true })
  } catch {
    res.status(404).json({ error: 'Project not found' })
  }
})

export default router
