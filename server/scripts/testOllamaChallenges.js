import assert from 'node:assert/strict'
import app from '../app.js'
import { areSimilarChallenges } from '../services/challengeHistory.js'

const server = app.listen(0, '127.0.0.1')
await new Promise((resolve, reject) => {
  server.once('listening', resolve)
  server.once('error', reject)
})

try {
  const { port } = server.address()
  const challenges = []
  for (let index = 0; index < 3; index += 1) {
    const startedAt = performance.now()
    const response = await fetch(`http://127.0.0.1:${port}/api/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? `Challenge request ${index + 1} failed.`)
    assert.equal(typeof data.title, 'string')
    assert.equal(typeof data.activity, 'string')
    assert.equal(Number.isInteger(data.durationMinutes), true)
    assert.ok(data.durationMinutes >= 10 && data.durationMinutes <= 20)
    assert.equal(challenges.some((previous) => areSimilarChallenges(data, previous)), false, 'model repeated a recent activity')
    challenges.push(data)
    const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1)
    console.log(`Challenge ${index + 1} (${elapsedSeconds}s): ${data.title} — ${data.activity}`)
  }
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}
