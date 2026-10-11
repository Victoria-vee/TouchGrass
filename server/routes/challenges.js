import express from 'express'
import { activitySchema, ollamaModel, ollamaTimeoutMs, ollamaUrl } from '../config.js'
import { areSimilarChallenges, getRecentChallenges, rememberChallenge } from '../services/challengeHistory.js'

const MAX_GENERATION_ATTEMPTS = 3
const router = express.Router()

function parseActivity(responseText) {
  let activity
  try {
    activity = JSON.parse(responseText)
  } catch {
    return { value: null, malformed: true }
  }

  const title = typeof activity?.title === 'string' ? activity.title.trim() : ''
  const description = typeof activity?.activity === 'string' ? activity.activity.trim() : ''
  const durationMinutes = activity?.durationMinutes
  if (
    !title || !description ||
    !Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 20
  ) return { value: null, malformed: false }

  return { value: { title, activity: description, durationMinutes }, malformed: false }
}

function buildPrompt(recentChallenges, rejectedChallenges) {
  const recentContext = recentChallenges.length
    ? `\nRecently generated challenges to avoid: ${JSON.stringify(recentChallenges)}`
    : ''
  const retryContext = rejectedChallenges.length
    ? `\nYour previous attempt(s) in this request were rejected as repeats: ${JSON.stringify(rejectedChallenges)}. Choose a different subject and core creative action. Do not paraphrase or retitle any listed activity.`
    : ''

  return [
    'Create exactly ONE original, calm outdoor challenge that invites the user to write or draw something they noticed about outside',
    'For every request, choose a different primary subject and core creative action from the recent challenges. A new title or paraphrase does not count as a new activity.',
    'The challenge must be free, take approximately 10–20 minutes, and work in an ordinary safe outdoor place such as a yard, balcony, porch, or nearby green space.',
    'Suggest paper and a pen only when useful; the challenge must remain enjoyable without equipment. Never require spending money, strenuous movement, or another person.',
    'Use a warm, relaxing tone. Do not make this feel like homework. Give one or two concise sentences, without numbered steps, quotas, goals, scores, or productivity language.',
    'Keep it safe and accessible. Never suggest trespassing, entering a road, approaching unfamiliar people or animals, touching unknown plants or hazardous objects, or going somewhere isolated or unsafe.',
    'Return only JSON matching the requested schema, with a short title, one or two sentence activity, and a whole-number durationMinutes from 10 through 20.',
    recentContext,
    retryContext,
  ].join(' ')
}

router.post('/', async (_request, response) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ollamaTimeoutMs)
  const sendTimeoutError = () => response.status(504).json({
    error: `Ollama did not respond within ${Math.ceil(ollamaTimeoutMs / 1000)} seconds. Try again or increase OLLAMA_TIMEOUT_MS.`,
  })

  try {
    const rejectedChallenges = []
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const history = getRecentChallenges()
      let ollamaResponse
      try {
        ollamaResponse = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: ollamaModel,
            prompt: buildPrompt(history, rejectedChallenges),
            stream: false,
            format: activitySchema,
            options: { temperature: 0.95, top_p: 0.9, repeat_penalty: 1.15, num_predict: 180 },
          }),
        })
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) return sendTimeoutError()
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

      const parsed = parseActivity(ollamaData.response)
      if (parsed.malformed) {
        return response.status(502).json({ error: 'Ollama returned an activity that was not valid JSON. Please try again.' })
      }
      if (!parsed.value) {
        return response.status(502).json({ error: 'Ollama returned an activity in an unexpected format. Please try again.' })
      }
      const activity = parsed.value

      if (history.some((previous) => areSimilarChallenges(activity, previous)) || rejectedChallenges.some((previous) => areSimilarChallenges(activity, previous))) {
        rejectedChallenges.push({ title: activity.title, activity: activity.activity })
        continue
      }

      rememberChallenge(activity)
      return response.json(activity)
    }

    return response.status(503).json({
      error: `Ollama returned a challenge too similar to a recent one after ${MAX_GENERATION_ATTEMPTS} attempts. Please try again for a different outdoor idea.`,
    })
  } finally {
    clearTimeout(timeout)
  }
})

export default router
