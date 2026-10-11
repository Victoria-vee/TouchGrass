import mongoose from 'mongoose'

const questCompletionSchema = new mongoose.Schema({
  completionId: { type: String, required: true, unique: true, immutable: true },
  userId: { type: String, required: true, default: 'local', immutable: true },
  questPrompt: { type: String, required: true },
  questTitle: { type: String, required: true },
  durationMinutes: { type: Number, required: true },
  typedSummary: { type: String, default: '' },
  photoPath: { type: String, required: true },
  photoHash: { type: String, default: undefined },
  aiFeedback: {
    feedback: { type: String, default: null },
    interpretation: { type: String, default: null },
    handwriting: {
      status: { type: String, enum: ['readable', 'partially_readable', 'unclear', 'no_image', 'not_applicable'], default: null },
      transcription: { type: String, default: null },
    },
  },
  clarificationHistory: { type: [String], default: [] },
  completedAt: { type: Date, required: true, default: Date.now, immutable: true },
  xpAwarded: { type: Number, required: true, default: 5, immutable: true },
}, { versionKey: false })

questCompletionSchema.index(
  { photoHash: 1 },
  {
    unique: true,
    partialFilterExpression: { photoHash: { $type: 'string' } },
    name: 'unique_photo_hash',
  },
)

export default mongoose.model('QuestCompletion', questCompletionSchema)
