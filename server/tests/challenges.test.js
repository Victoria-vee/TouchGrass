import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import router from '../routes/challenges.js'
import { areSimilarChallenges, clearChallengeHistory, getRecentChallenges, rememberChallenge } from '../services/challengeHistory.js'

const handler = router.stack.find((layer) => layer.route?.path === '/')?.route.stack[0].handle
assert.equal(typeof handler, 'function', 'challenge POST handler should be registered')

const valid = (title, activity, durationMinutes = 15) => ({ title, activity, durationMinutes })
const ollamaResult = (activity) => ({ ok: true, json: async () => ({ response: typeof activity === 'string' ? activity : JSON.stringify(activity) }) })

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

async function callHandler() {
  const response = createResponse()
  await handler({}, response)
  return response
}

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
  clearChallengeHistory()
})

test('detects similar real activities despite different titles and wording', () => {
  assert.equal(areSimilarChallenges(
    valid('Small plant study', 'Observe a plant and write a few details you had not noticed before.'),
    valid('A closer look', 'Choose a nearby plant and jot down details that were easy to miss.'),
  ), true)
  assert.equal(areSimilarChallenges(
    valid('Cloud sketch', 'Find an interesting cloud formation and draw its shape.'),
    valid('Bark patterns', 'Study a natural texture and sketch the lines in its surface.'),
  ), false)
  assert.equal(areSimilarChallenges(
    valid('Plant notes', 'Observe a plant and write a few details.'),
    valid('Leaf sketch', 'Observe a plant and sketch its curves.'),
  ), false)
})

test('keeps only the most recent eight accepted challenges', () => {
  for (let index = 0; index < 10; index += 1) {
    rememberChallenge(valid(`Challenge ${index}`, `Observe a different subject ${index} and write a note.`))
  }
  const history = getRecentChallenges()
  assert.equal(history.length, 8)
  assert.equal(history[0].title, 'Challenge 2')
  assert.equal(history.at(-1).title, 'Challenge 9')
})

test('returns valid model JSON and remembers accepted challenges', async () => {
  const expected = valid('Quiet cloud shapes', 'Find a cloud and sketch its changing outline.', 12)
  let requestBody
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body)
    return ollamaResult(expected)
  }

  const response = await callHandler()
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, expected)
  assert.equal(requestBody.model, 'gemma3:4b')
  assert.equal(requestBody.stream, false)
  assert.equal(requestBody.format.properties.durationMinutes.minimum, 10)
  assert.equal(requestBody.format.properties.durationMinutes.maximum, 20)
  assert.equal(getRecentChallenges().length, 1)
})

test('retries a duplicate once and accepts a meaningfully different activity', async () => {
  const first = valid('Plant details', 'Observe a plant and write down a few details you had not noticed before.')
  const varied = valid('Light on the path', 'Notice the shadows around you and describe how their patterns change.', 18)
  let calls = 0
  const prompts = []
  globalThis.fetch = async (_url, options) => {
    calls += 1
    prompts.push(JSON.parse(options.body).prompt)
    return ollamaResult(calls === 1 ? first : calls === 2
      ? valid('A closer look', 'Choose a nearby plant and jot down details that were easy to miss.')
      : varied)
  }

  assert.deepEqual((await callHandler()).body, first)
  const response = await callHandler()
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, varied)
  assert.equal(calls, 3)
  assert.match(prompts[1], /Plant details/)
  assert.match(prompts[1], /Observe a plant/)
  assert.match(prompts[2], /A closer look/)
})

test('stops after three similar candidates and returns a helpful error', async () => {
  const first = valid('Plant details', 'Observe a plant and write down a few details you had not noticed before.')
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return ollamaResult(calls === 1 ? first : valid(`Plant idea ${calls}`, 'Look closely at a plant and record a detail you had overlooked.'))
  }

  await callHandler()
  const response = await callHandler()
  assert.equal(response.statusCode, 503)
  assert.match(response.body.error, /too similar to a recent one after 3 attempts/)
  assert.equal(calls, 4)
  assert.equal(getRecentChallenges().length, 1)
})

test('rejects malformed JSON and out-of-range durations without crashing', async (context) => {
  await context.test('malformed JSON', async () => {
    globalThis.fetch = async () => ollamaResult('not json')
    const response = await callHandler()
    assert.equal(response.statusCode, 502)
    assert.match(response.body.error, /not valid JSON/)
  })
  await context.test('duration outside the schema', async () => {
    globalThis.fetch = async () => ollamaResult(JSON.stringify(valid('Too short', 'Look at a plant.', 9)))
    const response = await callHandler()
    assert.equal(response.statusCode, 502)
    assert.match(response.body.error, /unexpected format/)
  })
})

test('keeps the existing helpful connection and timeout errors', async (context) => {
  await context.test('connection error', async () => {
    globalThis.fetch = async () => { throw new Error('offline') }
    const response = await callHandler()
    assert.equal(response.statusCode, 503)
    assert.match(response.body.error, /Could not reach Ollama/)
  })

  await context.test('timeout', async () => {
    globalThis.fetch = async () => { const error = new Error('timeout'); error.name = 'AbortError'; throw error }
    const response = await callHandler()
    assert.equal(response.statusCode, 504)
    assert.match(response.body.error, /did not respond within/)
  })
})
