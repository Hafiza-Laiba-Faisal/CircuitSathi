// Polyfill for DOMMatrix/Canvas essentials required by pdfjs-dist (used in pdf-parse)
// MUST BE AT THE VERY TOP BEFORE ANY OTHER IMPORTS
if (typeof (global as any).DOMMatrix === 'undefined') {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor() { }
    static fromFloat32Array() { return new DOMMatrix(); }
  };
}
if (typeof (global as any).Path2D === 'undefined') { (global as any).Path2D = class Path2D { }; }
if (typeof (global as any).ImageData === 'undefined') { (global as any).ImageData = class ImageData { }; }

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

import healthRouter from './routes/health'
import projectsRouter from './routes/projects'
import simulateRouter from './routes/simulate'
import uploadRouter from './routes/upload'
import narrateRouter from './routes/narrate'
import tutorRouter from './routes/tutor'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Routes
app.use('/api/health', healthRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/simulate', simulateRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/narrate', narrateRouter)
app.use('/api/tutor', tutorRouter)

// Connect to MongoDB and start server
const startServer = async () => {
  const mongoUri = process.env.MONGODB_URI

  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri)
      console.log('Connected to MongoDB')
    } catch (err) {
      console.error('MongoDB connection error:', err)
      console.warn('Continuing without MongoDB — some routes will not function.')
    }
  } else {
    console.warn('MONGODB_URI not set — skipping database connection.')
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

startServer()
