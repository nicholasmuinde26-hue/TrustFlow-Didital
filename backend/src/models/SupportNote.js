import mongoose from 'mongoose';

// Internal support notes. Never shown to the user or the chama. Append-only:
// there is no edit or delete, so the history of what support knew and did
// stays trustworthy (pinning is the only change allowed).
const supportNoteSchema = new mongoose.Schema(
  {
    subject_type: { type: String, enum: ['user', 'chama'], required: true },
    subject_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportCase', default: null, index: true },
    kind: { type: String, enum: ['note', 'event'], default: 'note' }, // event = system line (status change etc.)
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    pinned: { type: Boolean, default: false },
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

supportNoteSchema.index({ subject_type: 1, subject_id: 1, createdAt: -1 });

for (const hook of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
  supportNoteSchema.pre(hook, function () { throw new Error('Support notes cannot be deleted'); });
}

export default mongoose.models.SupportNote || mongoose.model('SupportNote', supportNoteSchema);
