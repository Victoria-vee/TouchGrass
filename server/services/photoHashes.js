import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { uploadDirectory } from '../config.js'
import { hashImageBuffer } from '../utils/imageValidation.js'

export async function backfillLegacyPhotoHashes(QuestCompletion) {
  const legacyEntries = await QuestCompletion.find({
    $or: [{ photoHash: { $exists: false } }, { photoHash: null }],
  }).select('_id photoPath').lean()

  let hashed = 0
  let skipped = 0
  for (const entry of legacyEntries) {
    const filename = typeof entry.photoPath === 'string' && entry.photoPath.startsWith('uploads/')
      ? entry.photoPath.slice('uploads/'.length)
      : ''
    if (!filename || basename(filename) !== filename) {
      skipped += 1
      continue
    }

    try {
      const photo = await readFile(resolve(uploadDirectory, filename))
      const result = await QuestCompletion.updateOne(
        {
          _id: entry._id,
          $or: [{ photoHash: { $exists: false } }, { photoHash: null }],
        },
        { $set: { photoHash: hashImageBuffer(photo) } },
      )
      if (result.modifiedCount) hashed += 1
    } catch {
      // Leave missing files and any previously duplicated legacy images untouched.
      skipped += 1
    }
  }

  return { hashed, skipped }
}
