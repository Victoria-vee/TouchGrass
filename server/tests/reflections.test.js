import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import router from '../routes/reflections.js'
import { reflectionSchema } from '../config.js'
import QuestCompletion from '../models/QuestCompletion.js'

const handler = router.stack.find((layer) => layer.route?.path === '/')?.route.stack[0].handle
assert.equal(typeof handler, 'function', 'reflection POST handler should be registered')

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

async function callHandler(body) {
  const response = createResponse()
  await handler({ body }, response)
  return response
}

const imageBase64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')
const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

test('interprets a drawing with the original challenge context and no handwriting', async () => {
  const modelResult = {
    feedback: 'The drawing looks like a leaf.',
    interpretation: 'A leaf drawing inspired by the outdoor observation challenge.',
    handwriting: { status: 'not_applicable', transcription: '' },
  }
  let ollamaRequest
  globalThis.fetch = async (_url, options) => {
    ollamaRequest = JSON.parse(options.body)
    return { ok: true, json: async () => ({ response: JSON.stringify(modelResult) }) }
  }

  const response = await callHandler({
    imageBase64,
    imageMimeType: 'image/png',
    reflection: 'I stopped to sketch something I noticed.',
    challenge: { title: 'A closer look', activity: 'Observe a nearby leaf and sketch its shape.' },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, modelResult)
  assert.deepEqual(ollamaRequest.images, [imageBase64])
  assert.match(ollamaRequest.prompt, /original outdoor challenge is supplied as separate context/)
  assert.match(ollamaRequest.prompt, /Observe a nearby leaf and sketch its shape/)
  assert.match(ollamaRequest.prompt, /Do not assume every visible mark or text is handwriting/)
  assert.match(ollamaRequest.prompt, /Inspect its visual content and its writing as two separate evidence sources/)
  assert.ok(reflectionSchema.properties.handwriting.properties.status.enum.includes('not_applicable'))
  assert.ok(QuestCompletion.schema.path('aiFeedback.handwriting.status').enumValues.includes('not_applicable'))
})

test('interprets handwriting-only submissions without requiring a drawing', async () => {
  const modelResult = {
    feedback: 'Your note captures the quiet moment outside.',
    interpretation: 'The handwritten answer says that the air felt cool beside the garden.',
    handwriting: { status: 'readable', transcription: 'The air felt cool beside the garden.' },
  }
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ response: JSON.stringify(modelResult) }) })

  const response = await callHandler({
    imageBase64,
    imageMimeType: 'image/png',
    reflection: '',
    challenge: { title: 'Notice the air', activity: 'Pause outside and record how the air feels.' },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, modelResult)
})

test('interprets artwork and relevant handwriting together in a mixed submission', async () => {
  const modelResult = {
    feedback: 'The leaf sketch and note both capture a small detail from outside.',
    interpretation: 'The drawing shows a broad leaf, while the handwritten note says it was growing near the porch.',
    handwriting: { status: 'readable', transcription: 'Growing near the porch.' },
  }
  let ollamaRequest
  globalThis.fetch = async (_url, options) => {
    ollamaRequest = JSON.parse(options.body)
    return { ok: true, json: async () => ({ response: JSON.stringify(modelResult) }) }
  }

  const response = await callHandler({
    imageBase64,
    imageMimeType: 'image/png',
    reflection: 'I drew the leaf I found.',
    challenge: { title: 'A closer look', activity: 'Observe one plant and record a detail.' },
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, modelResult)
  assert.match(ollamaRequest.prompt, /When both are present, use both/)
  assert.match(ollamaRequest.prompt, /combine the supported findings in this single interpretation/)
})

test('keeps a visual clarification separate from handwriting transcription', async () => {
  const modelResult = {
    feedback: 'Thanks for clarifying; I understand the drawing as a leaf.',
    interpretation: 'The drawing shows a leaf, as clarified by the user.',
    handwriting: { status: 'not_applicable', transcription: '' },
  }
  let ollamaRequest
  globalThis.fetch = async (_url, options) => {
    ollamaRequest = JSON.parse(options.body)
    return { ok: true, json: async () => ({ response: JSON.stringify(modelResult) }) }
  }

  const clarification = "It's a leaf, not a bird."
  const response = await callHandler({
    imageBase64,
    imageMimeType: 'image/png',
    reflection: 'I drew what I saw outside.',
    challenge: { title: 'A closer look', activity: 'Observe a nearby leaf and sketch its shape.' },
    clarification,
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.handwriting, { status: 'not_applicable', transcription: '' })
  assert.match(ollamaRequest.prompt, /separate clarification as literal user-provided context/)
  assert.match(ollamaRequest.prompt, /It's a leaf, not a bird\./)
  assert.match(ollamaRequest.prompt, /Never put the clarification in handwriting\.transcription/)
  assert.match(ollamaRequest.prompt, /do not ask the user to clarify that same point again/)
})
