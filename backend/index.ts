import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

import healthRouter from './routes/health'
import projectsRouter from './routes/projects'
import simulateRouter from './routes/simulate'
import uploadRouter from './routes/upload'
import narrateRouter from './routes/narrate'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/health', healthRouter)
app.use('/api/projects', projectsRouter)
app.use('/api/simulate', simulateRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/narrate', narrateRouter)

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
