import dotenv from 'dotenv'
import multer from 'multer'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serverDirectory = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(serverDirectory, '.env') })
export const uploadDirectory = resolve(serverDirectory, 'uploads')
export const port = Number.parseInt(process.env.PORT ?? '3000', 10)
export const mongoUri = process.env.MONGODB_URI
export const ollamaUrl = (process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/+$/, '')
export const ollamaModel = process.env.OLLAMA_MODEL ?? 'gemma3:4b'
const configuredTimeout = Number.parseInt(process.env.OLLAMA_TIMEOUT_MS ?? '60000', 10)
export const ollamaTimeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 60_000
const configuredReflectionTimeout = Number.parseInt(process.env.OLLAMA_REFLECTION_TIMEOUT_MS ?? '180000', 10)
export const ollamaReflectionTimeoutMs = Number.isFinite(configuredReflectionTimeout) && configuredReflectionTimeout > 0
  ? configuredReflectionTimeout
  : 180_000

export const activitySchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'A short, warm title for the outdoor activity.',
    },
    activity: {
      type: 'string',
      description: 'One gentle invitation in one or two natural sentences. Do not format it as a list.',
    },
    durationMinutes: {
      type: 'integer',
      minimum: 10,
      maximum: 20,
      description: 'A realistic estimate between 10 and 20 minutes.',
    },
  },
  required: ['title', 'activity', 'durationMinutes'],
}

export const MAX_REFLECTION_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_TYPED_REFLECTION_LENGTH = 2000
export const MAX_REFLECTION_CLARIFICATION_LENGTH = 4100
export const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const completionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REFLECTION_IMAGE_BYTES, files: 1, fields: 7, fieldSize: 12 * 1024 },
})
export const reflectionSchema = {
  type: 'object',
  properties: {
    feedback: {
      type: 'string',
      description: 'A brief, warm response grounded only in the user-provided notes.',
    },
    interpretation: {
      type: 'string',
      description: 'The best current understanding of the notes, incorporating user clarifications as authoritative corrections without implying those words were independently read from the image.',
    },
    handwriting: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['readable', 'partially_readable', 'unclear', 'no_image'],
        },
        transcription: {
          type: 'string',
          description: 'Only text confidently visible in the image. Empty if no image or handwriting is unclear.',
        },
      },
      required: ['status', 'transcription'],
    },
  },
  required: ['feedback', 'interpretation', 'handwriting'],
}
