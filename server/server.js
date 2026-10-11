import mongoose from 'mongoose'
import app from './app.js'
import QuestCompletion from './models/QuestCompletion.js'
import { mongoUri, port } from './config.js'
import { backfillLegacyPhotoHashes } from './services/photoHashes.js'

async function startServer() {
  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Add it to server/.env before starting the API.')
    process.exitCode = 1
    return
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 })
    await QuestCompletion.init()
    const { hashed, skipped } = await backfillLegacyPhotoHashes(QuestCompletion)
    if (hashed) console.log(`Added photo hashes to ${hashed} existing journal entries.`)
    if (skipped) console.warn(`Could not hash ${skipped} existing journal photo(s); those records remain unchanged.`)
    console.log('Connected to MongoDB Atlas.')
    app.listen(port, '127.0.0.1', () => {
      console.log('OutNAbout API listening on http://localhost:' + port)
    })
  } catch {
    console.error('Could not connect to MongoDB. Check MONGODB_URI and Atlas network access.')
    process.exitCode = 1
  }
}

startServer()
