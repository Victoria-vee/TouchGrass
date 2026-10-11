import cors from 'cors'
import express from 'express'
import multer from 'multer'
import { uploadDirectory } from './config.js'
import healthRouter from './routes/health.js'
import challengesRouter from './routes/challenges.js'
import reflectionsRouter from './routes/reflections.js'
import completionsRouter from './routes/completions.js'

const app = express()
app.use(cors({ origin: 'http://localhost:5173' }))
app.use('/uploads', express.static(uploadDirectory))
app.use('/api/health', healthRouter)
app.use('/api/challenges', express.json({ limit: '100kb' }), challengesRouter)
app.use('/api/reflections', express.json({ limit: '12mb' }), reflectionsRouter)
app.use('/api/completions', completionsRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' })
})

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const isTooLarge = error.code === 'LIMIT_FILE_SIZE'
    return response.status(isTooLarge ? 413 : 400).json({
      error: isTooLarge
        ? 'That photo is larger than 8 MB. Please choose a smaller image.'
        : 'Upload one JPEG, PNG, or WebP photo of your notes.',
    })
  }

  console.error('Request error:', error.message)
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status
    : 500
  const message = error.type === 'entity.too.large'
    ? 'The request is too large. Please choose a photo smaller than 8 MB.'
    : status === 400
      ? 'Request body must contain valid JSON.'
      : 'Unexpected server error.'
  response.status(status).json({ error: message })
})

export default app