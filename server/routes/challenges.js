import express from 'express'
import { activitySchema, ollamaModel, ollamaTimeoutMs, ollamaUrl } from '../config.js'

const router = express.Router()

router.post('/', async (_request, response) => {
  const prompt = [
    'Create exactly one gentle outdoor activity for someone who wants a calm break from screens.',
    'It must be free, take about 10 to 20 minutes, and work in an ordinary outdoor place such as a yard, balcony, sidewalk, or nearby green space.',
    'Make it feel natural, relaxing, and unwinding. Avoid homework, rigid steps, checklists, quotas, performance goals, special equipment, or needing other people.',
    'Describe it as a warm, simple invitation in one or two short sentences. Include a short title and a realistic duration in whole minutes.',
    'Return only JSON with the keys title, activity, and durationMinutes.',
  ].join(' ')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs)
  const sendTimeoutError = () => response.status(504).json({
    error: `Ollama did not respond within ${Math.ceil(ollamaTimeoutMs / 1000)} seconds. Try again or increase OLLAMA_TIMEOUT_MS.`,
  })

  try {
    let ollamaResponse
    try {
      ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: ollamaModel,
          prompt,
          stream: false,
          format: activitySchema,
          options: { temperature: 0.7, num_predict: 160 },
        }),
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        return sendTimeoutError()
      }

      return response.status(503).json({
        error: `Could not reach Ollama at ${ollamaUrl}. Make sure Ollama is running and try again.`,
      })
    }

    if (!ollamaResponse.ok) {
      let responseText
      try {
        responseText = await ollamaResponse.text()
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) return sendTimeoutError()
        return response.status(502).json({ error: 'Could not read the error response from Ollama. Please try again.' })
      }

      let ollamaMessage = ''
      try {
        ollamaMessage = JSON.parse(responseText)?.error ?? ''
      } catch {
        ollamaMessage = responseText
      }

      const detail = typeof ollamaMessage === 'string' ? ollamaMessage.trim().slice(0, 240) : ''
      const modelHint = ollamaResponse.status === 404
        ? ` Check that the model is installed (ollama pull ${ollamaModel}).`
        : ''

      return response.status(502).json({
        error: `Ollama returned HTTP ${ollamaResponse.status}${detail ? `: ${detail}` : '.'}${modelHint}`,
      })
    }

    let ollamaData
    try {
      ollamaData = await ollamaResponse.json()
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) return sendTimeoutError()
      return response.status(502).json({ error: 'Ollama returned an invalid response. Please try again.' })
    }

    if (typeof ollamaData?.response !== 'string') {
      return response.status(502).json({ error: 'Ollama returned an invalid response. Please try again.' })
    }

    let activity
    try {
      activity = JSON.parse(ollamaData.response)
    } catch {
      return response.status(502).json({ error: 'Ollama returned an activity that was not valid JSON. Please try again.' })
    }

    const title = typeof activity?.title === 'string' ? activity.title.trim() : ''
    const description = typeof activity?.activity === 'string' ? activity.activity.trim() : ''
    const durationMinutes = activity?.durationMinutes

    if (
      !title ||
      !description ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 10 ||
      durationMinutes > 20
    ) {
      return response.status(502).json({
        error: 'Ollama returned an activity in an unexpected format. Please try again.',
      })
    }

    return response.json({ title, activity: description, durationMinutes })
  } finally {
    clearTimeout(timeout)
  }
})

export default router