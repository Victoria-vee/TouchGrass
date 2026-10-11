const MAX_RECENT_CHALLENGES = 8
const recentChallenges = []

const stopWords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'around', 'for', 'from', 'in', 'into', 'it',
  'its', 'of', 'on', 'or', 'the', 'their', 'there', 'this', 'to', 'with', 'your',
  'you', 'while', 'then', 'before', 'after', 'some', 'few', 'little', 'small',
  'minutes', 'outside', 'outdoors', 'spend', 'spending', 'take', 'time', 'moment',
])

const tokenAliases = new Map([
  ['noticed', 'observe'], ['noticing', 'observe'], ['notice', 'observe'], ['look', 'observe'],
  ['looking', 'observe'], ['watch', 'observe'], ['watching', 'observe'], ['spot', 'observe'],
  ['find', 'observe'], ['finding', 'observe'], ['observe', 'observe'], ['observing', 'observe'],
  ['sketch', 'draw'], ['sketching', 'draw'], ['draws', 'draw'], ['drawing', 'draw'],
  ['jot', 'write'], ['jotting', 'write'], ['record', 'write'], ['recording', 'write'],
  ['describe', 'write'], ['describing', 'write'], ['note', 'write'], ['notes', 'write'],
  ['plants', 'plant'], ['flower', 'plant'], ['flowers', 'plant'], ['tree', 'plant'],
  ['trees', 'plant'], ['leaves', 'plant'], ['leaf', 'plant'], ['grass', 'plant'],
  ['clouds', 'cloud'], ['formations', 'shape'], ['shapes', 'shape'],
  ['shadows', 'shadow'], ['patterns', 'pattern'], ['textures', 'texture'],
  ['bark', 'texture'], ['stones', 'texture'], ['rocks', 'texture'], ['pebbles', 'texture'],
  ['birds', 'bird'], ['insects', 'wildlife'], ['bugs', 'wildlife'],
])

const topicGroups = [
  ['plant', /\b(plant|flower|tree|leaf|leaves|grass|garden|fern|moss)\b/i],
  ['cloud', /\b(cloud|sky|cloudscape)\b/i],
  ['shadow', /\b(shadow|shadows|sunlight|sunbeam|light pattern)\b/i],
  ['texture', /\b(texture|bark|stone|rock|pebble|surface)\b/i],
  ['bird', /\b(bird|birds|feather)\b/i],
  ['wildlife', /\b(animal|insect|bug|butterfly)\b/i],
  ['sound', /\b(sound|listen|listening|hear|hearing)\b/i],
  ['water', /\b(water|puddle|stream|rain|ripple)\b/i],
]

function fingerprint(activity) {
  const text = activity.toLowerCase()
  const words = text.match(/[a-z]+/g) ?? []
  const tokens = new Set(words
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .map((word) => tokenAliases.get(word) ?? word))
  const topics = new Set(topicGroups.filter(([, pattern]) => pattern.test(text)).map(([topic]) => topic))
  const actions = new Set(['draw', 'write', 'observe', 'listen'].filter((action) => tokens.has(action)))
  return { tokens, topics, actions }
}

export function areSimilarChallenges(first, second) {
  const left = fingerprint(first.activity)
  const right = fingerprint(second.activity)
  const sharedTopics = [...left.topics].filter((topic) => right.topics.has(topic))
  const sharedActions = [...left.actions].filter((action) => right.actions.has(action))
  const commonTokens = [...left.tokens].filter((token) => right.tokens.has(token)).length

  if (sharedTopics.length && sharedActions.some((action) => action !== 'observe')) return true
  if (commonTokens < 3) return false

  const unionSize = new Set([...left.tokens, ...right.tokens]).size
  const overlap = commonTokens / Math.max(1, Math.min(left.tokens.size, right.tokens.size))
  const jaccard = commonTokens / Math.max(1, unionSize)
  return overlap >= 0.68 || jaccard >= 0.42
}

export function getRecentChallenges() {
  return recentChallenges.map((challenge) => ({ ...challenge }))
}

export function rememberChallenge(challenge) {
  recentChallenges.push({ title: challenge.title, activity: challenge.activity })
  if (recentChallenges.length > MAX_RECENT_CHALLENGES) recentChallenges.shift()
}

export function clearChallengeHistory() {
  recentChallenges.length = 0
}
