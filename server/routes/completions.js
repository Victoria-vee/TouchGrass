import express from 'express'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import QuestCompletion from '../models/QuestCompletion.js'
import { allowedImageTypes, completionUpload, MAX_TYPED_REFLECTION_LENGTH, uploadDirectory } from '../config.js'
import { hashImageBuffer, imageSignatureMatches } from '../utils/imageValidation.js'

const router = express.Router()

router.get('/', async (_request, response) => {
  const completions = await QuestCompletion.find({ userId: 'local' })
    .select('-_id -userId -photoHash')
    .sort({ completedAt: -1 })
    .lean()
  return response.json({ completions })
})

router.post('/', completionUpload.single('photo'), async (request, response) => {
  const { completionId } = request.body ?? {}
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (typeof completionId !== 'string' || !uuidPattern.test(completionId)) {
    return response.status(400).json({ error: 'This quest could not be identified for saving. Please start a new challenge.' })
  }

  if (!request.file) {
    return response.status(400).json({ error: 'Add a photo of your handwritten notes before completing this quest.' })
  }

  const mimeType = request.file.mimetype.toLowerCase()
  if (!allowedImageTypes.has(mimeType) || !imageSignatureMatches(request.file.buffer, mimeType)) {
    return response.status(415).json({ error: 'Choose a valid JPEG, PNG, or WebP photo of your notes.' })
  }

  const questPrompt = typeof request.body.questPrompt === 'string' ? request.body.questPrompt.trim() : ''
  const questTitle = typeof request.body.questTitle === 'string' ? request.body.questTitle.trim() : ''
  const durationMinutes = Number(request.body.durationMinutes)
  const typedSummary = typeof request.body.typedSummary === 'string' ? request.body.typedSummary.trim() : ''
  if (!questPrompt || questPrompt.length > 5000 || !questTitle || questTitle.length > 200) {
    return response.status(400).json({ error: 'The quest details are missing or invalid. Please try again.' })
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 20) {
    return response.status(400).json({ error: 'The quest duration is invalid. Please start a new challenge.' })
  }
  if (typedSummary.length > MAX_TYPED_REFLECTION_LENGTH) {
    return response.status(400).json({ error: `Please keep the typed summary to ${MAX_TYPED_REFLECTION_LENGTH} characters or fewer.` })
  }

  let clarificationHistory
  let aiFeedback = null
  try {
    clarificationHistory = JSON.parse(request.body.clarificationHistory ?? '[]')
    const parsedFeedback = request.body.aiFeedback ? JSON.parse(request.body.aiFeedback) : null
    if (
      !Array.isArray(clarificationHistory) ||
      clarificationHistory.length > 2 ||
      clarificationHistory.some((item) => typeof item !== 'string' || item.trim().length > 2000)
    ) {
      throw new Error('Invalid clarification history')
    }
    if (parsedFeedback !== null) {
      const statuses = ['readable', 'partially_readable', 'unclear', 'no_image']
      if (
        !parsedFeedback ||
        typeof parsedFeedback.feedback !== 'string' ||
        typeof parsedFeedback.interpretation !== 'string' ||
        !statuses.includes(parsedFeedback.handwriting?.status) ||
        typeof parsedFeedback.handwriting?.transcription !== 'string'
      ) {
        throw new Error('Invalid AI feedback')
      }
      aiFeedback = {
        feedback: parsedFeedback.feedback.trim(),
        interpretation: parsedFeedback.interpretation.trim(),
        handwriting: {
          status: parsedFeedback.handwriting.status,
          transcription: parsedFeedback.handwriting.transcription.trim(),
        },
      }
    }
  } catch {
    return response.status(400).json({ error: 'The reflection details could not be read. Please try saving again.' })
  }

  const reflectionFields = { typedSummary, aiFeedback, clarificationHistory }
  const photoHash = hashImageBuffer(request.file.buffer)
  const duplicatePhotoMessage = 'This handwritten photo has already been used for another completed quest. Choose a different photo to earn the 5 XP reward.'
  let completion = await QuestCompletion.findOne({ completionId })
  let alreadyCompleted = Boolean(completion)

  if (completion) {
    if (completion.photoHash && completion.photoHash !== photoHash) {
      return response.status(409).json({ error: 'This quest was already saved with a different photo. Use the original photo to retry.' })
    }
    const otherPhotoOwner = await QuestCompletion.findOne({ photoHash, completionId: { $ne: completionId } }).select('completionId').lean()
    if (otherPhotoOwner) return response.status(409).json({ error: duplicatePhotoMessage })

    if (!completion.photoHash) {
      try {
        await QuestCompletion.updateOne(
          {
            completionId,
            $or: [{ photoHash: { $exists: false } }, { photoHash: null }],
          },
          { $set: { photoHash } },
        )
      } catch (error) {
        if (error?.code === 11000) return response.status(409).json({ error: duplicatePhotoMessage })
        throw error
      }
    }
    completion = await QuestCompletion.findOneAndUpdate(
      { completionId },
      { $set: reflectionFields },
      { new: true, runValidators: true },
    )
  } else {
    const existingPhoto = await QuestCompletion.findOne({ photoHash }).select('completionId').lean()
    if (existingPhoto) return response.status(409).json({ error: duplicatePhotoMessage })

    const extensionByType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    const filename = `${completionId}-${randomUUID()}.${extensionByType[mimeType]}`
    const absolutePhotoPath = resolve(uploadDirectory, filename)
    const photoPath = `uploads/${filename}`
    await mkdir(uploadDirectory, { recursive: true })
    await writeFile(absolutePhotoPath, request.file.buffer, { flag: 'wx' })

    try {
      completion = await QuestCompletion.create({
        completionId,
        userId: 'local',
        questPrompt,
        questTitle,
        durationMinutes,
        ...reflectionFields,
        photoPath,
        photoHash,
        completedAt: new Date(),
        xpAwarded: 5,
      })
    } catch (error) {
      await unlink(absolutePhotoPath).catch(() => {})
      if (error?.code !== 11000) throw error

      completion = await QuestCompletion.findOne({ completionId })
      if (completion) {
        if (completion.photoHash && completion.photoHash !== photoHash) {
          return response.status(409).json({ error: 'This quest was already saved with a different photo. Use the original photo to retry.' })
        }
        try {
          completion = await QuestCompletion.findOneAndUpdate(
            { completionId },
            { $set: { ...reflectionFields, photoHash } },
            { new: true, runValidators: true },
          )
        } catch (updateError) {
          if (updateError?.code === 11000) return response.status(409).json({ error: duplicatePhotoMessage })
          throw updateError
        }
        alreadyCompleted = true
      } else {
        const duplicate = await QuestCompletion.findOne({ photoHash }).select('completionId').lean()
        if (duplicate) return response.status(409).json({ error: duplicatePhotoMessage })
        throw error
      }
    }
  }

  const xpSummary = await QuestCompletion.aggregate([
    { $match: { userId: 'local' } },
    { $group: { _id: null, totalXp: { $sum: '$xpAwarded' } } },
  ])
  return response.status(alreadyCompleted ? 200 : 201).json({
    completionId,
    photoPath: completion.photoPath,
    completedAt: completion.completedAt,
    xpAwarded: completion.xpAwarded,
    totalXp: xpSummary[0]?.totalXp ?? 0,
    alreadyCompleted,
  })
})

export default router
